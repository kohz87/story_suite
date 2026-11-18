// The world events editor (views/route.js EDITORS: worldEvents): the list of events with a search and kind filters, and one event's page (mock MK-1):
// what it is (id, title, kind, certainty, reach, severity, summary), where, when (on, window, chance, cooldown), what it needs (requires, requires any,
// pre-empted by, likelier and less likely if), its effects, its outcomes, when it ends, "used by" and the JSON row. Each one-line string of the strict
// grammar is checked as it is typed by the validator's own checks (checkLine), and "Pick…" fills a box with a known id. A format 3 pack's dated
// `events` stay read-only. Cast moves and on_end have no field: they are edited in the JSON row.

import { h } from '../../ui/kit/dom.js';
import { EVENT_CERTAINTY, EVENT_KINDS, EVENT_REACH } from '../../packs/limits.js';
import { buildIndex } from '../../packs/validate/world-pack-parts/index.js';
import { checkAnchorText, checkConditionText, checkEntry } from '../../packs/validate/world-pack-parts/entries.js';
import { checkWeight } from '../../packs/validate/world-pack-parts/weight-check.js';
import { durationDays } from '../../modules/world/daily/durations.js';
import { fieldRow, setProblem } from '../form/fields.js';
import { chipList } from '../form/list.js';
import { openPicker } from '../form/pick.js';
import { jsonRow } from '../views/json-row.js';
import { renderSection } from '../views/records.js';
import { definedIds, usedBy } from '../model/refs.js';
import { renameId } from '../model/rename.js';
import { partOfPath } from '../parts.js';

const PART = 'events';
const BASE = ['content', 'worldEvents'];
const SHOWN = 40;
const NONE = '(not set)';
const FILTERS = [['all', 'All'], ['one-off', 'One-off'], ['chain-stage', 'Chain stage'], ['recurring', 'Recurring'], ['problems', 'Problems']];
const FIELDS = ['id', 'title', 'kind', 'certainty', 'reach', 'severity', 'summary', 'even_in_party', 'where', 'on', 'window', 'chance', 'cooldown', 'requires', 'requires_any', 'pre_empted_by', 'likelier_if', 'less_if', 'effects', 'outcomes', 'ends_when'];
const ODDS = /^(.+?)\s+(×\d+(?:\.\d+)?)$/;
const DELTA = /^(\S+)\s+([+-]?\d+)$/;
const FACT = /^([a-z0-9]+(?:-[a-z0-9]+)*):\s+(.+)$/;
const isObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const at = index => `content.worldEvents[${index}]`;
const inRecord = (problem, index) => String(problem.path) === at(index) || [`${at(index)}.`, `${at(index)}[`].some(start => String(problem.path).startsWith(start));

// ---- the strict grammar, read with the validator's own checks ----------------------------------------------------------------------------------

const indexes = new WeakMap();
function indexFor(content) {
    if (!indexes.has(content)) {
        const list = key => (Array.isArray(content[key]) ? content[key] : []);
        const places = list('places').map(place => ({ ...place, slug: place?.slug ?? place?.id }));
        indexes.set(content, buildIndex({ ...content, places, legacyEvents: list('events'), worldEvents: list('worldEvents'), deferCalendar: true }));
    }
    return indexes.get(content);
}

const MODES = {
    entry: (text, c) => checkEntry(text, c, 'entry'),
    end: (text, c) => checkEntry(text, c, 'entry', ['threshold', 'anchor']),
    anchor: (text, c) => checkEntry(text, c, 'entry', ['anchor']),
    after: (text, c) => checkAnchorText(text, c, 'after'),
    set: (text, c) => checkConditionText(text, c, 'set'),
    clear: (text, c) => checkConditionText(text, c, 'clear', { duration: 'forbid' }),
    weight: (text, c) => checkWeight(/^\d+(?:\.\d+)?$/.test(text) ? Number(text) : text, c, 'weight'),
    where: (text, c) => (['place', 'region', 'realm'].some(scope => c.index.ref(text).has(scope)) ? null : c.say('where', `"${text}" is not a place, region or realm of this pack.`)),
    duration: (text, c) => (durationDays(text) > 0 ? null : c.say('duration', `"${text}" is not a duration (like "40 days").`)),
};

