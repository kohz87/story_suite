// The powers and scores editor (views/route.js EDITORS: powers, scores): one list per key and, for one record, its page (mock MK-1). A power has
// name, id, start, other names, factions and the places it holds (a place picker); a score has name, id, what it means, its range, start and
// drift, with a drift preview curve. Both show what uses them and end in the JSON row. A record opens with Go to (focus "powers.<n>" or
// "scores.<n>"); while one is open, the other key's section draws nothing, so the page is that one record.

import { h, svgEl } from '../../ui/kit/dom.js';
import { STANDING } from '../../packs/limits.js';
import { fieldRow, setProblem } from '../form/fields.js';
import { chipList } from '../form/list.js';
import { openPicker } from '../form/pick.js';
import { renderSection } from '../views/records.js';
import { jsonRow } from '../views/json-row.js';
import { definedIds, usedBy } from '../model/refs.js';
import { renameId } from '../model/rename.js';
import { partOfPath } from '../parts.js';

const PART = 'powers';
const KEYS = {
    powers: { kind: 'power', noun: 'power', title: 'Power', plural: 'Powers', none: 'No powers yet: rulers, factions and guilds whose standing events move.', base: 'new-power', icon: '⚑' },
    scores: { kind: 'score', noun: 'score', title: 'Score', plural: 'Scores', none: 'No scores yet: world meters such as stability or danger.', base: 'new-score', icon: '↕' },
};
const ROLE = { power: 'changes it', score: 'changes it', menu: 'offered to the story', weight: 'weighs an outcome', likelier: 'makes it likelier', less: 'makes it less likely', holds: 'holds it' };
// The preview's drift: points a day back toward the start. The game does not move scores on their own yet, so this is a sketch, kept in one place.
const DRIFT_PER_DAY = 1;
const DAYS = 90;
const isObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const contentOf = ctx => ctx.doc?.doc?.content ?? ctx.doc?.content ?? {};
const rangeOf = score => (Array.isArray(score.range) && score.range.length === 2 && score.range.every(Number.isFinite) && score.range[0] < score.range[1] ? score.range : [STANDING.min, STANDING.max]);
const minus = n => String(n).replace('-', '−');

function lineOf(key, record) {
    const start = Number.isFinite(record.start) ? `starts at ${minus(record.start)}` : 'no start';
    if (key === 'powers') return [start, Array.isArray(record.holds) && record.holds.length ? `holds ${plural(record.holds.length, 'place')}` : null, record.factions?.[0]].filter(Boolean).join(' · ');
    const [low, high] = rangeOf(record);
    return [start, `${minus(low)} to ${minus(high)}`, record.drift === false ? 'no drift' : 'drifts'].join(' · ');
}

function freeId(ctx, key, list, base) {
    const taken = new Set([...definedIds(ctx.refs, KEYS[key].kind).map(item => item.id), ...list.map(record => record?.id)]);
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    return id;
}

// One list (a missing key draws as an empty list whose add makes it).
function listNode(key, list, ctx) {
    const spec = KEYS[key];
    const bad = at => (ctx.problems ?? []).filter(problem => String(problem.path).startsWith(`content.${key}[${at}]`)).length;
    const add = () => {
        const record = { id: freeId(ctx, key, list, spec.base), name: `New ${spec.noun}`, start: 0 };
        const made = ctx.commit(Array.isArray(contentOf(ctx)[key]) ? [{ op: 'insert', path: ['content', key, list.length], value: record }] : [{ op: 'set', path: ['content', key], value: [record] }]);
        if (made?.ok) ctx.go(PART, `${key}.${list.length}`);
    };
    const rows = list.map((record, at) => h('button', { type: 'button', class: 'st-prow', dataset: { rec: `${key}.${at}` }, onClick: () => ctx.go(PART, `${key}.${at}`) },
        h('i', { 'aria-hidden': 'true' }, spec.icon),
        h('span', null, h('b', String(record.name ?? record.id ?? `#${at + 1}`), bad(at) ? h('span', { class: 'tg2 st-bad' }, `✕ ${bad(at)}`) : null), h('small', lineOf(key, record))),
        h('span', { 'aria-hidden': 'true' }, '›')));
    return h('div', { class: 'st-sec', dataset: { key } },
        h('div', { class: 'secl2' }, `${spec.plural} · ${list.length}`),
        h('section', { class: 'sgrp st-plist-wrap' },
            list.length ? h('div', { class: 'slist st-plist' }, rows) : h('p', { class: 'fine' }, spec.none),
            h('div', { class: 'addrow' }, h('button', { type: 'button', class: 'btn2 st-add', dataset: { add: key }, onClick: add }, `+ Add a ${spec.noun}`))));
}

