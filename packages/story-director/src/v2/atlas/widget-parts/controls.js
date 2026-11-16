// Wires search, layer, button, and keyboard controls for the map widget.

import { panBy, zoomAt } from '../view.js';
import { ALL } from '../widget-view.js';

const BUTTON_ZOOM = 1.5;
const KEY_PAN = 0.15;              // share of the stage an arrow key moves

const closestWith = (target, stop, test) => {
    for (let node = target; node && node !== stop; node = node.parentNode) if (test(node)) return node;
    return null;
};

/** Attaches DOM event listeners for search, region selection, toolbar buttons, and keyboard navigation. */
export function wireControls({ dom, state, hooks }) {
    const { regions, results, details, input, zoomIn, zoomOut, fitAll, centreMe, tidyBtn, stage } = dom;
    const { s, getBox, getLimits } = state;
    const { listen, api, setLayer, showDetails, chooseHit, runSearch, places, goTo, stopAnimation, measure, setView, fitNow } = hooks;

    listen(regions, 'change', () => {
        const id = regions.value === 'all' ? ALL : regions.value;
        if (id !== s.layer) setLayer(id);
    });
    listen(results, 'click', event => {
        const choose = closestWith(event.target, results, node => node.getAttribute?.('data-id'));
        if (choose) chooseHit(choose.getAttribute('data-id'));
    });
    listen(details, 'click', event => {
        if (closestWith(event.target, details, node => node.classList?.contains('sd-map-close'))) showDetails('');
        const kid = closestWith(event.target, details, node => node.classList?.contains('sd-map-inside-item'));
        if (kid) chooseHit(kid.getAttribute('data-id'));
    });
    listen(input, 'input', runSearch);
    listen(input, 'keydown', event => {
        if (event.key === 'Enter' && places.hits.length) {
            event.preventDefault?.();
            chooseHit(places.hits[0].id);
        } else if (event.key === 'Escape') {
            input.value = '';
            runSearch();
        } else if (event.key === 'ArrowDown' && places.hits.length) {
            event.preventDefault?.();
            results.querySelector('.sd-map-result')?.focus?.();
        }
    });

    const zoomCentre = factor => {
        stopAnimation();
        measure();
        setView(zoomAt(s.view, factor, s.size.width / 2, s.size.height / 2, s.size.width, s.size.height, getBox(), getLimits()));
    };
    const fit = () => {
        stopAnimation();
        setView(fitNow());
    };
    const toMe = () => {
        if (s.data.current) goTo(s.data.current);
    };
    listen(zoomIn, 'click', () => zoomCentre(BUTTON_ZOOM));
    listen(zoomOut, 'click', () => zoomCentre(1 / BUTTON_ZOOM));
    listen(fitAll, 'click', fit);
    listen(centreMe, 'click', toMe);
    listen(tidyBtn, 'click', () => {
        tidyBtn.hidden = true;
        try {
            const out = typeof api?.command === 'function' ? api.command('atlas.edit', { tidy: true }) : null;
            if (out && typeof out.catch === 'function') out.catch(() => {});
        } catch { /* a click never breaks the map */ }
    });

    listen(stage, 'keydown', event => {
        const step = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
        if (step) {
            stopAnimation();
            measure();
            setView(panBy(s.view, step[0] * s.size.width * KEY_PAN, step[1] * s.size.height * KEY_PAN, getBox(), getLimits()));
        } else if (event.key === '+' || event.key === '=') zoomCentre(BUTTON_ZOOM);
        else if (event.key === '-' || event.key === '_') zoomCentre(1 / BUTTON_ZOOM);
        else if (event.key === '0' || event.key === 'Home') fit();
        else if (event.key === 'Escape' && s.picked) showDetails('');
        else return;
        event.preventDefault?.();
    });
}