/**
 * Checks one line of the strict grammar against a pack's `content` as the pack check does → `{ level: 'error' | 'warning', message }`, or null when
 * the game takes it. `mode`: entry (requires, requires_any, likelier_if keys), end (ends_when.any_of), anchor (pre_empted_by), after (window.after, on),
 * set, clear, weight, where, duration. `recurring`: placeholders (@place, @region…) are allowed, as for a recurring event.
 */
export function checkLine(content, mode, text, { recurring = false } = {}) {
    const said = [];
    const c = { index: indexFor(isObj(content) ? content : {}), placeholders: recurring, say: (field, message) => said.push(message),
        collect: { facts: new Set(), factRefs: new Set(), timed: new Set(), cleared: new Set(), warnings: [] } };
    MODES[mode](String(text ?? '').trim(), c);
    if (said.length) return { level: 'error', message: said[0] };
    return c.collect.warnings.length ? { level: 'warning', message: c.collect.warnings[0][1] } : null;
}

// What "Pick…" offers for each kind of line: a whole line, or a start to finish (it ends in "@" or " >= ").
function starters(ctx, mode) {
    const ids = kind => definedIds(ctx.refs, kind);
    const make = (kind, text, sub) => ids(kind).map(({ id, name }) => ({ id: text(id), label: text(id), sub: name && name !== id ? `${sub} · ${name}` : sub }));
    const conditions = () => make('condition', id => `${id}@`, 'condition: add the place, region, route or realm');
    const anchors = () => [...make('event', id => `fired:${id}`, 'when the event fired'), ...make('fact', id => `fact:${id}`, 'once the fact is known'), ...make('cast', id => `died:${id}`, 'when the person died')];
    if (mode === 'where') return [...make('place', id => id, 'place'), ...make('region', id => id, 'region'), ...make('realm', id => id, 'realm')];
    if (mode === 'set' || mode === 'clear') return conditions();
    if (mode === 'after') return [{ id: 'start', label: 'start', sub: 'the start of the story' }, ...anchors()];
    const levels = mode === 'anchor' ? [] : [...make('power', id => `power:${id} >= `, 'a power at or above N'), ...make('score', id => `score:${id} >= `, 'a score at or above N')];
    return [...(mode === 'entry' ? conditions().map(item => ({ ...item, id: `set:${item.id}`, label: `set:${item.label}` })) : []), ...anchors(), ...levels];
}

function pickButton(env, mode, title, onPick) {
    return h('button', { type: 'button', class: 'btn2 st-pickline', 'aria-label': title, onClick: () => openPicker({}, { title, items: starters(env.ctx, mode) }, onPick) }, 'Pick…');
}

// A chip list of grammar lines. A new line is checked before it is kept: an error keeps it out (shown under the box), a warning shows and the line is kept.
function lineList(spec, env, onValues) {
    const before = Array.isArray(spec.values) ? spec.values.map(String) : [];
    const row = chipList({ ...spec, values: before }, (key, values) => {
        const found = values.filter(value => !before.includes(value)).map(value => env.check(spec.mode, value)).find(Boolean);
        setProblem(row, found?.message ?? '');
        row.dataset.level = found?.level ?? '';
        if (found?.level !== 'error') onValues(values);
    });
    if (spec.problem) setProblem(row, spec.problem);
    if (spec.pick !== false) {
        row.querySelector('.ctl')?.append(pickButton(env, spec.mode, `Pick for ${spec.label}`, text => {
            const box = row.querySelector('input.kadd');
            if (!box) return;
            box.value = text;
            if (/(@| >= )$/.test(text)) box.focus?.(); else box.dispatchEvent(new Event('change'));
        }));
    }
    return row;
}

// A one-line text field of the grammar: re-checked as it is typed; kept as typed when it is committed (the pack check then has the last word).
function lineField(spec, env, onText) {
    const row = fieldRow({ type: 'text', ...spec, value: spec.value ?? '' }, (key, value) => onText(String(value).trim()));
    const input = row.querySelector('input');
    input?.addEventListener('input', () => {
        const text = input.value.trim();
        const found = text ? env.check(spec.mode, text) : null;
        setProblem(row, found?.message ?? '');
    });
    return row;
}