const group = (title, ...rows) => h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, title), rows.flat().filter(Boolean));

function usedNode(ctx, kind, id) {
    const uses = typeof id === 'string' ? usedBy(ctx.refs, kind, id).filter(use => use.pack !== 'other') : [];
    const rows = uses.map(use => {
        const where = partOfPath(`content.${use.owner.part}${typeof use.owner.index === 'number' ? `[${use.owner.index}]` : ''}`, ctx.kind);
        const label = use.owner.id ?? use.rec;
        return h('div', { class: 'srow st-used', dataset: { rec: use.rec } },
            h('span', { class: 'lb' }, h('b', String(label)), h('small', `${use.owner.part} · ${ROLE[use.role] ?? 'tests it'}`)),
            h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2', 'aria-label': `Go to ${label}`, onClick: () => ctx.go(where.part, where.rec ?? use.rec) }, 'Go to')));
    });
    const how = kind === 'power' ? `power:${id}` : `score:${id}`;
    return group('Used by', rows.length ? rows : h('p', { class: 'fine' }, typeof id === 'string' ? `No event or template names it yet (as ${how}).` : 'Give it an id for events and templates to name it.'));
}

// The places a power holds: chips with ×, and a picker over the pack's places.
function holdsRow(record, ctx, problem, put) {
    const places = definedIds(ctx.refs, 'place');
    const held = Array.isArray(record.holds) ? record.holds : [];
    const nameOf = id => places.find(place => place.id === id)?.name ?? String(id);
    const items = places.map(place => ({ id: place.id, label: place.name, sub: place.id, disabled: held.includes(place.id), tag: held.includes(place.id) ? 'held' : null }));
    const row = h('div', { class: 'srow wide', dataset: { key: 'holds', type: 'pick' } },
        h('span', { class: 'lb' }, h('b', 'Holds'), h('small', 'The places it rules or keeps')),
        h('span', { class: 'ctl' }, h('span', { class: 'chips3' },
            held.length ? null : h('span', { class: 'none' }, 'None'),
            held.map((id, at) => h('span', { class: 'kc' }, nameOf(id), h('button', { type: 'button', 'aria-label': `Remove ${nameOf(id)}`, onClick: () => put('holds', held.filter((_, i) => i !== at)) }, '×'))),
            h('button', { type: 'button', class: 'btn2 st-pickbtn', onClick: () => openPicker({}, { title: 'Pick a place it holds', items }, id => put('holds', [...held, id])) }, '+ Add a place'))));
    return setProblem(row, problem);
}

// The drift preview: the score pushed to a value, then each day afterwards, against its start.
function driftCurve(score, state) {
    const [low, high] = rangeOf(score);
    const start = Number.isFinite(score.start) ? Math.min(high, Math.max(low, score.start)) : 0;
    const far = Math.abs(high - start) >= Math.abs(start - low) ? high : low;
    const pushed = Number.isFinite(state.pushed) ? Math.min(high, Math.max(low, state.pushed)) : far;
    const drifts = score.drift !== false;
    const at = day => (drifts ? pushed + Math.sign(start - pushed) * Math.min(Math.abs(start - pushed), day * DRIFT_PER_DAY) : pushed);
    const back = drifts ? Math.ceil(Math.abs(start - pushed) / DRIFT_PER_DAY) : null;
    const W = 300, H = 120, P = 8;
    const x = day => P + (day / DAYS) * (W - 2 * P);
    const y = value => P + ((high - value) / (high - low)) * (H - 2 * P);
    const points = Array.from({ length: DAYS + 1 }, (_, day) => `${x(day).toFixed(1)},${y(at(day)).toFixed(1)}`).join(' ');
    const said = !drifts ? `Pushed to ${minus(pushed)}, it stays there until an event or effect moves it.`
        : back === 0 ? `At its start (${minus(start)}) it has nowhere to drift.`
            : `Pushed to ${minus(pushed)}, it is back at its start (${minus(start)}) after ${plural(back, 'day')}${back > DAYS ? ` (the curve shows ${DAYS})` : ''}.`;
    return { said, pushed, svg: svgEl('svg', { class: 'st-drift', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': said, style: 'width:100%;max-width:520px;height:auto;display:block' },
        svgEl('rect', { x: P, y: P, width: W - 2 * P, height: H - 2 * P, fill: 'none', stroke: 'currentColor', 'stroke-opacity': '.2' }),
        svgEl('line', { class: 'st-drift-start', x1: P, x2: W - P, y1: y(start), y2: y(start), stroke: 'currentColor', 'stroke-opacity': '.45', 'stroke-dasharray': '4 4' }),
        svgEl('polyline', { class: 'st-drift-line', points, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linejoin': 'round' })) };
}

function driftGroup(score, ctx, rec) {
    const state = ctx.keep?.(`powers:drift:${rec}`) ?? {};
    const box = h('div', { class: 'srow wide st-drift-row', dataset: { key: 'drift-preview' } });
    const draw = () => {
        const { said, svg } = driftCurve(score, state);
        box.replaceChildren(h('span', { class: 'lb' }, h('b', 'If something pushes it'), h('small', said)), h('span', { class: 'ctl' }, svg));
    };
    const [low, high] = rangeOf(score);
    const push = fieldRow({ type: 'number', key: 'pushed', label: 'Pushed to', hint: `A value from ${minus(low)} to ${minus(high)} to try; blank: the far end`, value: driftCurve(score, state).pushed }, (key, value) => { state.pushed = value ?? undefined; draw(); });
    draw();
    return group('Drift preview', push, box,
        h('p', { class: 'fine' }, `A sketch: the game does not move scores on their own yet. It assumes a score that drifts goes back toward its start by ${DRIFT_PER_DAY} a day; one with drift off stays put.`));
}

function recordPage(key, list, at, ctx) {
    const spec = KEYS[key];
    const record = list[at];
    const where = ['content', key, at];
    const rec = `${key}.${at}`;
    const prefix = `content.${key}[${at}]`;
    const mine = (ctx.problems ?? []).filter(problem => problem.path === prefix || String(problem.path).startsWith(`${prefix}.`) || String(problem.path).startsWith(`${prefix}[`));
    const problemOf = field => mine.find(problem => problem.path === `${prefix}.${field}` || String(problem.path).startsWith(`${prefix}.${field}[`))?.message;
    const said = h('p', { class: 'st-problem', role: 'alert', hidden: true });
    const tell = text => { said.textContent = text ?? ''; said.hidden = !text; };
    const done = result => { if (!result?.ok) tell(result?.refusal ?? 'The change was not made.'); return result; };
    // One field; `undefined` takes the key out, as the checker reads a missing one.
    const put = (field, value) => {
        if (value === undefined && !Object.hasOwn(record, field)) return;
        done(ctx.commit([value === undefined ? { op: 'remove', path: [...where, field] } : { op: 'set', path: [...where, field], value }]));
    };
    const text = (field, value) => put(field, String(value).trim() === '' ? undefined : String(value).trim());
    const listOrGone = (field, values) => put(field, values.length ? values : undefined);
    const rename = (field, value) => {
        const id = String(value).trim();
        if (id === record.id) return;
        const plan = typeof record.id !== 'string' ? { ok: true, patches: [{ op: 'set', path: [...where, 'id'], value: id }] } : renameId(ctx.refs, ctx.doc, spec.kind, record.id, id);
        if (!plan.ok) return tell(plan.refusal);
        if (done(ctx.commit(plan.patches))?.ok && plan.elsewhere?.length) (ctx.say ?? tell)(`The other open pack names this ${spec.noun} ${plural(plan.elsewhere.length, 'time')}; change those by hand.`);
    };
    const row = (fields, change) => fieldRow({ ...fields, problem: problemOf(fields.key) }, change);
    const whole = (field, value) => { if (value === null) put(field, undefined); else if (Number.isFinite(value)) put(field, value); };
    const [low, high] = rangeOf(record);
    const setRange = (index, value) => {
        if (!Number.isFinite(value)) return;
        const next = index === 0 ? [value, high] : [low, value];
        if (next[0] !== low || next[1] !== high) put('range', next);
    };
    const head = key === 'powers'
        ? [group('Power',
            row({ type: 'text', key: 'name', label: 'Name', hint: 'Shown in lists and to the Director', value: record.name }, text),
            row({ type: 'text', key: 'id', label: 'Id', hint: 'Events and templates name it by this (power:<id>). Renaming changes them too', value: record.id }, rename),
            row({ type: 'number', key: 'start', label: 'Start', hint: `Its standing when play begins, ${minus(STANDING.min)} to ${STANDING.max}`, value: record.start }, whole)),
        group('Who and where',
            chipList({ key: 'aliases', label: 'Other names', hint: 'What the story may call it instead', values: record.aliases, placeholder: 'Add a name…' }, listOrGone),
            chipList({ key: 'factions', label: 'Factions', hint: 'The groups that serve it', values: record.factions, placeholder: 'Add a faction…' }, listOrGone),
            holdsRow(record, ctx, problemOf('holds'), listOrGone))]
        : [group('Score',
            row({ type: 'text', key: 'name', label: 'Name', hint: 'Shown in lists and to the Director', value: record.name }, text),
            row({ type: 'text', key: 'id', label: 'Id', hint: 'Events and templates name it by this (score:<id>). Renaming changes them too', value: record.id }, rename),
            row({ type: 'long', key: 'means', label: 'Means', hint: 'One plain sentence of at most 300 characters', value: record.means, rows: 2 }, text)),
        group('Range and start',
            fieldRow({ type: 'number', key: 'range.low', label: 'Lowest', hint: `Blank range: ${minus(STANDING.min)} to ${STANDING.max}`, value: low, problem: problemOf('range') }, (field, value) => setRange(0, value)),
            fieldRow({ type: 'number', key: 'range.high', label: 'Highest', value: high }, (field, value) => setRange(1, value)),
            row({ type: 'number', key: 'start', label: 'Start', hint: 'Its value when play begins, inside the range', value: record.start }, whole),
            row({ type: 'toggle', key: 'drift', label: 'Drifts', hint: 'Off: only events and effects move it', value: record.drift !== false }, (field, value) => put('drift', value ? undefined : false))),
        driftGroup(record, ctx, rec)];
    const json = jsonRow({ value: record, steps: where, noun: spec.noun, problems: mine, focus: ctx.focus?.rec === rec ? ctx.focus : null, state: ctx.keep?.(`json:${rec}`) ?? {} }, patches => ctx.commit(patches));
    const uses = typeof record.id === 'string' ? usedBy(ctx.refs, spec.kind, record.id).filter(use => use.pack !== 'other' && !use.dangling).length : 0;
    const copy = () => {
        const id = freeId(ctx, key, list, `${record.id ?? spec.noun}-copy`);
        if (done(ctx.commit([{ op: 'insert', path: ['content', key, at + 1], value: { ...structuredClone(record), id, name: `${record.name ?? id} copy` } }]))?.ok) ctx.go(PART, `${key}.${at + 1}`);
    };
    const drop = () => {
        if (uses) return tell(`Used in ${plural(uses, 'place')}: take those out first.`);
        if (done(ctx.commit([{ op: 'remove', path: where }]))?.ok) ctx.go(PART);
    };
    const page = h('section', { class: 'st-rec', dataset: { rec }, tabindex: '-1', 'aria-label': String(record.name ?? record.id ?? `${spec.title} ${at + 1}`) },
        h('div', { class: 'st-bar', style: 'display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap' },
            h('button', { type: 'button', class: 'btn2 st-back', onClick: () => ctx.go(PART) }, '‹ Powers & scores'),
            h('span', { class: 'st-acts' }, h('button', { type: 'button', class: 'btn2 st-dup', onClick: copy }, 'Duplicate'), h('button', { type: 'button', class: 'btn2 dng st-del', onClick: drop }, 'Delete'))),
        h('div', { class: 'st-rt st-entryhead' }, h('b', String(record.name ?? record.id ?? '')), h('small', `${spec.title} ${at + 1} of ${list.length}`), record.drift === false ? h('span', { class: 'tg2' }, 'no drift') : null),
        said, h('div', { class: 'st-edit', dataset: { rec: key } }, head, usedNode(ctx, spec.kind, record.id)), json);
    const field = ctx.focus?.rec === rec ? { range: 'range.low' }[ctx.focus.path?.[0]] ?? ctx.focus.path?.[0] : null;
    if (field !== null && field !== undefined) page.querySelector(`[data-key="${field}"] input, [data-key="${field}"] textarea`)?.classList.add('st-at');
    return page;
}

/** `section`: `{ key: 'powers' | 'scores', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the list, or the open record's page. */
export function editSection(section, ctx) {
    const key = section.key;
    const list = section.value;
    if (!KEYS[key] || !Array.isArray(list) || !list.every(isObj) || ctx.legacy || typeof ctx.commit !== 'function') return [renderSection(section, ctx)];
    const content = contentOf(ctx);
    const open = /^(powers|scores)\.(\d+)$/.exec(ctx.focus?.rec ?? '');
    const openList = open && Array.isArray(content[open[1]]) ? content[open[1]] : null;
    if (open && openList && Number(open[2]) < openList.length) return open[1] === key ? [h('div', { class: 'st-sec', dataset: { key } }, recordPage(key, list, Number(open[2]), ctx))] : [];
    // The pack has only one of the two keys: its section also offers the other, so the first score (or power) can be added here.
    const other = key === 'powers' ? 'scores' : 'powers';
    const sibling = content[other] === undefined ? listNode(other, [], ctx) : null;
    return key === 'powers' ? [listNode(key, list, ctx), sibling] : [sibling, listNode(key, list, ctx)];
}
