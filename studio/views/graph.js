// The event graph page (views/route.js PAGES; the "List · Graph" segment at the top of Events; mock MK-4). Events and conditions are boxes and the
// lines between them come from the reference index (model/refs.js), so the graph needs no events editor: an event sets or clears a condition,
// and what an event requires, waits for (window.after: "not before"), is pre-empted by ("not after") or is likelier with points at it. Lines run in
// story order, from what comes first to what follows. The graph is drawn around one centre, one or two steps out; a column shows 7 boxes and folds
// the rest into "+ n more". A narrow screen gets the same graph as lists: before it, the centre, after it. The page's view (centre, steps, the
// lines shown, the way back) lives in ctx.keep('graph'), so it outlives the redraw after a change.

import { h, svgEl } from '../../ui/kit/dom.js';
import { openPicker } from '../form/pick.js';
import { partOfPath } from '../parts.js';

/** The line types: [type, label]; the roles of model/refs.js that draw each. */
export const LINES = Object.freeze([['sets', 'Sets'], ['clears', 'Clears'], ['requires', 'Requires'], ['before', 'Not before'], ['after', 'Not after'], ['likelier', 'Likelier if']]);
const ROLE = { set: 'sets', clear: 'clears', requires: 'requires', on: 'requires', after: 'before', 'pre-empt': 'after', likelier: 'likelier' };
const LABEL = Object.fromEntries(LINES);
const ICON = { event: '✦', condition: '◐' };
const FOLD = 7;
const W = 196, H = 54, GX = 50, GY = 22, PAD = 18, ARC = 60;
const cache = new WeakMap();
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const getAt = (root, path) => path.reduce((node, key) => (node !== null && typeof node === 'object' ? node[key] : undefined), root);

function eventSub(record) {
    const outcomes = Array.isArray(record?.outcomes) ? record.outcomes.length : 0;
    return [(record?.kind === 'chain-stage' ? 'chain stage' : String(record?.kind ?? 'event')), outcomes ? plural(outcomes, 'outcome') : null].filter(Boolean).join(' · ');
}

/**
 * The whole graph of a pack: `{ nodes: Map<key, { key, kind, id, rec, path, sub, missing? }>, edges: [{ from, to, type, raw, words }], degree: Map }`,
 * keys "event:<id>" and "condition:<id>". `refs` is the reference index of `pack` (a plain pack). Built once per index.
 */
export function graphOf(refs, pack) {
    if (refs && cache.has(refs)) return cache.get(refs);
    const nodes = new Map();
    for (const def of refs?.defs?.event ?? []) nodes.set(`event:${def.id}`, { key: `event:${def.id}`, kind: 'event', id: def.id, rec: def.rec, path: def.path, sub: eventSub(getAt(pack, def.path?.slice(0, -1) ?? [])) });
    for (const def of refs?.defs?.condition ?? []) {
        const record = getAt(pack, def.path?.slice(0, -1) ?? []);
        nodes.set(`condition:${def.id}`, { key: `condition:${def.id}`, kind: 'condition', id: def.id, rec: def.rec, path: def.path, sub: ['condition', record?.scope].filter(Boolean).join(' · ') });
    }
    const edges = [];
    const seen = new Set();
    for (const use of refs?.uses ?? []) {
        const type = ROLE[use.role];
        if (!type || use.pack === 'other' || use.owner?.part !== 'worldEvents' || typeof use.owner.id !== 'string' || !['event', 'condition'].includes(use.kind)) continue;
        const own = `event:${use.owner.id}`;
        const other = `${use.kind}:${use.id}`;
        if (!nodes.has(other)) nodes.set(other, { key: other, kind: use.kind, id: use.id, missing: true, sub: 'not in this pack' });
        const [from, to] = type === 'sets' || type === 'clears' ? [own, other] : [other, own];
        const raw = use.form === 'key' ? String(use.path.at(-1)) : String(getAt(pack, use.path) ?? '');
        if (from === to || seen.has(`${from}>${to}>${type}`) || !nodes.has(own)) continue;
        seen.add(`${from}>${to}>${type}`);
        edges.push({ from, to, type, raw, words: `${use.owner.id} · ${LABEL[type].toLowerCase()}: ${raw}` });
    }
    const degree = new Map();
    for (const edge of edges) for (const end of [edge.from, edge.to]) degree.set(end, (degree.get(end) ?? 0) + 1);
    const graph = { nodes, edges, degree };
    if (refs) cache.set(refs, graph);
    return graph;
}

