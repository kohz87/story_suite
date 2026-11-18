// The Dry run result's Holds, Curves and Cast tabs: the runs of days each condition held, the power and score curves, and the cast's moves and deaths.

import { h, svgEl } from '../../../ui/kit/dom.js';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const row = (cls, title, sub, ctl = null, data = {}) => h('div', { class: `srow ${cls}`, dataset: data }, h('div', { class: 'lb' }, h('b', title), sub ? h('small', sub) : null), ctl);
const group = (cls, title, ...children) => h('section', { class: `sgrp ${cls}` }, h('div', { class: 'gt' }, title), ...children);
const castName = (doc, id) => (doc?.content?.cast ?? []).find(person => person?.id === id)?.name ?? id;

/** The runs of days each condition held: [[name, [[from, to], ...]], ...] sorted by name. */
export function holdSpans(rows) {
    const spans = new Map();
    for (const day of rows) for (const name of day.held) {
        const list = spans.get(name) ?? [];
        const last = list.at(-1);
        if (last && last[1] === day.day - 1) last[1] = day.day; else list.push([day.day, day.day]);
        spans.set(name, list);
    }
    return [...spans].sort(([a], [b]) => a.localeCompare(b));
}

export function holdsGroup(rows, days) {
    const spans = holdSpans(rows);
    if (!spans.length) return group('st-dry-holds', 'Condition holds', row('st-dry-quiet', 'No condition held.', 'No condition was set on any day of the run.'));
    return group('st-dry-holds', `Condition holds · ${spans.length}`, spans.map(([name, list]) => {
        const total = list.reduce((sum, [from, to]) => sum + to - from + 1, 0);
        const bar = h('div', { class: 'st-holdbar', role: 'img', 'aria-label': `${name}: held ${plural(total, 'day')}` },
            list.map(([from, to]) => h('span', { style: { left: `${((from - 1) / days) * 100}%`, width: `${((to - from + 1) / days) * 100}%` } })));
        return h('div', { class: 'srow wide st-hold', dataset: { name } }, h('div', { class: 'lb' }, h('b', name),
            h('small', `${plural(total, 'day')} held: ${list.map(([from, to]) => (from === to ? `day ${from}` : `days ${from}–${to}`)).join(', ')}`)), bar);
    }));
}

export function curvesGroup(ctx, rows) {
    const keys = [...new Set(rows.flatMap(day => Object.keys(day.standings ?? {})))].sort();
    if (!keys.length) return group('st-dry-curves', 'Powers and scores', row('st-dry-quiet', 'No power or score moved.', 'The pack has no powers or scores to follow.'));
    return group('st-dry-curves', `Powers and scores · ${keys.length}`, keys.map(key => {
        const values = rows.map(day => Number(day.standings?.[key] ?? NaN)).map((value, at, all) => (Number.isFinite(value) ? value : (all[at - 1] ?? 0)));
        const [low, high] = [Math.min(...values), Math.max(...values)];
        const span = high - low || 1;
        const points = values.map((value, at) => `${at},${(high === low ? 15 : 29 - ((value - low) / span) * 28).toFixed(2)}`).join(' ');
        const chart = svgEl('svg', { class: 'st-curve', viewBox: `0 0 ${Math.max(values.length - 1, 1)} 30`, preserveAspectRatio: 'none', role: 'img', 'aria-label': `${key} over the run` },
            svgEl('polyline', { points, fill: 'none', 'vector-effect': 'non-scaling-stroke' }));
        const [kind, id] = key.includes(':') ? [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)] : ['', key];
        const name = (ctx.doc?.content?.[kind === 'score' ? 'scores' : 'powers'] ?? []).find(item => item?.id === id || item?.name === id)?.name ?? id;
        return h('div', { class: 'srow wide st-stand', dataset: { key, kind } }, h('div', { class: 'lb' }, h('b', name),
            h('small', `${kind === 'score' ? 'Score' : 'Power'} · day 1: ${values[0]} · day ${values.length}: ${values.at(-1)} · low ${low} · high ${high}`)), chart);
    }));
}

/** `castGroup(ctx, rows, goButton, castTarget)`: the moves and deaths, each with Go to into the cast record. */
export function castGroup(ctx, rows, goButton, castTarget) {
    const moves = rows.flatMap(day => day.moves.map(move => ({ day: day.day, kind: 'move', id: move.id, text: `goes to ${move.to}${move.routine ? `: ${move.routine}` : ''}` })));
    const deaths = rows.flatMap(day => day.deaths.map(death => ({ day: day.day, kind: 'death', id: death.id, text: `dies (${death.by})` })));
    const all = [...moves, ...deaths].sort((a, b) => a.day - b.day);
    const title = `The cast · ${plural(moves.length, 'move')} · ${plural(deaths.length, 'death')}`;
    if (!all.length) return group('st-dry-cast', title, row('st-dry-quiet', 'No one moved or died.', 'The cast stayed where the pack starts them.'));
    return group('st-dry-cast', title, all.map(item => row('st-cast', `Day ${item.day} · ${castName(ctx.doc, item.id)} ${item.text}`, null,
        h('div', { class: 'ctl' }, goButton(ctx, castTarget(ctx.doc, item.id), 'Go to ›')), { kind: item.kind })));
}
