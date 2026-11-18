// The Dry run's Curves tab (MK-5): a plot card for each score and power that moved (its value day by day as a step line, where it started dashed,
// the first and last value, the number of changes and the biggest), and the ones that did not move listed under them.

import { h, svgEl } from '../../../ui/kit/dom.js';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const signed = n => (n > 0 ? `+${n}` : String(n));
const W = 300, H = 90;

/** `standings(rows, kind)` → `[{ key, id, values }]` for the keys of that kind (`power:` or `score:`), values per day with a missing day carrying the one before it. */
function standings(rows, kind) {
    const keys = [...new Set(rows.flatMap(day => Object.keys(day.standings ?? {})))].filter(key => (key.includes(':') ? key.startsWith(`${kind}:`) : kind === 'power')).sort();
    return keys.map(key => ({ key, id: key.includes(':') ? key.slice(kind.length + 1) : key, values: rows.map(day => Number(day.standings?.[key] ?? NaN)).map((value, at, all) => (Number.isFinite(value) ? value : (all[at - 1] ?? 0))) }));
}

function plot(values, name) {
    const [low, high] = [Math.min(...values), Math.max(...values)];
    const y = value => (high === low ? H / 2 : H - 6 - ((value - low) / (high - low)) * (H - 12));
    const x = at => (values.length < 2 ? 0 : (at / (values.length - 1)) * W);
    const path = values.map((value, at) => `${at ? `H${x(at).toFixed(1)} V${y(value).toFixed(1)}` : `M0 ${y(value).toFixed(1)}`}`).join(' ');
    return svgEl('svg', { class: 'st-curve', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': `${name} over the run` },
        svgEl('line', { class: 'st-first', x1: 0, x2: W, y1: y(values[0]), y2: y(values[0]), 'vector-effect': 'non-scaling-stroke' }),
        svgEl('path', { d: path, fill: 'none', 'vector-effect': 'non-scaling-stroke' }));
}

function card(ctx, date, kind, { key, id, values }) {
    const item = (ctx.doc?.content?.[kind === 'score' ? 'scores' : 'powers'] ?? []).find(it => it?.id === id || it?.name === id);
    const name = item?.name ?? id;
    const steps = values.map((value, at) => [at, value - (values[at - 1] ?? value)]).filter(([, delta]) => delta !== 0);
    const [first, last] = [values[0], values.at(-1)];
    const big = steps.reduce((best, step) => (Math.abs(step[1]) > Math.abs(best?.[1] ?? 0) ? step : best), null);
    const cap = steps.length ? `${plural(steps.length, 'change')} · biggest ${signed(big[1])} on ${date(big[0] + 1) || `day ${big[0] + 1}`}` : 'No change';
    return h('div', { class: 'st-plot st-stand', dataset: { key, kind, moved: String(steps.length > 0) } },
        h('div', { class: 'st-plothead' }, h('b', name), h('span', { class: `st-delta ${last > first ? 'up' : last < first ? 'down' : ''}` }, `${first} → ${last}`)),
        plot(values, name), h('div', { class: 'st-axis' }, h('span', date(1) || 'day 1'), h('span', date(values.length) || `day ${values.length}`)),
        h('small', `${kind === 'score' ? 'Score' : 'Power'} · ${cap} · low ${Math.min(...values)} · high ${Math.max(...values)}`));
}

/** `curvesGroup(ctx, rows, date)`: the Scores and Powers sections; `date(day)` is the day's date or ''. */
export function curvesGroup(ctx, rows, date) {
    const sets = [['score', 'Scores'], ['power', 'Powers']].map(([kind, title]) => [kind, title, standings(rows, kind)]).filter(([, , list]) => list.length);
    if (!sets.length) return [h('section', { class: 'sgrp st-dry-curves' }, h('div', { class: 'gt' }, 'Powers and scores'), h('div', { class: 'srow st-dry-quiet' }, h('div', { class: 'lb' }, h('b', 'No power or score moved.'), h('small', 'The pack has no powers or scores to follow.'))))];
    return sets.map(([kind, title, list]) => {
        const moved = list.filter(({ values }) => values.some(value => value !== values[0]));
        const still = list.filter(item => !moved.includes(item));
        const nameOf = item => (ctx.doc?.content?.[kind === 'score' ? 'scores' : 'powers'] ?? []).find(it => it?.id === item.id || it?.name === item.id)?.name ?? item.id;
        return h('section', { class: `sgrp st-dry-curves st-dry-${kind}s` }, h('div', { class: 'gt' }, `${title} · ${list.length} · ${moved.length} moved`),
            h('div', { class: 'st-plots' }, moved.map(item => card(ctx, date, kind, item))),
            still.length ? h('div', { class: 'st-still' }, h('b', `${still.length} did not move`), h('small', still.map(item => `${nameOf(item)} (${item.values[0]})`).join(', '))) : null);
    });
}