/**
 * The part of the graph around `centre`, `steps` (1 or 2) lines out over the lines whose type is in `types`: `{ cols: Map<key, column>, edges }`.
 * The centre is column 0, what comes before it is to the left and what follows to the right; a box that follows another shown box sits right of it.
 */
export function around(graph, centre, steps, types) {
    const edges = graph.edges.filter(edge => types.has(edge.type));
    const cols = new Map([[centre, 0]]);
    let frontier = [centre];
    for (let step = 0; step < steps; step++) {
        const next = [];
        for (const edge of edges) for (const [at, far, dir] of [[edge.from, edge.to, 1], [edge.to, edge.from, -1]]) {
            if (!frontier.includes(at) || cols.has(far)) continue;
            cols.set(far, cols.get(at) + dir);
            next.push(far);
        }
        frontier = next;
    }
    const shown = edges.filter(edge => cols.has(edge.from) && cols.has(edge.to));
    // a box after another shown box (or before one) moves one column further out, a few rounds at most (a loop of events stops there)
    for (let round = 0; round < cols.size; round++) {
        let moved = false;
        for (const { from, to } of shown) {
            if (to !== centre && cols.get(to) > 0 && cols.get(from) >= 0 && cols.get(to) <= cols.get(from) && cols.get(from) < steps + 2) { cols.set(to, cols.get(from) + 1); moved = true; }
            if (from !== centre && cols.get(from) < 0 && cols.get(to) <= 0 && cols.get(from) >= cols.get(to) && cols.get(to) > -steps - 2) { cols.set(from, cols.get(to) - 1); moved = true; }
        }
        if (!moved) break;
    }
    return { cols, edges: shown };
}

function nodeBox(node, ctx, view, redraw, extra = {}) {
    const centre = view.centre === node.key;
    const open = () => openRecord(node, ctx);
    return h('div', { class: ['st-gnode', `st-g${node.kind}`, centre && 'st-gcur', node.missing && 'st-gmiss'], dataset: { node: node.key }, style: extra.style ?? null },
        h('button', { type: 'button', class: 'st-gopen', disabled: node.missing ? true : null, 'aria-label': `Open ${node.id}`, onClick: open },
            h('b', node.kind === 'condition' ? `${ICON.condition} ${node.id}` : node.id), h('small', extra.sub ?? node.sub)),
        centre ? null : h('button', { type: 'button', class: 'st-gcentre', 'aria-label': `Centre the graph on ${node.id}`, title: 'Centre the graph on it', onClick: () => recentre(view, node.key, redraw) }, '◎'));
}

// Opens a box's record: an event shows in the Events list (the segment goes back to List first), a condition in Conditions.
function openRecord(node, ctx) {
    if (node.missing || !node.path) return;
    const at = partOfPath(`content.${node.rec.replace('.', '[')}]`, ctx.kind);
    if (node.kind === 'event') globalThis.document?.querySelector?.('.st-seg [data-view="list"]')?.click?.();
    ctx.go(at.part, at.rec ?? node.rec);
}

function recentre(view, key, redraw) {
    if (view.centre === key) return;
    if (view.centre) view.back = [...(view.back ?? []), view.centre].slice(-20);
    view.centre = key;
    view.more = {};
    redraw();
}

function pickCentre(graph, view, redraw) {
    const items = [...graph.nodes.values()].filter(node => !node.missing).map(node => ({ id: node.key, label: node.id, icon: ICON[node.kind], tag: node.kind === 'event' ? node.sub.split(' · ')[0] : 'condition', sub: plural(graph.degree.get(node.key) ?? 0, 'line') }));
    openPicker({}, { title: 'Centre the graph on', items, search: 'Find an event or a condition' }, key => recentre(view, key, redraw));
}