// A map written as chips "<key> <value>" (likelier_if "set:x@y ×2", powers "river-council +5", facts "id: text").
const mapChips = (map, join = ' ', signed = false) => Object.entries(isObj(map) ? map : {}).map(([key, value]) => `${key}${join}${signed && value > 0 ? '+' : ''}${value}`);

function mapList(spec, env, onMap) {
    const before = mapChips(spec.map, spec.join, spec.number);
    const row = chipList({ ...spec, values: before }, (key, values) => {
        const fresh = values.filter(value => !before.includes(value));
        const bad = fresh.find(value => !spec.shape.test(value.trim()));
        const found = bad ? { level: 'error', message: `"${bad}" is not ${spec.form}.` } : fresh.map(value => (spec.mode ? env.check(spec.mode, spec.shape.exec(value.trim())[1]) : null)).find(Boolean);
        setProblem(row, found?.message ?? '');
        if (found?.level === 'error') return;
        onMap(values.length ? Object.fromEntries(values.map(value => spec.shape.exec(value.trim()).slice(1, 3)).map(([k, v]) => [k, spec.number ? Number(v) : v])) : undefined);
    });
    if (spec.problem) setProblem(row, spec.problem);
    return row;
}

// ---- one event's page -------------------------------------------------------------------------------------------------------------------------------

// The effects rows of an event (or of one outcome: `top` false). `put(effects | undefined)` writes the whole block back.
function effectRows(effects, env, put, problemOf, prefix) {
    const block = isObj(effects) ? effects : {};
    const write = (field, value) => {
        const next = { ...block };
        if (value === undefined || (Array.isArray(value) && !value.length)) delete next[field]; else next[field] = value;
        put(Object.keys(next).length ? next : undefined);
    };
    const facts = Array.isArray(block.facts) ? block.facts : [];
    const factMap = Object.fromEntries(facts.filter(isObj).map(fact => [fact.id, fact.text]));
    const rest = Object.keys(block).filter(key => !['set', 'clear', 'powers', 'scores', 'facts'].includes(key));
    return [
        lineList({ key: `${prefix}set`, label: 'Sets', hint: 'Conditions it sets: <condition>@<where>[: <how long>]', values: block.set, mode: 'set', placeholder: 'grain-dear@highmark: 30 days', none: 'Sets nothing', problem: problemOf(`${prefix}set`) }, env, values => write('set', values)),
        lineList({ key: `${prefix}clear`, label: 'Clears', hint: 'Conditions it clears: <condition>@<where>', values: block.clear, mode: 'clear', placeholder: 'grain-dear@highmark', none: 'Clears nothing', problem: problemOf(`${prefix}clear`) }, env, values => write('clear', values)),
        mapList({ key: `${prefix}powers`, label: 'Powers', hint: 'A power id and a whole change, like "river-council +5"', map: block.powers, shape: DELTA, number: true, form: 'a power and a change, like "river-council +5"', placeholder: 'river-council +5', none: 'No change', problem: problemOf(`${prefix}powers`) }, env, map => write('powers', map)),
        mapList({ key: `${prefix}scores`, label: 'Scores', hint: 'A score id and a whole change, like "north-readiness -5"', map: block.scores, shape: DELTA, number: true, form: 'a score and a change, like "north-readiness -5"', placeholder: 'north-readiness -5', none: 'No change', problem: problemOf(`${prefix}scores`) }, env, map => write('scores', map)),
        mapList({ key: `${prefix}facts`, label: 'Facts', hint: 'Facts it records, as "<id>: <one sentence>"; others test them as fact:<id>', map: factMap, join: ': ', shape: FACT, form: 'a fact: write "<id>: <one sentence>"', placeholder: 'regency-declared: The regency was declared.', none: 'No facts', problem: problemOf(`${prefix}facts`) }, env,
            map => write('facts', map && Object.entries(map).map(([id, text]) => ({ id, text })))),
        rest.length ? h('p', { class: 'fine st-rest' }, `Also in these effects, only in the JSON below: ${rest.join(', ')}.`) : null,
    ].filter(Boolean);
}

