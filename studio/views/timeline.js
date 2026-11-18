// The Dry run page (views/route.js PAGES; a part in the Check group for a format 4 world pack; the MK-5 description): a seed, tempo and
// days form; Run, which steps the world engine's daily step in a Worker (studio/dryrun/run.js) on the pack as written, with the open game
// pack's calendar or the built-in one; and the result: a summary with the engine's warnings, a timeline by day, the condition holds, the
// power and score curves, and the cast's moves and deaths, each with Go to into the record. Nothing here edits the pack.

import { h, svgEl } from '../../ui/kit/dom.js';
import { simulate, startDryRun } from '../dryrun/run.js';
import { fieldRow } from '../form/fields.js';

const WORKER = new URL('../dryrun/worker.js', import.meta.url);
const TEMPOS = ['0.25', '0.5', '1', '2', '4'];
const MAX_DAYS = 3650;
const SHOWN = 60;
// The form and the last run, per world pack id: they outlive a redraw and a Go to away and back (the pack's keep() is cleared then).
const RUNS = new Map();

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const row = (cls, title, sub, ctl = null, data = {}) => h('div', { class: `srow ${cls}`, dataset: data }, h('div', { class: 'lb' }, h('b', title), sub ? h('small', sub) : null), ctl);
const group = (cls, title, ...children) => h('section', { class: `sgrp ${cls}` }, h('div', { class: 'gt' }, title), ...children);

function stateOf(ctx) {
    const id = String(ctx.doc?.id ?? '');
    if (!RUNS.has(id)) RUNS.set(id, { seed: id || 'dry-run', tempo: 1, days: 90, job: null, day: 0, result: null, ranOn: null, against: '', error: '', all: false });
    return RUNS.get(id);
}

// Where a record of the pack opens: an event or template by its id, a cast member by id or name.
function recOf(doc, key, field, id) {
    const at = (doc?.content?.[key] ?? []).findIndex(item => item && (item[field] === id || item.id === id || item.name === id));
    return at < 0 ? null : `${key}.${at}`;
}
function targetOf(doc, by) {
    const text = String(by ?? '');
    if (text.startsWith('template:')) { const rec = recOf(doc, 'templates', 'template', text.slice(9)); return rec && ['templates', rec]; }
    const rec = recOf(doc, 'worldEvents', 'id', text);
    return rec && ['events', rec];
}
const goButton = (ctx, target, label) => (target ? h('button', { type: 'button', class: 'lnk st-dry-go', dataset: { part: target[0], rec: target[1] }, onClick: () => ctx.go(target[0], target[1]) }, label) : null);
const castName = (doc, id) => (doc?.content?.cast ?? []).find(person => person?.id === id)?.name ?? id;

// Runs the pack: in a Worker where the page has one, else in the page. A redraw shows the result; progress is written into the open page.
function start(ctx, st) {
    const game = isObject(ctx.other) ? ctx.other : null;
    const calendar = isObject(game?.content?.calendar) ? game.content.calendar : null;
    const input = { pack: ctx.doc, game: calendar?.seasons ? { seasons: calendar.seasons } : null, seed: st.seed, tempo: st.tempo, days: st.days, calendar };
    const job = typeof Worker === 'function'
        ? startDryRun(input, { make: () => new Worker(WORKER, { type: 'module' }), onProgress: day => { st.day = day; const live = liveStatus(); if (live) live.textContent = progress(st); } })
        : { done: new Promise((resolve, reject) => setTimeout(() => { try { resolve(simulate(input)); } catch (error) { reject(error); } }, 0)), cancel() {} };
    Object.assign(st, { job, day: 0, error: '', all: false });
    const redraw = () => { if (liveStatus()) ctx.go('timeline'); };
    job.done.then(result => {
        if (st.job !== job) return;
        Object.assign(st, { job: null, result, ranOn: ctx.doc, against: calendar ? `${game.name || game.id}’s calendar` : 'the built-in calendar' });
        redraw();
    }, error => {
        if (st.job !== job) return;
        Object.assign(st, { job: null, error: String(error?.message ?? error) });
        redraw();
    });
    ctx.go('timeline');
}