// The wide view: columns of boxes and the lines between them, in one scrolling box.
function wide(graph, part, view, ctx, redraw) {
    const byCol = new Map();
    for (const [key, col] of part.cols) byCol.set(col, [...(byCol.get(col) ?? []), key]);
    const order = [...byCol.keys()].sort((a, b) => a - b);
    const slots = new Map();
    const folds = [];
    for (const col of order) {
        let keys = byCol.get(col);
        if (col === 0) keys = [view.centre, ...keys.filter(key => key !== view.centre)];
        const hidden = keys.length > FOLD && !view.more?.[col] ? keys.length - (FOLD - 1) : 0;
        const kept = hidden ? keys.slice(0, FOLD - 1) : keys;
        kept.forEach((key, row) => slots.set(key, { col, row, of: kept.length + (hidden ? 1 : 0) }));
        if (hidden) folds.push({ col, row: kept.length, of: kept.length + 1, hidden });
    }
    const tall = Math.max(...[...slots.values(), ...folds].map(slot => slot.of));
    const drawn = part.edges.filter(edge => slots.has(edge.from) && slots.has(edge.to));
    // a line between two boxes of one column bends out to their left, so that column needs room there
    const left = drawn.some(edge => slots.get(edge.from).col === slots.get(edge.to).col) ? ARC : PAD;
    const x = col => left + (col - order[0]) * (W + GX);
    const y = slot => PAD + ((tall - slot.of) * (H + GY)) / 2 + slot.row * (H + GY);
    const width = left + PAD + order.length * W + (order.length - 1) * GX;
    const height = PAD * 2 + tall * H + (tall - 1) * GY;
    const at = (left, top) => ({ left: `${left}px`, top: `${top}px`, width: `${W}px`, height: `${H}px` });
    const lines = drawn.map(edge => {
        const a = slots.get(edge.from), b = slots.get(edge.to);
        const ay = y(a) + H / 2, by = y(b) + H / 2;
        let d;
        if (a.col === b.col) d = `M${x(a.col)} ${ay} C${x(a.col) - 44} ${ay} ${x(b.col) - 44} ${by} ${x(b.col)} ${by}`;
        else if (a.col < b.col) { const ax = x(a.col) + W, bx = x(b.col), mid = (ax + bx) / 2; d = `M${ax} ${ay} C${mid} ${ay} ${mid} ${by} ${bx} ${by}`; }
        else { const ax = x(a.col) + W, bx = x(b.col); d = `M${ax} ${ay} C${ax + 40} ${ay - 70} ${bx - 40} ${by - 70} ${bx} ${by}`; }
        return svgEl('path', { d, class: `st-gl st-gl-${edge.type}`, 'marker-end': `url(#st-gm-${edge.type})`, dataset: { from: edge.from, to: edge.to, type: edge.type } }, svgEl('title', edge.words));
    });
    const defs = svgEl('defs', ...LINES.map(([type]) => svgEl('marker', { id: `st-gm-${type}`, class: `st-gm st-gl-${type}`, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' },
        svgEl('path', { d: 'M0 0 L10 5 L0 10 z' }))));
    const svg = svgEl('svg', { class: 'st-glines', width: String(width), height: String(height), viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' }, defs, ...lines);
    const boxes = [...slots].map(([key, slot]) => nodeBox(graph.nodes.get(key), ctx, view, redraw, { style: at(x(slot.col), y(slot)) }));
    const more = folds.map(fold => h('button', { type: 'button', class: 'st-gmore', style: at(x(fold.col), y(fold)), onClick: () => { view.more = { ...view.more, [fold.col]: true }; redraw(); } },
        h('b', `+ ${fold.hidden} more`), h('small', `${fold.col < 0 ? 'that lead to it' : fold.col > 0 ? 'that follow it' : 'beside it'} · show`)));
    const canvas = h('div', { class: 'st-gcanvas', style: { width: `${width}px`, height: `${height}px` } }, svg, ...boxes, ...more);
    const scroller = h('div', { class: 'st-gscroll', tabindex: '0', 'aria-label': 'The event graph' }, canvas);
    dragScroll(scroller);
    // it opens on the centre
    const centre = slots.get(view.centre);
    globalThis.requestAnimationFrame?.(() => { scroller.scrollLeft = Math.max(0, x(centre.col) + W / 2 - (scroller.clientWidth ?? 0) / 2); });
    const notes = [folds.length ? h('p', { class: 'fine' }, `A column shows ${FOLD} boxes; the rest fold into "+ n more" until you open it.`) : null,
        order.length > 4 ? h('p', { class: 'fine st-gsize' }, `${plural(slots.size, 'box', 'boxes')}, ${plural(lines.length, 'line')}. Wider than the page: it opens on the centre and scrolls sideways (drag, or Shift+wheel).`) : null];
    return h('div', { class: 'st-gwide' }, scroller, ...notes);
}

function dragScroll(el) {
    let from = null;
    el.addEventListener('pointerdown', event => { if (event.target?.closest?.('button')) return; from = { x: event.clientX, left: el.scrollLeft }; });
    el.addEventListener('pointermove', event => { if (from) el.scrollLeft = from.left - (event.clientX - from.x); });
    for (const end of ['pointerup', 'pointerleave']) el.addEventListener(end, () => { from = null; });
}

// The narrow view: before it, the centre, after it, each box with the lines that join it to the centre.
function narrow(graph, part, view, ctx, redraw) {
    const centre = graph.nodes.get(view.centre);
    const tie = key => part.edges.filter(edge => (edge.from === key && edge.to === view.centre) || (edge.to === key && edge.from === view.centre));
    const chip = edge => h('span', { class: `tg2 st-gchip st-gl-${edge.type}` }, LABEL[edge.type], edge.type === 'before' && / \+ (.+)$/.test(edge.raw) ? ` +${/ \+ (.+)$/.exec(edge.raw)[1]}` : null);
    const group = (title, keys) => h('section', { class: 'sgrp st-gside' }, h('div', { class: 'gt' }, `${title} · ${keys.length}`),
        ...keys.map(key => {
            const node = graph.nodes.get(key);
            const lines = tie(key);
            return h('div', { class: 'srow st-grow', dataset: { node: key } },
                h('span', { class: 'lb' }, h('b', node.kind === 'condition' ? `${ICON.condition} ${node.id}` : node.id), h('small', node.sub),
                    h('span', { class: 'st-gchips' }, ...(lines.length ? lines.map(chip) : [h('span', { class: 'tg2' }, 'two steps out')]))),
                h('span', { class: 'ctl' }, node.missing ? null : h('button', { type: 'button', class: 'btn2 st-gopen', onClick: () => openRecord(node, ctx) }, 'Open'),
                    h('button', { type: 'button', class: 'btn2 st-gcentre', 'aria-label': `Centre the graph on ${node.id}`, onClick: () => recentre(view, key, redraw) }, '◎')));
        }));
    const keys = [...part.cols].filter(([key]) => key !== view.centre).sort((a, b) => a[1] - b[1]).map(([key]) => key);
    const before = keys.filter(key => part.cols.get(key) < 0);
    const after = keys.filter(key => part.cols.get(key) >= 0);
    const own = part.edges.filter(edge => edge.from === view.centre || edge.to === view.centre).length;
    const others = part.edges.length - own;
    return h('div', { class: 'st-glist' },
        before.length ? group('Before it', before) : null,
        h('section', { class: 'sgrp st-gcentrecard' }, h('div', { class: 'gt' }, 'Centre'),
            h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', centre.id), h('small', `${centre.sub} · ${plural(graph.degree.get(view.centre) ?? 0, 'line')} in all`)),
                centre.missing ? null : h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-gopen', onClick: () => openRecord(centre, ctx) }, 'Open its record ›')))),
        after.length ? group('After it', after) : null,
        others ? h('p', { class: 'fine' }, `${plural(others, 'more line joins', 'more lines join')} these to each other; a wider screen draws them.`) : null);
}

// No centre yet: pick one, or one of the most linked.
function startCard(graph, view, redraw) {
    const top = [...graph.nodes.values()].filter(node => !node.missing && graph.degree.get(node.key)).sort((a, b) => graph.degree.get(b.key) - graph.degree.get(a.key)).slice(0, 6);
    return h('section', { class: 'sgrp st-gstart' }, h('div', { class: 'gt' }, 'Centre the graph'),
        h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', 'Pick an event or a condition'), h('small', 'The graph shows what leads to it and what follows, one or two steps out.')),
            h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 pri st-gpick', onClick: () => pickCentre(graph, view, redraw) }, 'Pick…'))),
        top.length ? h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('b', 'Most linked'), h('small', 'Lines in all, of every kind')),
            h('span', { class: 'ctl st-gtop' }, ...top.map(node => h('button', { type: 'button', class: 'btn2 st-gtopbtn', dataset: { node: node.key }, onClick: () => recentre(view, node.key, redraw) },
                `${ICON[node.kind]} ${node.id}`, h('small', ` ${graph.degree.get(node.key)}`))))) : null);
}

function toolbar(graph, part, view, redraw, all) {
    const centre = graph.nodes.get(view.centre);
    const steps = h('div', { class: 'sseg2 st-gsteps', role: 'group', 'aria-label': 'How far out' }, ...[1, 2].map(n => h('button', { type: 'button', 'aria-pressed': String(view.steps === n), dataset: { steps: String(n) },
        onClick: () => { view.steps = n; redraw(); } }, n === 1 ? '1 step' : '2 steps')));
    const back = h('button', { type: 'button', class: 'btn2 st-gback', disabled: view.back?.length ? null : true, onClick: () => { view.centre = view.back.pop(); view.more = {}; redraw(); } }, '‹ Back');
    const counts = Object.fromEntries(LINES.map(([type]) => [type, all.edges.filter(edge => edge.type === type).length]));
    const chips = LINES.map(([type, label]) => h('button', { type: 'button', class: `tg2 st-gtype st-gl-${type}`, dataset: { type }, 'aria-pressed': String(!view.off?.[type]),
        onClick: () => { view.off = { ...view.off, [type]: !view.off?.[type] }; redraw(); } }, h('i', { class: 'st-gkey', 'aria-hidden': 'true' }), `${label} · ${counts[type]}`));
    const off = LINES.filter(([type]) => view.off?.[type]);
    const lost = all.edges.length - part.edges.length;
    return [h('div', { class: 'st-gbar' }, h('span', { class: 'st-glabel' }, 'Centre'),
        h('button', { type: 'button', class: 'btn2 st-gpick', 'aria-label': 'Pick the centre', onClick: () => pickCentre(graph, view, redraw) }, `${ICON[centre.kind]} ${centre.id} ▾`), steps, h('span', { class: 'gap' }), back),
    h('div', { class: 'st-gbar st-gtypes' }, h('span', { class: 'st-glabel' }, 'Lines'), ...chips),
    off.length ? h('p', { class: 'fine st-goff' }, `${off.map(([, label]) => label).join(', ')} ${off.length === 1 ? 'is' : 'are'} off: ${plural(lost, 'line is', 'lines are')} hidden. `,
        h('button', { type: 'button', class: 'lnk st-gall', onClick: () => { view.off = {}; redraw(); } }, 'Show every line')) : null];
}

/** `ctx`: the page context (views/route.js). Returns the graph page for a world pack, or none (the Graph segment is not mounted). */
export function renderPage(ctx) {
    // ctx.doc is the parsed pack (a test may hand the Studio document, { doc })
    const pack = ctx.doc?.content ? ctx.doc : ctx.doc?.doc;
    if (ctx.kind !== 'world' || !pack?.content || ctx.legacy) return [];
    const graph = graphOf(ctx.refs, pack);
    const view = ctx.keep?.('graph') ?? {};
    view.steps ??= 1;
    // an event or condition opened elsewhere centres the graph once
    const focus = /^(worldEvents|conditions)\.\d+$/.test(ctx.focus?.rec ?? '') ? ctx.focus.rec : null;
    const focused = focus && [...graph.nodes.values()].find(node => node.rec === focus);
    if (focused && view.focused !== focus) { view.focused = focus; recentre(view, focused.key, () => {}); }
    if (view.centre && !graph.nodes.has(view.centre)) view.centre = null;
    const root = h('div', { class: 'st-graph' });
    const draw = () => {
        if (!(pack.content?.worldEvents ?? []).length) {
            return root.replaceChildren(h('section', { class: 'sgrp st-gempty' }, h('div', { class: 'gt' }, 'Graph'),
                h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', 'No events yet.'), h('small', 'Add one in the list; the graph draws events, the conditions they set and clear, and how they follow each other.')),
                    h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-glist-go', onClick: () => globalThis.document?.querySelector?.('.st-seg [data-view="list"]')?.click?.() }, 'List ›')))));
        }
        if (!view.centre) return root.replaceChildren(startCard(graph, view, draw));
        const types = new Set(LINES.map(([type]) => type).filter(type => !view.off?.[type]));
        const all = around(graph, view.centre, view.steps, new Set(LINES.map(([type]) => type)));
        const part = around(graph, view.centre, view.steps, types);
        return root.replaceChildren(...toolbar(graph, part, view, draw, all).filter(Boolean), wide(graph, part, view, ctx, draw), narrow(graph, part, view, ctx, draw),
            h('p', { class: 'fine st-gfoot' }, 'Lines run in story order: from what comes first to what follows. Tap a box to open its record · ◎ centres the graph on it · hover a line for its words.'));
    };
    draw();
    return [root];
}