function outcomeGroup(event, index, env, problemOf) {
    const list = Array.isArray(event.outcomes) ? event.outcomes : [];
    const steps = [...BASE, index, 'outcomes'];
    const commit = patches => env.say(env.ctx.commit(patches));
    const blocks = list.map((outcome, n) => {
        if (!isObj(outcome)) return null;
        const put = (field, value) => commit([value === undefined || value === '' ? { op: 'remove', path: [...steps, n, field] } : { op: 'set', path: [...steps, n, field], value }]);
        const pre = `outcomes[${n}].`;
        return h('div', { class: 'st-outcome', dataset: { outcome: String(n) } },
            h('div', { class: 'srow subrow' }, h('span', { class: 'lb' }, h('b', `Outcome ${n + 1}`), h('small', String(outcome.name ?? ''))),
                h('span', { class: 'ctl' },
                    h('button', { type: 'button', class: 'btn2 st-oup', 'aria-label': `Move outcome ${n + 1} up`, disabled: n === 0, onClick: () => commit([{ op: 'move', path: [...steps, n], to: n - 1 }]) }, '↑'),
                    h('button', { type: 'button', class: 'btn2 st-odown', 'aria-label': `Move outcome ${n + 1} down`, disabled: n === list.length - 1, onClick: () => commit([{ op: 'move', path: [...steps, n], to: n + 1 }]) }, '↓'),
                    h('button', { type: 'button', class: 'btn2 dng st-oremove', 'aria-label': `Remove outcome ${n + 1}`, onClick: () => commit([list.length === 1 ? { op: 'remove', path: steps } : { op: 'remove', path: [...steps, n] }]) }, '×'))),
            fieldRow({ type: 'text', key: `${pre}name`, label: 'Name', hint: 'Fills {outcome} in the summary', value: outcome.name ?? '', problem: problemOf(`${pre}name`) }, (key, value) => put('name', String(value).trim())),
            lineField({ key: `${pre}weight`, label: 'Weight', hint: 'A number, or power:<id> / score:<id>, joined by + or -', value: outcome.weight === undefined ? '' : String(outcome.weight), mode: 'weight', problem: problemOf(`${pre}weight`) }, env,
                text => put('weight', /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : text)),
            fieldRow({ type: 'long', key: `${pre}summary`, label: 'Summary', hint: 'Its own Journal line; blank: the event\'s', rows: 2, value: outcome.summary ?? '', problem: problemOf(`${pre}summary`) }, (key, value) => put('summary', String(value).trim())),
            ...effectRows(outcome.effects, env, value => put('effects', value), problemOf, `${pre}effects.`));
    }).filter(Boolean);
    const add = () => commit([list.length ? { op: 'insert', path: [...steps, list.length], value: { name: `outcome ${list.length + 1}`, weight: 1 } } : { op: 'set', path: steps, value: [{ name: 'outcome 1', weight: 1 }] }]);
    return h('section', { class: 'sgrp st-outcomes' }, h('div', { class: 'gt' }, `Outcomes · ${list.length}`),
        list.length ? null : h('p', { class: 'fine' }, 'One result. Add outcomes for an event that can turn out more than one way; one is drawn by weight.'),
        ...blocks, h('div', { class: 'addrow' }, h('button', { type: 'button', class: 'btn2 st-oadd', onClick: add }, '+ Add an outcome')));
}

function endsGroup(event, env, put, problemOf) {
    const ends = event.ends_when;
    const instant = ends === 'instant' || ends === undefined;
    const obj = isObj(ends) ? ends : {};
    const write = (field, value) => {
        const next = { ...obj };
        if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) delete next[field]; else next[field] = value;
        put('ends_when', Object.keys(next).length ? next : 'instant');
    };
    return h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'When it ends'),
        fieldRow({ type: 'toggle', key: 'ends_when', label: 'Over at once', hint: 'Off: it lasts a while, or until something happens', value: instant, problem: problemOf('ends_when') }, (key, value) => put('ends_when', value ? 'instant' : { for: '30 days' })),
        instant ? null : lineField({ key: 'ends_when.for', label: 'Lasts', hint: 'A duration, like "40 days"', value: obj.for ?? '', mode: 'duration', problem: problemOf('ends_when.for') }, env, text => write('for', text)),
        instant ? null : lineList({ key: 'ends_when.any_of', label: 'Or ends when', hint: 'Anchors or thresholds; the first that holds ends it', values: obj.any_of, mode: 'end', placeholder: 'fired:peace-signed', none: 'Nothing', problem: problemOf('ends_when.any_of') }, env, values => write('any_of', values)));
}