const progress = st => (st.day ? `Day ${st.day} of ${st.days}…` : `Running ${plural(st.days, 'day')}…`);

// The page's own status line in the document (the nav also draws the page, detached, to see whether it mounts).
const liveStatus = () => globalThis.document?.querySelector?.('.st-dry-status') ?? null;

function formPage(ctx, st) {
    const seed = fieldRow({ type: 'text', key: 'seed', label: 'Seed', hint: 'The same seed gives the same days', value: st.seed }, (_, value) => { st.seed = value; });
    const tempo = fieldRow({ type: 'segmented', key: 'tempo', label: 'Tempo', hint: 'How fast the world moves: 1 is as written', value: String(st.tempo), options: TEMPOS }, (_, value) => { st.tempo = Number(value); });
    const days = fieldRow({ type: 'number', key: 'days', label: 'Days', hint: `How many days to run, 1 to ${MAX_DAYS}`, value: st.days }, (_, value) => {
        if (Number.isFinite(value)) st.days = Math.min(Math.max(Math.round(value), 1), MAX_DAYS);
    });
    const running = Boolean(st.job);
    const game = isObject(ctx.other) && isObject(ctx.other.content?.calendar) ? `${ctx.other.name || ctx.other.id}’s calendar` : 'the built-in calendar';
    const status = h('small', { class: 'st-dry-status' }, running ? progress(st) : `On ${game}, with no one with You. The pack is run as written.`);
    const button = running
        ? h('button', { type: 'button', class: 'btn2 st-dry-cancel', onClick: () => { const job = st.job; st.job = null; job.cancel(); ctx.go('timeline'); } }, 'Cancel')
        : h('button', { type: 'button', class: 'btn2 pri st-dry-run', onClick: () => start(ctx, st) }, 'Run');
    const go = h('div', { class: 'srow st-dry-act', dataset: { state: running ? 'running' : 'idle' } }, h('div', { class: 'lb' }, h('b', running ? 'Running' : 'Run the world'), status), h('div', { class: 'ctl' }, button));
    const failed = st.error ? row('st-dry-error', 'The dry run stopped.', st.error, null, { level: 'error' }) : null;
    return group('st-dry-form', 'Run', seed, tempo, days, go, failed);
}

// Per day: what fired or ended, the cast's moves and deaths, and the conditions that began or ended holding.
function dayLines(ctx, rows) {
    const out = [];
    let before = [];
    for (const day of rows) {
        const lines = [];
        for (const entry of day.journal) lines.push({ kind: entry.ended ? 'ended' : (entry.fired ? 'fired' : (String(entry.by ?? '').startsWith('template:') ? 'happens' : 'news')), text: entry.text, target: targetOf(ctx.doc, entry.by) });
        for (const move of day.moves) lines.push({ kind: 'move', text: `${castName(ctx.doc, move.id)} goes to ${move.to}${move.until ? ` until ${move.until}` : ''}.`, target: castTarget(ctx.doc, move.id) });
        for (const death of day.deaths) lines.push({ kind: 'death', text: `${castName(ctx.doc, death.id)} dies (${death.by}).`, target: castTarget(ctx.doc, death.id) });
        for (const name of day.held.filter(name => !before.includes(name))) lines.push({ kind: 'holds', text: `${name} begins to hold.` });
        for (const name of before.filter(name => !day.held.includes(name))) lines.push({ kind: 'holds', text: `${name} no longer holds.` });
        before = day.held;
        if (lines.length) out.push({ day: day.day, lines });
    }
    return out;
}
const castTarget = (doc, id) => { const rec = recOf(doc, 'cast', 'id', id); return rec && ['cast', rec]; };

function timelineGroup(ctx, st, busy) {
    const shown = st.all ? busy : busy.slice(0, SHOWN);
    const rows = shown.map(({ day, lines }) => h('div', { class: 'srow st-day', dataset: { day } },
        h('div', { class: 'lb' }, h('b', `Day ${day}`), lines.map(line => h('small', { class: 'st-line', dataset: { kind: line.kind } }, h('span', { class: 'st-tag' }, line.kind), ' ', line.text, line.target ? ' ' : null, goButton(ctx, line.target, 'Go to ›'))))));
    const more = busy.length > shown.length ? h('div', { class: 'addrow' }, h('button', { type: 'button', class: 'btn2 st-dry-more', onClick: () => { st.all = true; ctx.go('timeline'); } }, `Show all ${busy.length} days`)) : null;
    return group('st-dry-days', `By day · ${plural(busy.length, 'day')} with news`, busy.length ? rows : row('st-dry-quiet', 'Nothing happened.', 'No event fired, no one moved and no condition began or ended in these days.'), more);
}

