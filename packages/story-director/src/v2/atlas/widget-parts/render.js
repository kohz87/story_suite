// Renders and updates the map widget instance.

import {
    NEAR_PX, between, boundsOf, centreOn, clampView, fitView, mapPoint, nearestGap, placeUnplaced, zoomLevel,
    zoomLimits,
} from '../view.js';
import { ensureStyle } from '../widget-css.js';
import { createDraw } from '../widget-draw.js';
import { createDom } from '../widget-dom.js';
import { createPlaces } from '../widget-places.js';
import { createPointer } from '../widget-pointer.js';
import { ALL, onLayer, readTrip, readView, text } from '../widget-view.js';
import { wireControls } from './controls.js';
import { views } from './views.js';

const FALLBACK_SIZE = Object.freeze({ width: 640, height: 480 });
const EASE_MS = 260;

/** Renders the Map widget into `el` and returns `{ update, destroy, state }`. */
export function render(el, props, api) {
    const doc = el.ownerDocument ?? globalThis.document;
    ensureStyle(doc);
    const win = doc.defaultView ?? globalThis.window ?? null;
    const listeners = [];
    const listen = (node, type, fn, options) => {
        node.addEventListener(type, fn, options);
        listeners.push([node, type, fn, options]);
    };

    // ---- the DOM --------------------------------------------------------------------------------
    const {
        root, searchBox, input, results, zoomIn, zoomOut, fitAll, centreMe, tidyBtn, regionBox, regions, stage, worldGroup, placesLayer, labelsLayer, hereRing,
        markLayer, road, empty, details, legend, legendCard,
    } = createDom(el, doc);

    // ---- state ----------------------------------------------------------------------------------
    // The state the drawing reads and writes: one object, so the drawing functions can live in a file of their own.
    const s = {
        data: readView(props),
        layer: '',
        points: new Map(),           // id → map-space point (unplaced ones laid out)
        shown: [],                   // places on the layer
        fitK: 1,
        view: { cx: 0, cy: 0, k: 1 },
        size: { ...FALLBACK_SIZE },
        picked: '',
        hovered: '',
        lines: [],                   // [{ line, route }] on the layer (the known routes, then the trip's legs)
        trip: null,                  // the trip prop, cleaned (readTrip)
        marks: [],                   // [{ node, ids: [from, to], t }]: "You" and the movers, placed by paint()
    };
    let viewKey = text(props?.viewKey) || 'map';
    const initialOnSelect = text(props?.onSelect);
    s.layer = s.data.layer;
    let box = boundsOf([]);
    let limits = { min: 0.5, max: 8 };
    let anim = null;
    const nodes = new Map();         // id → place button
    const placeAt = new Map();       // id → the dot's point in the stage, as drawn last
    const labels = new Map();        // id → label span
    const byId = id => s.data.places.find(place => place.id === id) ?? null;
    const { drawLayers, drawShown, drawRoad, paint } = createDraw(s, {
        doc, regions, regionBox, worldGroup, nodes, labels, placesLayer, labelsLayer, empty, stage, markLayer, road, legend, legendCard, placeAt, hereRing,
    });
    const places = createPlaces({
        dom: { doc, details, input, results },
        view: { s, byId, measure, getBox: () => box, getLimits: () => limits, closeEnough },
        hooks: { api, paint, initialOnSelect, setLayer, moveTo },
    });
    const { showDetails, pick, goTo, runSearch, chooseHit } = places;

    // The zoom the stage is drawn at (Story Block's roots are zoomed): the browser's currentCSSZoom, else drawn over own width.
    function zoomOf() {
        const own = Number(stage.currentCSSZoom);
        if (Number.isFinite(own) && own > 0) return own;
        const width = Number(stage.offsetWidth);
        const drawn = Number(stage.getBoundingClientRect?.()?.width);
        return width > 0 && drawn > 0 ? drawn / width : 1;
    }

    function measure() {
        const rect = stage.getBoundingClientRect?.();
        const z = zoomOf();
        if (rect && rect.width > 0 && rect.height > 0) s.size = { width: rect.width / z, height: rect.height / z };
        return s.size;
    }

    function computePoints() {
        const list = s.data.places.map(place => ({ id: place.id, point: mapPoint(place, s.data.orient) }));
        // A place inside a town with no point of its own sits beside the town, as a route would put it.
        const inside = s.data.places.filter(place => place.parent).map(place => [place.id, place.parent]);
        s.points = placeUnplaced(list, [...s.data.routes.map(route => [route.from, route.to]), ...inside]);
    }

    function remember() {
        views.set(`${viewKey}|${s.layer}`, { cx: s.view.cx, cy: s.view.cy, zoom: zoomLevel(s.view, s.fitK) });
    }

    function setView(next, { keep = true } = {}) {
        s.view = clampView(next, box, limits);
        if (keep) remember();
        paint();
    }

    function stopAnimation() {
        if (anim !== null) win?.cancelAnimationFrame?.(anim);
        anim = null;
    }

    const reducedMotion = () => {
        try {
            return Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
        } catch {
            return false;
        }
    };

    // An eased move, or a jump under reduced motion (or where there are no animation frames).
    function moveTo(target) {
        stopAnimation();
        const goal = clampView(target, box, limits);
        if (reducedMotion() || typeof win?.requestAnimationFrame !== 'function') return setView(goal);
        const from = s.view;
        let start = null;
        const step = time => {
            start ??= time;
            const t = Math.min(1, (time - start) / EASE_MS);
            setView(between(from, goal, t), { keep: t >= 1 });
            anim = t < 1 ? win.requestAnimationFrame(step) : null;
        };
        anim = win.requestAnimationFrame(step);
        return undefined;
    }

    function fitNow() {
        measure();
        return fitView(box, s.size.width, s.size.height);
    }

    // The zoom that sets a place apart from its nearest neighbour on the layer (for search and "Me").
    function closeEnough(id) {
        const at = s.points.get(id);
        let nearest = Infinity;
        for (const place of s.shown) {
            if (place.id === id) continue;
            const other = s.points.get(place.id);
            const d = Math.hypot(other.x - at.x, other.y - at.y);
            if (d > 0 && d < nearest) nearest = d;
        }
        const k = Number.isFinite(nearest) ? (NEAR_PX * 1.6) / nearest : s.fitK * 4;
        return Math.min(limits.max, Math.max(s.fitK * 2, k));
    }

    function setLayer(id, { refit = false } = {}) {
        s.layer = s.data.layers.some(item => item.id === id) ? id : ALL;
        s.shown = s.data.places.filter(place => onLayer(place, s.layer));
        box = boundsOf(s.shown.map(place => s.points.get(place.id)));
        const fit = fitNow();
        s.fitK = fit.k;
        limits = zoomLimits(s.fitK, nearestGap(s.shown.map(place => s.points.get(place.id))));
        const saved = refit ? null : views.get(`${viewKey}|${s.layer}`);
        s.view = clampView(saved ? { cx: saved.cx, cy: saved.cy, k: saved.zoom * s.fitK } : fit, box, limits);
        drawLayers();
        drawShown();
        paint();
    }

    // The first view opens on the town {{user}} stands in (the current place's parent, or the place itself when it has places inside), at a
    // zoom where its places are apart; Fit still shows everything. A view the reader left on this layer is kept.
    function openOnTown() {
        const here = byId(s.data.current);
        const town = byId(here?.parent || (here?.inside ? here.id : ''));
        // Only a town with a real point: in a map with no points the row is the fallback and Fit keeps "you are here" in view.
        const at = town && Number.isFinite(town.x) && Number.isFinite(town.y) && onLayer(town, s.layer) ? s.points.get(town.id) : null;
        if (!at || views.has(`${viewKey}|${s.layer}`)) return;
        measure();
        s.view = centreOn(s.view, at, box, limits, closeEnough(town.id));
        remember();
        paint();
    }

    // The view fitted to the trip's stops that are on this layer (two or more), inside the zoom limits.
    function fitTrip() {
        const stops = new Set(s.trip.legs.flatMap(leg => [leg.fromId, leg.toId]));
        const at = s.shown.filter(place => stops.has(place.id)).map(place => s.points.get(place.id)).filter(Boolean);
        if (at.length < 2) return;
        measure();
        s.view = clampView(fitView(boundsOf(at), s.size.width, s.size.height), box, limits);
        paint();
    }

    wireControls({
        dom: { regions, results, details, input, zoomIn, zoomOut, fitAll, centreMe, tidyBtn, stage },
        state: { s, getBox: () => box, getLimits: () => limits },
        hooks: { listen, api, setLayer, showDetails, chooseHit, runSearch, places, goTo, stopAnimation, measure, setView, fitNow },
    });

    createPointer({
        dom: { win, doc, stage, placesLayer, results, searchBox },
        view: { s, nodes, placeAt, measure, zoomOf, getBox: () => box, getLimits: () => limits },
        hooks: { pick, paint, listen, stopAnimation, setView },
    });

    const Observer = win?.ResizeObserver ?? globalThis.ResizeObserver;
    let observer = null;
    if (typeof Observer === 'function') {
        observer = new Observer(() => {
            const before = s.size;
            measure();
            if (before.width === s.size.width && before.height === s.size.height) return;
            const zoom = zoomLevel(s.view, s.fitK);
            s.fitK = fitNow().k;
            limits = zoomLimits(s.fitK, nearestGap(s.shown.map(place => s.points.get(place.id))));
            s.view = clampView({ ...s.view, k: zoom * s.fitK }, box, limits);
            paint();
        });
        observer.observe(stage);
    }

    function load(next, first) {
        s.data = readView(next);
        s.trip = readTrip(next?.trip ?? next?.value?.trip);
        // The map opens on the layer of the place {{user}} is at; with a trip on whose stages do not all lie there (the road runs on into
        // another region), it opens on All, where the whole route can be seen.
        if (first && s.trip?.on && s.data.layer !== ALL) {
            const here = new Set(s.data.places.filter(place => onLayer(place, s.data.layer)).map(place => place.id));
            if (!s.trip.legs.every(leg => here.has(leg.fromId) && here.has(leg.toId))) s.data.layer = ALL;
        }
        viewKey = text(next?.viewKey) || 'map';
        places.setOnSelect(next?.onSelect);
        root.setAttribute('aria-label', text(next?.label) || 'Map');
        // "Centre on where you are" works once a place is known (breaker a3-2): until then it is off and says why.
        tidyBtn.hidden = !(s.data.tidy > 0);
        centreMe.disabled = !s.data.current;
        centreMe.setAttribute('title', s.data.current ? 'Centre on where you are' : 'Centre on where you are (once the story names where you are)');
        computePoints();
        const keep = !first && (s.layer === ALL || s.data.layers.some(item => item.id === s.layer));
        if (keep) {
            // A state update keeps the reader's layer, pan and zoom.
            const zoom = zoomLevel(s.view, s.fitK);
            const centre = { cx: s.view.cx, cy: s.view.cy };
            setLayer(s.layer, { refit: true });
            s.view = clampView({ ...centre, k: zoom * s.fitK }, box, limits);
            paint();
        } else {
            setLayer(s.data.layer);
            // The first time the map is drawn with a trip on, it shows the trip: the view fitted to the stops the trip runs through.
            if (s.trip?.on && !views.has(`${viewKey}|${s.layer}`)) fitTrip();
            else if (first) openOnTown();
        }
        drawRoad();
        if (s.picked && !byId(s.picked)) showDetails('');
        else if (s.picked) showDetails(s.picked);
        if (input.value) runSearch();
    }

    measure();
    load(props, true);
    return {
        update: next => load(next, false),
        destroy() {
            stopAnimation();
            observer?.disconnect?.();
            for (const [node, type, fn, options] of listeners) node.removeEventListener(type, fn, options);
            listeners.length = 0;
            root.remove();
        },
        // For tests and the preview: the view as the widget holds it.
        get state() {
            return { layer: s.layer, view: { ...s.view }, fitK: s.fitK, limits: { ...limits }, picked: s.picked, size: { ...s.size } };
        },
    };
}