function eventPage(list, index, bad, ctx, state, redraw) {
    const event = list[index];
    const content = ctx.doc?.doc?.content ?? ctx.doc?.content ?? {};
    const recurring = event.kind === 'recurring';
    const note = h('small', { class: 'st-problem', role: 'status' });
    const say = result => { if (result && !result.ok) note.textContent = result.refusal ?? 'The change was not made.'; return result; };
    const env = { ctx, say, check: (mode, text) => checkLine(content, mode, text, { recurring }) };
    const problemOf = key => bad[index].find(problem => [`${at(index)}.${key}`].includes(String(problem.path)) || [`${at(index)}.${key}.`, `${at(index)}.${key}[`].some(start => String(problem.path).startsWith(start)))?.message ?? '';
    const put = (key, value) => {
        const gone = value === undefined || value === '' || value === null || (Array.isArray(value) && !value.length);
        if (gone && !Object.hasOwn(event, key)) return null;
        return say(ctx.commit([gone ? { op: 'remove', path: [...BASE, index, key] } : { op: 'set', path: [...BASE, index, key], value }]));
    };
    const focusKey = ctx.focus?.rec === `worldEvents.${index}` ? ctx.focus.path?.[0] : null;
    const mark = row => {
        const key = row?.dataset?.key;
        if (focusKey && key && (key === focusKey || key.startsWith(`${focusKey}.`))) { const control = row.querySelector('input,textarea,select'); if (control) { control.classList.add('st-at'); control.dataset.at = '0'; } }
        return row;
    };
    const group = (title, ...rows) => h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, title), ...rows.flat().filter(Boolean).map(mark));
    const text = (key, label, hint, long) => fieldRow({ type: long ? 'long' : 'text', key, label, hint, rows: 2, value: event[key] ?? '', problem: problemOf(key) }, (k, value) => put(key, String(value).trim()));
    const choose = (key, label, hint, options, fallback) => fieldRow({ type: 'select', key, label, hint, options: [NONE, ...options], value: event[key] ?? NONE, problem: problemOf(key) },
        (k, value) => put(key, value === NONE || value === fallback && event[key] === undefined ? undefined : value));

    const known = typeof event.id === 'string' && (ctx.refs?.defs?.event ?? []).some(item => item.id === event.id);
    const idRow = fieldRow({ type: 'text', key: 'id', label: 'Id', hint: 'Other events name it by this (fired:<id>). Renaming changes them too', value: event.id ?? '', problem: problemOf('id') }, (key, value) => {
        const next = String(value).trim();
        if (next === event.id) return;
        const plan = known ? renameId(ctx.refs, ctx.doc, 'event', event.id, next) : { ok: true, patches: [{ op: 'set', path: [...BASE, index, 'id'], value: next }] };
        if (!plan.ok) { setProblem(idRow, plan.refusal); return; }
        say(ctx.commit(plan.patches));
    });
    const where = event.where;
    const win = isObj(event.window) ? event.window : {};
    const setWindow = (field, value) => {
        const next = { ...win };
        if (value === undefined || value === '') delete next[field]; else next[field] = value;
        put('window', Object.keys(next).length ? next : undefined);
    };
    const afterRow = lineField({ key: 'window.after', label: 'Not before', hint: 'An anchor and an offset: start, fired:<id>, a season… + 10 days', value: win.after, mode: 'after', problem: problemOf('window.after') }, env, value => setWindow('after', value));
    afterRow.querySelector('.ctl')?.append(pickButton(env, 'after', 'Pick for Not before', picked => {
        const old = String(win.after ?? '');
        const plus = old.lastIndexOf(' + ');
        setWindow('after', `${picked}${plus < 0 ? '' : old.slice(plus)}`);
    }));
    const odds = (key, label, hint) => mapList({ key, label, hint, map: event[key], shape: ODDS, mode: 'entry', form: 'a test and odds, like "drought@vale ×2" (×0 blocks)', placeholder: 'drought@vale ×2', none: 'None', problem: problemOf(key) }, env, map => put(key, map));
    const uses = typeof event.id === 'string' ? usedBy(ctx.refs, 'event', event.id) : [];
    const extra = Object.keys(event).filter(key => !FIELDS.includes(key));

    const head = h('div', { class: 'st-bar' },
        h('button', { type: 'button', class: 'btn2 st-back', onClick: () => ctx.go(PART) }, '‹ Events'),
        h('span', { class: 'st-acts' },
            h('button', { type: 'button', class: 'btn2 st-dup', onClick: () => duplicate(list, index, ctx) }, 'Duplicate'),
            state.confirm === index
                ? [h('button', { type: 'button', class: 'btn2 dng st-sure', onClick: () => { state.confirm = null; if (say(ctx.commit([{ op: 'remove', path: [...BASE, index] }]))?.ok) ctx.go(PART); } }, uses.length ? `Delete (${plural(uses.length, 'record')} name it)` : 'Delete this event'),
                    h('button', { type: 'button', class: 'btn2 st-keep', onClick: () => { state.confirm = null; redraw(); } }, 'Keep it')]
                : h('button', { type: 'button', class: 'btn2 dng st-del', onClick: () => { state.confirm = index; redraw(); } }, 'Delete')));
    return [head,
        h('div', { class: 'st-rt st-entryhead', dataset: { rec: `worldEvents.${index}` }, tabindex: '-1' }, h('b', String(event.title ?? event.id ?? `#${index + 1}`)),
            h('small', `Event ${index + 1} of ${list.length}`), ...flagsOf(event).map(flag => h('span', { class: 'tg2' }, flag))),
        note,
        group('Event', idRow, text('title', 'Title', 'Shown in lists and the Journal; blank: the id'),
            choose('kind', 'Kind', 'One-off, a stage of a chain, or recurring', EVENT_KINDS, 'one-off'),
            choose('certainty', 'Certainty', 'How sure it is to happen', EVENT_CERTAINTY),
            choose('reach', 'Reach', 'How far the news travels', EVENT_REACH),
            choose('severity', 'Severity', 'Blank counts as major', ['major', 'minor']),
            text('summary', 'Summary', 'One Journal line of at most 300 characters; {outcome} names the outcome drawn', true),
            fieldRow({ type: 'toggle', key: 'even_in_party', label: 'Even with the party there', hint: 'It may fire where the reader is', value: event.even_in_party === true, problem: problemOf('even_in_party') }, (key, value) => put('even_in_party', value ? true : undefined))),
        group('Where',
            Array.isArray(where) || where === undefined
                ? lineList({ key: 'where', label: 'Where', hint: 'Places, regions or realms', values: where, mode: 'where', placeholder: 'Add a place…', none: 'Nowhere yet', problem: problemOf('where') }, env, values => put('where', values))
                : h('div', { class: 'srow wide', dataset: { key: 'where' } }, h('span', { class: 'lb' }, h('b', 'Where'), h('small', `${typeof where === 'string' ? `"${where}"` : 'By place kinds'}; edit it in the JSON below`)))),
        group('When',
            recurring ? null : lineField({ key: 'on', label: 'On a day', hint: 'A one-off on a fixed day: date:<year-month-day>. It is its own window', value: event.on, mode: 'after', problem: problemOf('on') }, env, value => put('on', value)),
            recurring || event.on !== undefined ? null : [afterRow,
                lineField({ key: 'window.within', label: 'Within', hint: 'How long it may wait after that, like "60 days"', value: win.within, mode: 'duration', problem: problemOf('window.within') }, env, value => setWindow('within', value))],
            event.on !== undefined ? null : text('chance', 'Chance', recurring ? 'Like "30% per season"' : 'Like "20% over the window"; blank: by its certainty'),
            text('cooldown', 'Cooldown', recurring ? 'Needed: like "1 season per place"' : 'How long before it may come again')),
        group('What it needs',
            lineList({ key: 'requires', label: 'Requires', hint: 'All of these: conditions, anchors, power:<id> >= N', values: event.requires, mode: 'entry', placeholder: 'drought@vale', none: 'Nothing', problem: problemOf('requires') }, env, values => put('requires', values)),
            lineList({ key: 'requires_any', label: 'Or any of', hint: 'At least one of these as well', values: event.requires_any, mode: 'entry', placeholder: 'fired:war-declared', none: 'Nothing', problem: problemOf('requires_any') }, env, values => put('requires_any', values)),
            lineList({ key: 'pre_empted_by', label: 'Not after', hint: 'Anchors that stop it for good', values: event.pre_empted_by, mode: 'anchor', placeholder: 'fired:peace-signed', none: 'Nothing', problem: problemOf('pre_empted_by') }, env, values => put('pre_empted_by', values)),
            odds('likelier_if', 'Likelier if', 'A test and odds, like "drought@vale ×2"'),
            odds('less_if', 'Less likely if', 'A test and odds, like "set:truce@vale ×0.5"')),
        group('Effects', effectRows(event.effects, env, value => put('effects', value), problemOf, 'effects.')),
        outcomeGroup(event, index, env, problemOf),
        endsGroup(event, env, put, problemOf),
        group('Used by', ...(uses.length ? uses.map(use => usedRow(use, ctx)) : [h('p', { class: 'fine' }, typeof event.id === 'string' ? `No other record names this event (as fired:${event.id}).` : 'Give the event an id for others to name it.')])),
        extra.length ? h('p', { class: 'fine' }, `Also in this event, only in the JSON below: ${extra.join(', ')}.`) : null,
        jsonRow({ value: event, steps: [...BASE, index], noun: 'event', problems: bad[index], focus: focusKey && !FIELDS.includes(focusKey) ? ctx.focus : null, state: ctx.keep?.(`json:worldEvents.${index}`) ?? {} }, patches => ctx.commit(patches))].filter(Boolean);
}