// The runs of days each condition held: [[from, to], ...] per name.
function holdSpans(rows) {
    const spans = new Map();
    for (const day of rows) for (const name of day.held) {
        const list = spans.get(name) ?? [];
        const last = list.at(-1);
        if (last && last[1] === day.day - 1) last[1] = day.day; else list.push([day.day, day.day]);
        spans.set(name, list);
    }
    return [...spans].sort(([a], [b]) => a.localeCompare(b));
}

function holdsGroup(rows, days) {
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

function curvesGroup(ctx, rows) {
    const keys = [...new Set(rows.flatMap(day => Object.keys(day.standings ?? {})))].sort();
    if (!keys.length) return null;
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

function castGroup(ctx, rows) {
    const moves = rows.flatMap(day => day.moves.map(move => ({ day: day.day, kind: 'move', id: move.id, text: `goes to ${move.to}${move.routine ? `: ${move.routine}` : ''}` })));
    const deaths = rows.flatMap(day => day.deaths.map(death => ({ day: day.day, kind: 'death', id: death.id, text: `dies (${death.by})` })));
    const all = [...moves, ...deaths].sort((a, b) => a.day - b.day);
    const title = `The cast · ${plural(moves.length, 'move')} · ${plural(deaths.length, 'death')}`;
    if (!all.length) return group('st-dry-cast', title, row('st-dry-quiet', 'No one moved or died.', 'The cast stayed where the pack starts them.'));
    return group('st-dry-cast', title, all.map(item => row('st-cast', `Day ${item.day} · ${castName(ctx.doc, item.id)} ${item.text}`, null,
        h('div', { class: 'ctl' }, goButton(ctx, castTarget(ctx.doc, item.id), 'Go to ›')), { kind: item.kind })));
}

function resultPage(ctx, st) {
    const result = st.result;
    const rows = result.rows ?? [];
    const busy = dayLines(ctx, rows);
    const fired = rows.reduce((sum, day) => sum + day.fired.length, 0);
    const stale = st.ranOn !== ctx.doc ? ' The pack has changed since: run it again to see the change.' : '';
    const summary = group('st-dry-sum', 'The run',
        row('st-dry-result', `${plural(result.days, 'day')} · seed “${result.seed}” · tempo ${result.tempo}×: ${plural(fired, 'event')} fired`, `${result.start?.date ? `From ${result.start.date.day} ${result.start.date.month} ${result.start.date.year}, the world’s start date, on` : 'From day 1, since the world gives no start date, on'} ${st.against}.${stale}`, null, { stale: String(Boolean(stale)) }),
        (result.warnings ?? []).map(text => row('st-dry-warn', h('span', h('span', { class: 'st-mark', 'aria-hidden': 'true' }, '! '), text), 'What the engine said about the pack', null, { level: 'warning' })));
    return [summary, timelineGroup(ctx, st, busy), holdsGroup(rows, Math.max(result.days, 1)), curvesGroup(ctx, rows), castGroup(ctx, rows)];
}

/** `ctx`: the page context (views/route.js) of the world pack; `ctx.other` is the open game pack's document (its calendar is used), or null. */
export function renderPage(ctx) {
    if (!isObject(ctx.doc)) return [];
    const st = stateOf(ctx);
    const intro = h('p', { class: 'fine st-dry-intro' }, 'Runs the world for some days, as a chat would with no one there: what fires, which conditions hold, how the powers and scores move, and where the cast goes. The same seed gives the same days.');
    const done = st.result ? resultPage(ctx, st) : [group('st-dry-sum', 'The run', row('st-dry-none', 'Nothing run yet.', 'Pick a seed, a tempo and how many days, then Run.'))];
    return [intro, formPage(ctx, st), ...done];
}
