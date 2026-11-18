// The job: the world start form (views/route.js EDITORS; `content.start` of a format 4 world, drawn in the Conditions part). Three cards
// in the mock MK-1 settings rows: the start date (era, year, month number, day, hour, minute; the month named from the open game pack's
// calendar or the built-in one), the start place (an id picker over the pack's places), and the world at the start (`world.set` condition
// strings and `world.facts` ids as chip lists). A key the checker does not take (a format 3 `scene` or `inventory`) is shown with Remove.
// The checker's problems show under their field, and the whole start has its JSON row. Every change is one commit.

import { h } from '../../ui/kit/dom.js';
import { WORLD_START_FIELDS } from '../../packs/limits.js';
import { GREGORIAN } from '../../packs/validate/world-pack-parts/date-anchor.js';
import { fieldRow, setProblem } from '../form/fields.js';
import { chipList } from '../form/list.js';
import { openPicker } from '../form/pick.js';
import { jsonRow } from '../views/json-row.js';
import { renderSection } from '../views/records.js';
import { definedIds } from '../model/refs.js';

const BASE = ['content', 'start'];
const REQUIRED = ['year', 'month', 'day'];
const DATE_ROWS = [
    ['era', 'text', 'Era', 'A short name for the era, like "CY". Blank: none'],
    ['year', 'number', 'Year', 'A whole number from 0'],
    ['month', 'number', 'Month', 'The month\'s number in the calendar'],
    ['day', 'number', 'Day', 'The day of the month, from 1'],
    ['hour', 'number', 'Hour', 'Blank: the start of the day'],
    ['minute', 'number', 'Minute', 'Blank: on the hour'],
];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// The problems under `content.start.<field>` (and below it); `exact` keeps the ones for that field alone.
function problemsAt(ctx, field, exact = false) {
    const at = `content.start.${field}`;
    return (ctx.problems ?? []).filter(problem => problem.path === at || (!exact && (String(problem.path).startsWith(`${at}.`) || String(problem.path).startsWith(`${at}[`))));
}
const firstMessage = list => list[0]?.message ?? '';

// The month's name in the calendar the world is paired with: the open game pack's, or the built-in one.
function monthHint(month, other) {
    const own = isObject(other) && Array.isArray(other.content?.calendar?.months) && other.content.calendar.months.length ? other.content.calendar.months : null;
    const months = own ?? GREGORIAN;
    const where = own ? (other.name || other.id || 'the open game pack') : 'the built-in calendar';
    if (!Number.isInteger(month)) return `The month's number in the calendar (${where} has ${months.length})`;
    const found = months[month - 1];
    return found ? `${found.name} in ${where}` : `${where} has ${months.length} months, so this month never comes: see Pairing`;
}

