// The Dry run's Holds tab (MK-5): one row per condition at a place, with the runs of days it held drawn as bars on a ruler of the run, the 15 first by
// default (Show all), or one row per condition (By condition) with its places named.

import { h } from '../../../ui/kit/dom.js';

const SHOWN = 15;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const group = (title, ...children) => h('section', { class: 'sgrp st-dry-holds' }, h('div', { class: 'gt' }, title), ...children);
const rangeText = ([from, to]) => (from === to ? `day ${from}` : `days ${from}–${to}`);

/** `holdRuns(rows)` → `[{ name, place, runs: [[from, to], ...] }]` sorted by first day: each "condition@place" in the rows' `heldAt` (else its `held` names, with no place) and the runs of days it held. */
export function holdRuns(rows) {
    const seen = new Map();
    for (const day of rows) for (const key of day.heldAt ?? day.held ?? []) {
        const at = String(key).indexOf('@');
        const entry = seen.get(key) ?? { name: at < 0 ? key : key.slice(0, at), place: at < 0 ? '' : key.slice(at + 1), runs: [] };
        const last = entry.runs.at(-1);
        if (last && last[1] === day.day - 1) last[1] = day.day; else entry.runs.push([day.day, day.day]);
        seen.set(key, entry);
    }
    return [...seen.values()];
}

const merged = entries => {
    const byName = new Map();
    for (const { name, place, runs } of entries) {
        const row = byName.get(name) ?? { name, place: '', places: new Set(), runs: [] };
        if (place) row.places.add(place);
        row.runs.push(...runs);
        byName.set(name, row);
    }
    return [...byName.values()].map(row => {
        const days = [...new Set(row.runs.flatMap(([from, to]) => Array.from({ length: to - from + 1 }, (_, at) => from + at)))].sort((a, b) => a - b);
        const runs = days.reduce((out, day) => { if (out.at(-1)?.[1] === day - 1) out.at(-1)[1] = day; else out.push([day, day]); return out; }, []);
        return { ...row, runs, places: row.places.size };
    });
};

/** `holdsGroup(st, rows, days, date)`: `st` carries `holdsAll` and `holdsBy` (the page redraws through `st.redraw`); `date(day)` is the day's date or ''. */
export function holdsGroup(st, rows, days, date) {
    const all = holdRuns(rows);
    if (!all.length) return group('Condition holds', h('div', { class: 'srow st-dry-quiet' }, h('div', { class: 'lb' }, h('b', 'No condition held.'), h('small', 'No condition was set on any day of the run.'))));
    const byName = st.holdsBy === 'condition';
    const entries = byName ? merged(all) : all;
    const names = new Set(all.map(entry => entry.name));
    const most = [...names].map(name => [name, all.filter(entry => entry.name === name).reduce((sum, entry) => sum + entry.runs.length, 0)]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);
    const shown = st.holdsAll ? entries : entries.slice(0, SHOWN);
    const stamp = day => date(day) || `day ${day}`;
    const ruler = h('div', { class: 'st-ruler', 'aria-hidden': 'true' }, h('i'), h('div', { class: 'st-rule' }, [0, 1, 2].map(at => h('span', { style: { left: `${(at / 3) * 100}%` } }, stamp(Math.max(1, Math.round((days * at) / 3) + 1))))), h('i'));
    const rowsOut = shown.map(({ name, place, places, runs }) => {
        const total = runs.reduce((sum, [from, to]) => sum + to - from + 1, 0);
        const label = byName ? `held at ${plural(places, 'place')}` : '';
        const bar = h('div', { class: 'st-holdbar', role: 'img', 'aria-label': `${name}${place ? ` at ${place}` : ''}: held ${plural(total, 'day')}` },
            runs.map(([from, to]) => h('span', { class: from === 1 ? 'st-begin' : '', style: { left: `${((from - 1) / days) * 100}%`, width: `${((to - from + 1) / days) * 100}%` } })));
        return h('div', { class: 'srow wide st-hold', dataset: { name, place } }, h('div', { class: 'lb' }, h('b', name), place ? h('span', { class: 'st-holdat' }, ` at ${place}`) : null,
            h('small', `first ${stamp(runs[0][0])}${label ? ` · ${label}` : ''}${runs.length > 1 ? ` · ${plural(runs.length, 'time')}: ${runs.map(rangeText).join(', ')}` : ''}`)), bar, h('span', { class: 'st-hdays' }, plural(total, 'day')));
    });
    const more = entries.length > SHOWN ? h('button', { type: 'button', class: 'btn2 st-dry-holdsall', onClick: () => { st.holdsAll = !st.holdsAll; st.redraw(); } }, st.holdsAll ? `Show the first ${SHOWN}` : `Show all ${entries.length}`) : null;
    const by = h('button', { type: 'button', class: 'btn2 st-dry-holdsby', onClick: () => { st.holdsBy = byName ? 'place' : 'condition'; st.redraw(); } }, byName ? 'By condition at a place' : 'By condition');
    return group(`Condition holds · ${all.length}`, h('div', { class: 'st-hsum' }, h('b', `${plural(all.length, 'hold')} of ${plural(names.size, 'condition')}, in the order they began`),
        h('small', `Most held: ${most.map(([name, n]) => `${name} ${n}`).join(' · ')}`)),
        h('div', { class: 'st-legend' }, h('span', { class: 'st-key' }, 'set by an event or template'), h('span', { class: 'st-key st-begin' }, 'set by the world’s Start')),
        ruler, rowsOut, h('div', { class: 'addrow' }, more, by));
}