function usedRow(use, ctx) {
    const part = partOfPath(`content.${use.owner.part}${typeof use.owner.index === 'number' ? `[${use.owner.index}]` : ''}`, ctx.kind);
    return h('div', { class: 'srow st-used', dataset: { rec: use.rec } },
        h('span', { class: 'lb' }, h('b', use.owner.id ?? use.rec), h('small', `${use.owner.part} · ${use.role ?? 'text'}`)),
        h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2', 'aria-label': `Go to ${use.owner.id ?? use.rec}`, onClick: () => ctx.go(part.part, part.rec ?? use.rec) }, 'Go to')));
}

// ---- the list ---------------------------------------------------------------------------------------------------------------------------------------

const flagsOf = event => [event.kind === 'recurring' ? 'recurring' : event.kind === 'chain-stage' ? 'chain stage' : null, event.on ? 'fixed day' : null,
    Array.isArray(event.outcomes) && event.outcomes.length ? plural(event.outcomes.length, 'outcome') : null].filter(Boolean);
const subOf = event => [event.certainty, event.reach, event.severity, Array.isArray(event.where) ? event.where.slice(0, 2).join(', ') + (event.where.length > 2 ? ` +${event.where.length - 2}` : '') : null].filter(Boolean).join(' · ');
const passes = (event, filter, query, bad) => {
    if (filter === 'problems' ? !bad : filter !== 'all' && (event.kind ?? 'one-off') !== filter) return false;
    const needle = query.trim().toLowerCase();
    return !needle || [event.id, event.title, event.summary, ...(Array.isArray(event.where) ? event.where : [])].join(' ').toLowerCase().includes(needle);
};

function freshId(list, base) {
    const taken = new Set(list.map(event => event?.id));
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    return id;
}

function create(list, ctx) {
    const value = { id: freshId(list, 'new-event'), kind: 'one-off', certainty: 'possible', reach: 'local', window: { after: 'start', within: '60 days' }, ends_when: 'instant' };
    if (ctx.commit([{ op: 'insert', path: [...BASE, list.length], value }])?.ok) ctx.go(PART, `worldEvents.${list.length}`);
}

function duplicate(list, index, ctx) {
    const copy = { ...JSON.parse(JSON.stringify(list[index])), id: freshId(list, `${list[index].id ?? 'event'}-copy`) };
    if (ctx.commit([{ op: 'insert', path: [...BASE, index + 1], value: copy }])?.ok) ctx.go(PART, `worldEvents.${index + 1}`);
}

function listView(list, bad, ctx, state, redraw) {
    const filter = state.filter ?? 'all';
    const rows = h('div', { class: 'st-list' });
    const fill = () => {
        const found = list.map((event, index) => ({ event, index })).filter(({ event, index }) => passes(event, filter, state.q ?? '', bad[index].length > 0));
        const shown = state.all ? found : found.slice(0, SHOWN);
        rows.replaceChildren(...[...shown.map(({ event, index }) => h('button', { type: 'button', class: 'sgrp st-rec st-eventrow', dataset: { rec: `worldEvents.${index}` }, onClick: () => ctx.go(PART, `worldEvents.${index}`) },
            h('div', { class: 'st-rh' },
                h('div', { class: 'st-rt' }, h('b', String(event.title ?? event.id ?? `#${index + 1}`)), h('small', subOf(event) || 'no details yet')),
                h('span', { class: 'st-flags' }, ...flagsOf(event).map(flag => h('span', { class: 'tg2' }, flag)), bad[index].length ? h('span', { class: 'st-bad' }, `✕ ${bad[index].length}`) : null)))),
        found.length ? null : h('p', { class: 'fine' }, list.length ? 'No event matches.' : 'No events yet.'),
        !state.all && found.length > SHOWN ? h('button', { type: 'button', class: 'btn2 st-more', onClick: () => { state.all = true; fill(); } }, `Show all ${found.length}`) : null].filter(Boolean));
    };
    const search = h('input', { class: 'txt2 st-search', placeholder: 'Search events…', 'aria-label': 'Search events' });
    search.value = state.q ?? '';
    search.addEventListener('input', () => { state.q = search.value; state.all = false; fill(); });
    const count = key => list.filter((event, index) => passes(event, key, '', bad[index].length > 0)).length;
    const chips = h('div', { class: 'st-filters' }, ...FILTERS.map(([key, label]) => h('button', { type: 'button', class: 'tg2 st-filter', dataset: { filter: key }, 'aria-pressed': String(filter === key),
        onClick: () => { state.filter = key; state.all = false; redraw(); } }, key === 'all' ? label : `${label} · ${count(key)}`)));
    fill();
    const kinds = EVENT_KINDS.map(kind => `${count(kind)} ${kind}`).join(' · ');
    return [h('p', { class: 'fine st-counts' }, `${plural(list.length, 'event')} · ${kinds}`),
        h('div', { class: 'st-bar' }, search, chips, h('button', { type: 'button', class: 'btn2 pri st-new', onClick: () => create(list, ctx) }, 'New event')), rows];
}

/**
 * `section`: `{ key, where, value, count }`; `ctx`: the editor context (views/route.js). Returns the event list, or the page of the event the focus
 * names ("worldEvents.<n>", from Go to or a row). The list's search and filter live in ctx.keep('events'), so they outlive the redraw after a change.
 */
export function editSection(section, ctx) {
    const list = Array.isArray(section.value) ? section.value : null;
    if (section.key !== 'worldEvents' || !list || !list.every(isObj) || ctx.legacy || typeof ctx.commit !== 'function' || typeof ctx.keep !== 'function') return [renderSection(section, ctx)];
    const state = ctx.keep('events');
    const root = h('div', { class: 'st-sec st-events', dataset: { key: 'worldEvents' } });
    const bad = list.map((_, index) => (ctx.problems ?? []).filter(problem => inRecord(problem, index)));
    const open = /^worldEvents\.(\d+)$/.exec(ctx.focus?.rec ?? '');
    const redraw = () => root.replaceChildren(...(open && Number(open[1]) < list.length ? eventPage(list, Number(open[1]), bad, ctx, state, redraw) : listView(list, bad, ctx, state, redraw)));
    redraw();
    return [root];
}