function dateCard(start, ctx, put) {
    const date = isObject(start.date) ? start.date : null;
    const remove = () => put(['date'], undefined);
    if (!date) {
        const add = () => put(['date'], { year: 1, month: 1, day: 1 });
        const problem = firstMessage(problemsAt(ctx, 'date', true));
        const row = h('div', { class: 'srow st-nodate', dataset: { key: 'date' } }, h('span', { class: 'lb' }, h('b', start.date === undefined ? 'No start date' : 'The start date is not a date'),
            h('small', 'The story starts on day 1 of month 1 of year 1. Give the world its own "now".')),
            h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-adddate', onClick: add }, start.date === undefined ? '+ Add a start date' : 'Start over')));
        return h('section', { class: 'sgrp st-date' }, h('div', { class: 'gt' }, 'Start date'), setProblem(row, problem));
    }
    const rows = DATE_ROWS.map(([key, type, label, hint]) => {
        const problem = firstMessage(problemsAt(ctx, `date.${key}`));
        const row = fieldRow({ type, key: `date.${key}`, label, hint: key === 'month' ? monthHint(date.month, ctx.other) : hint, value: date[key] ?? (type === 'number' ? null : ''), problem }, (_, value) => {
            const blank = value === null || (typeof value === 'string' && value.trim() === '');
            if (blank && REQUIRED.includes(key)) { setProblem(row, `${label} is needed: a start date has a year, a month and a day.`); return; }
            if (blank) { if (Object.hasOwn(date, key)) put(['date', key], undefined); return; }
            put(['date', key], type === 'number' ? value : value.trim());
        });
        return row;
    });
    const drop = h('div', { class: 'srow subrow' }, h('span', { class: 'lb' }, h('small', 'Without a date the story starts on day 1 of month 1 of year 1.')),
        h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 dng st-dropdate', onClick: remove }, 'Remove the date')));
    return h('section', { class: 'sgrp st-date' }, h('div', { class: 'gt' }, 'Start date'), rows, drop);
}

function placeCard(start, ctx, put) {
    const places = definedIds(ctx.refs, 'place');
    const current = typeof start.place === 'string' ? start.place : '';
    const shown = current ? (places.find(item => item.id === current)?.name ?? current) : 'None';
    const items = [{ id: '', label: 'No start place', sub: 'The story says where it begins' }, ...places.map(item => ({ id: item.id, label: item.name, sub: item.id, tag: item.id === current ? 'now' : '' }))];
    const pick = () => openPicker({}, { title: 'Pick the start place', items }, id => { if (id !== current) put(['place'], id || undefined); });
    const row = h('div', { class: 'srow', dataset: { key: 'place', type: 'pick' } },
        h('span', { class: 'lb' }, h('b', 'Place'), h('small', 'Where the story begins: one of this pack\'s places')),
        h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-pickbtn', onClick: pick }, shown),
            current && ctx.go ? h('button', { type: 'button', class: 'lnk st-open-place', onClick: () => { const at = (ctx.doc?.content?.places ?? []).findIndex(place => place?.id === current); if (at >= 0) ctx.go('map', `places.${at}`); } }, 'Open ›') : null));
    return h('section', { class: 'sgrp st-place' }, h('div', { class: 'gt' }, 'Start place'), setProblem(row, firstMessage(problemsAt(ctx, 'place'))));
}

function worldCard(start, ctx, put) {
    const world = isObject(start.world) ? start.world : {};
    const conditions = definedIds(ctx.refs, 'condition').map(item => item.id);
    // An empty list leaves `world` (and the start) as the checker reads a missing one.
    const change = field => (_, values) => {
        const next = { ...world };
        if (values.length) next[field] = values; else delete next[field];
        put(['world'], Object.keys(next).length ? next : undefined);
    };
    const set = chipList({ key: 'world.set', label: 'Conditions that hold', hint: `"<condition>@<place, region or realm>: <how long>", like "lamps-out@the-fen: 10 days".${conditions.length ? ` This pack's conditions: ${conditions.join(', ')}.` : ''}`,
        values: Array.isArray(world.set) ? world.set : [], placeholder: 'Add a condition…', none: 'None' }, change('set'));
    const facts = chipList({ key: 'world.facts', label: 'Facts already true', hint: 'Fact ids in lower-case-with-hyphens, like "border-closed"; events and gates can test them',
        values: Array.isArray(world.facts) ? world.facts : [], placeholder: 'Add a fact…', none: 'None' }, change('facts'));
    setProblem(set, firstMessage(problemsAt(ctx, 'world.set')) || firstMessage(problemsAt(ctx, 'world', true)));
    setProblem(facts, firstMessage(problemsAt(ctx, 'world.facts')));
    return h('section', { class: 'sgrp st-world' }, h('div', { class: 'gt' }, 'The world at the start'), set, facts);
}

// The keys `content.start` may not hold in format 4, each with the checker's pointer and Remove.
function strayCard(start, put) {
    const stray = Object.keys(start).filter(key => !WORLD_START_FIELDS.keys.includes(key));
    if (!stray.length) return null;
    return h('section', { class: 'sgrp st-stray' }, h('div', { class: 'gt' }, `Not world start fields · ${stray.length}`),
        stray.map(key => h('div', { class: 'srow', dataset: { key } }, h('span', { class: 'lb' }, h('b', key), h('small', WORLD_START_FIELDS.moved[key] ? `Not in a format 4 world: ${WORLD_START_FIELDS.moved[key]}.` : 'The pack checker does not take this field.')),
            h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 dng st-dropkey', onClick: () => put([key], undefined) }, 'Remove')))));
}

/** `section`: `{ key: 'start', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the start's cards. */
export function editSection(section, ctx) {
    const start = section.value;
    if (ctx.legacy || typeof ctx.commit !== 'function' || !isObject(start)) return [renderSection(section, ctx)];
    const said = h('p', { class: 'st-problem', role: 'alert', hidden: true });
    // One change of the start: `undefined` takes the key out, and a start left with nothing in it stays as `{}`.
    const put = (steps, value) => {
        const result = ctx.commit([value === undefined ? { op: 'remove', path: [...BASE, ...steps] } : { op: 'set', path: [...BASE, ...steps], value }]);
        said.textContent = result?.ok ? '' : (result?.refusal ?? 'The change was not made.');
        said.hidden = Boolean(result?.ok);
    };
    const json = jsonRow({ value: start, steps: BASE, noun: 'start', problems: ctx.problems ?? [], focus: null, state: ctx.keep?.('json:start') ?? {} }, patches => ctx.commit(patches));
    return [h('div', { class: 'st-sec st-start', dataset: { key: 'start', rec: 'start' } },
        h('div', { class: 'secl2' }, 'Start'),
        said, strayCard(start, put), dateCard(start, ctx, put), placeCard(start, ctx, put), worldCard(start, ctx, put), json)];
}
