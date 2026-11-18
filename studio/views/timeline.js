// The Dry run page (views/route.js PAGES; a part in the Check group for a format 4 world pack; the MK-5 description): a seed, tempo and
// days form; Run, which steps the world engine's daily step in a Worker (studio/dryrun/run.js) on the pack as written, with the open game
// pack's calendar or the built-in one; and the result: a summary with the engine's warnings, a timeline by day, the condition holds, the
// power and score curves, and the cast's moves and deaths, each with Go to into the record. Nothing here edits the pack.

import { h } from '../../ui/kit/dom.js';
import { simulate, startDryRun } from '../dryrun/run.js';
import { seasonsOf } from '../dryrun/seasons.js';
import { formNodes } from './dry/form.js';
import { dayList, STEP } from './dry/days.js';
import { headNodes } from './dry/summary.js';
import { castGroup, curvesGroup, holdsGroup } from './dry/series.js';

const WORKER = new URL('../dryrun/worker.js', import.meta.url);
const TABS = [['timeline', 'Timeline'], ['holds', 'Holds'], ['curves', 'Curves'], ['cast', 'Cast']];
// The form and the last run, per world pack id: they outlive a redraw and a Go to away and back (the pack's keep() is cleared then).
const RUNS = new Map();

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const row = (cls, title, sub, ctl = null, data = {}) => h('div', { class: `srow ${cls}`, dataset: data }, h('div', { class: 'lb' }, h('b', title), sub ? h('small', sub) : null), ctl);
const group = (cls, title, ...children) => h('section', { class: `sgrp ${cls}` }, h('div', { class: 'gt' }, title), ...children);

function stateOf(ctx) {
    const id = String(ctx.doc?.id ?? '');
    if (!RUNS.has(id)) RUNS.set(id, { seed: id || 'dry-run', tempo: 1, days: 90, job: null, day: 0, result: null, ranOn: null, against: '', error: '', shown: STEP, tab: 'timeline', kind: 'all', editing: false, jump: 0, calendar: null, warnsOpen: false });
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
    const input = { pack: ctx.doc, game: seasonsOf(calendar) ? { seasons: seasonsOf(calendar) } : null, seed: st.seed, tempo: st.tempo, days: st.days, calendar };
    const job = typeof Worker === 'function'
        ? startDryRun(input, { make: () => new Worker(WORKER, { type: 'module' }), onProgress: day => { st.day = day; const live = liveStatus(); if (live) live.textContent = progress(st); } })
        : { done: new Promise((resolve, reject) => setTimeout(() => { try { resolve(simulate(input)); } catch (error) { reject(error); } }, 0)), cancel() {} };
    Object.assign(st, { job, day: 0, error: '', shown: STEP, editing: false, jump: 0, calendar });
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

const reseed = st => { st.seed = String(1000 + Math.floor(Math.random() * 9000)); };

function resultPage(ctx, st, on) {
    const rows = st.result.rows ?? [];
    const tabs = h('div', { class: 'st-dtabs', role: 'tablist' }, TABS.map(([key, label]) => h('button', { type: 'button', role: 'tab', class: 'st-dtab', dataset: { tab: key }, 'aria-selected': String(st.tab === key),
        onClick: () => { st.tab = key; ctx.go('timeline'); } }, label)));
    const body = { timeline: () => dayList(ctx, st, dayLines(ctx, rows), goButton), holds: () => [holdsGroup(rows, Math.max(st.result.days, 1))], curves: () => [curvesGroup(ctx, rows)], cast: () => [castGroup(ctx, rows, goButton, castTarget)] };
    return [...headNodes(ctx, st, on), tabs, ...(body[st.tab] ?? body.timeline)()];
}

/** `ctx`: the page context (views/route.js) of the world pack, with `check` (the pack checker's result); `ctx.other` is the open game pack's document (its calendar is used), or null. */
export function renderPage(ctx) {
    if (!isObject(ctx.doc)) return [];
    const st = stateOf(ctx);
    const on = {
        run: () => start(ctx, st), again: () => start(ctx, st), reseed: () => { reseed(st); ctx.go('timeline'); }, redraw: () => ctx.go('timeline'), progress: () => progress(st),
        cancel: () => { const job = st.job; st.job = null; job.cancel(); ctx.go('timeline'); },
        warns: () => { st.warnsOpen = !st.warnsOpen; ctx.go('timeline'); },
        change: () => { st.editing = true; ctx.go('timeline'); },
    };
    const open = !st.result || st.editing || st.job || st.error;
    const form = open ? [group('st-dry-form', 'Run', ...formNodes(ctx, st, on))] : [];
    const done = st.result ? resultPage(ctx, st, on) : [h('div', { class: 'srow st-dry-none' }, h('div', { class: 'lb' }, h('small', 'No run yet. A run is kept until you close the pack or run again; it is not saved in the draft.')))];
    return [...form, ...done];
}
