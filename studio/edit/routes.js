// The routes editor: a searchable list of routes and, for one route, its record page (mock MK-1): name, from and to (place pickers), kind
// (a picker of the pack's route kinds and the engine's classes), km, hours, corridor, note, where it is used, and its JSON row. A record is
// opened with Go to (focus on "routes.<n>"), so the Studio's own redraw and back button keep working.

import { h } from '../../ui/kit/dom.js';
import { ROUTE_CLASSES } from '../../packs/limits.js';
import { classOfKind } from '../../packs/validate/world-pack-parts/kinds.js';
import { fieldRow, markFocus } from '../form/fields.js';
import { openPicker } from '../form/pick.js';
import { renderSection } from '../views/records.js';
import { jsonRow } from '../views/json-row.js';
import { definedIds, usedBy } from '../model/refs.js';
import { renameId } from '../model/rename.js';

const PART = 'map';
const SHOWN = 60;
const BASE = ['content', 'routes'];
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
// The id other records name a route by: its name, or "from–to" when it has none (as the reference index keys it).
const keyOf = route => route.name ?? `${route.from}–${route.to}`;

function recordIndex(ctx, count) {
    const match = /^routes\.(\d+)$/.exec(ctx.focus?.rec ?? '');
    return match && Number(match[1]) < count ? Number(match[1]) : -1;
}

// Place id → its display name, for rows and buttons.
function placeNamer(ctx) {
    const names = new Map(definedIds(ctx.refs, 'place').map(item => [item.id, item.name]));
    return id => names.get(id) ?? id ?? '?';
}

const titleOf = (route, name) => route.name ?? `${name(route.from)} → ${name(route.to)}`;
const subOf = (route, name) => [route.name ? `${name(route.from)} → ${name(route.to)}` : null, route.kind, typeof route.km === 'number' ? `${route.km} km` : null].filter(Boolean).join(' · ');

// A free route name, for a copy or for a new route between two places that are already joined.
function freeName(section, base) {
    const taken = new Set(section.value.map(keyOf));
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base} ${n}`;
    return name;
}

// A new route: the first two places no route joins yet, or (all joined) the first two places with a name of its own.
function newRoute(section, ctx) {
    const places = definedIds(ctx.refs, 'place').map(item => item.id);
    const joined = new Set(section.value.map(route => [route.from, route.to].sort().join('|')));
    for (const [n, from] of places.entries()) {
        for (const to of places.slice(n + 1)) if (!joined.has([from, to].sort().join('|'))) return { from, to, kind: 'road' };
    }
    return { name: freeName(section, 'New route'), from: places[0], to: places[1], kind: 'road' };
}

function listPage(section, ctx) {
    const name = placeNamer(ctx);
    const rows = h('div', { class: 'slist st-plist' });
    const count = h('p', { class: 'fine' });
    const kept = ctx.keep?.('routes:list') ?? {};
    const draw = () => {
        const needle = (kept.q ?? '').trim().toLowerCase();
        const hits = section.value.map((route, at) => ({ route, at }))
            .filter(({ route }) => !needle || `${titleOf(route, name)} ${route.from ?? ''} ${route.to ?? ''} ${subOf(route, name)} ${route.corridor ?? ''}`.toLowerCase().includes(needle));
        const shown = kept.all || needle ? hits : hits.slice(0, SHOWN);
        rows.replaceChildren(...shown.map(({ route, at }) => h('button', { type: 'button', class: 'st-prow', dataset: { rec: `routes.${at}` }, onClick: () => ctx.go(PART, `routes.${at}`) },
            h('span', null, h('b', titleOf(route, name)), subOf(route, name) ? h('small', subOf(route, name)) : null), h('span', { 'aria-hidden': 'true' }, '›'))));
        if (hits.length > shown.length) rows.append(h('button', { type: 'button', class: 'btn2 st-more', onClick: () => { kept.all = true; draw(); } }, `Show all ${hits.length}`));
        count.textContent = `${hits.length} of ${section.value.length}`;
    };
    const find = h('input', { class: 'psrch txt2', placeholder: 'Find a route…', 'aria-label': 'Find a route' });
    find.value = kept.q ?? '';
    find.addEventListener('input', () => { kept.q = find.value; draw(); });
    draw();
    const enough = definedIds(ctx.refs, 'place').length >= 2;
    const add = () => {
        const made = ctx.commit([{ op: 'insert', path: [...BASE, section.value.length], value: newRoute(section, ctx) }]);
        if (made?.ok) ctx.go(PART, `routes.${section.value.length}`);
    };
    return h('section', { class: 'sgrp st-plist-wrap' }, find, rows, count, h('div', { class: 'addrow' },
        h('button', { type: 'button', class: 'btn2 st-add', disabled: !enough, onClick: add }, '+ Add a route'),
        enough ? null : h('small', { class: 'fine' }, 'A route joins two places: add two places first.')));
}

// A button row that opens the picker.
function pickRow(spec, onPick) {
    const row = h('div', { class: 'srow', dataset: { key: spec.key, type: 'pick' } },
        h('span', { class: 'lb' }, h('b', spec.label), spec.hint ? h('small', spec.hint) : null),
        h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-pickbtn', onClick: () => openPicker({}, { title: spec.title, items: spec.items }, onPick) }, spec.shown || 'None')));
    if (spec.problem) {
        row.classList.add('bad');
        row.append(h('small', { class: 'st-problem', role: 'alert' }, spec.problem));
    }
    return row;
}

// The kinds a route may take: the pack's own route kinds (with the class each counts as), then the engine classes it does not map.
function kindItems(content) {
    const own = content.routeKinds && typeof content.routeKinds === 'object' ? Object.keys(content.routeKinds) : [];
    return [...own.map(kind => ({ id: kind, label: kind, sub: classOfKind(kind, content.routeKinds, ROUTE_CLASSES) ?? 'not an engine class' })),
        ...ROUTE_CLASSES.filter(kind => !own.includes(kind)).map(kind => ({ id: kind, label: kind, sub: 'engine class' }))];
}

function recordPage(section, ctx, at) {
    const route = section.value[at];
    const content = ctx.doc?.doc?.content ?? ctx.doc?.content ?? {};
    const where = [...BASE, at];
    const rec = `routes.${at}`;
    const name = placeNamer(ctx);
    const mine = (ctx.problems ?? []).filter(problem => String(problem.path).startsWith(`content.routes[${at}]`));
    const problemOf = field => mine.find(problem => problem.path === `content.routes[${at}].${field}`)?.message;
    const state = ctx.keep?.(`routes:${rec}`) ?? {};
    const said = h('p', { class: 'st-problem', role: 'alert', hidden: true });
    const tell = text => { said.textContent = text ?? ''; said.hidden = !text; };
    const users = usedBy(ctx.refs, 'route', keyOf(route));
    // A change to the name, or to an end of an unnamed route, changes the key other records name it by; those are left for the author.
    const keyWarning = () => (users.length ? `${plural(users.length, 'record')} named this route "${keyOf(route)}"; change those by hand.` : null);
    // A note that follows a change goes to ctx.say: the commit has drawn the page again, so this page's own line is gone.
    const apply = (patches, warn) => {
        const result = ctx.commit(patches);
        if (!result?.ok) tell(result?.refusal ?? 'The change was not made.');
        else if (warn) (ctx.say ?? tell)(warn);
        return result;
    };
    // One field: an empty value takes the key out of the record, as the checker reads a missing one.
    const put = (field, value) => {
        const gone = value === '' || value === null || value === undefined;
        if (gone && !Object.hasOwn(route, field)) return;
        const rekeys = field === 'name' || (route.name === undefined && (field === 'from' || field === 'to'));
        apply([gone ? { op: 'remove', path: [...where, field] } : { op: 'set', path: [...where, field], value }], rekeys ? keyWarning() : null);
    };
    const rename = (field, to) => {
        const text = String(to ?? '').trim();
        if (text === (route.name ?? '')) return;
        if (route.name === undefined || !text) return put('name', text);
        const done = renameId(ctx.refs, ctx.doc, 'route', route.name, text);
        if (!done.ok) return tell(done.refusal);
        apply(done.patches, done.elsewhere?.length ? `The other open pack names this route ${plural(done.elsewhere.length, 'time')}; change those by hand.` : null);
    };
    const placeItems = other => definedIds(ctx.refs, 'place').map(item => ({ id: item.id, label: item.name, sub: item.id, ...(item.id === other ? { disabled: true, tag: 'other end' } : {}) }));
    const row = (spec, change) => fieldRow({ ...spec, problem: problemOf(spec.key) }, change);
    const num = (key, label, hint) => row({ type: 'number', key, label, hint, value: route[key] }, (field, value) => { if (typeof value === 'number' || value === null) put(field, value); });
    const kindClass = classOfKind(route.kind, content.routeKinds, ROUTE_CLASSES);
    const isSea = kindClass === 'sea';

    const form = h('div', { class: 'st-edit', dataset: { rec: 'routes' } },
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Route'),
            row({ type: 'text', key: 'name', label: 'Name', hint: `Other records name it by this. Blank: "${route.from ?? 'from'}–${route.to ?? 'to'}". Needed when two routes join the same places`, value: route.name }, rename),
            pickRow({ key: 'from', label: 'From', hint: 'The place it starts at', shown: route.from ? name(route.from) : '', title: 'Pick where it starts', items: placeItems(route.to), problem: problemOf('from') }, id => put('from', id)),
            pickRow({ key: 'to', label: 'To', hint: 'The place it ends at (it runs both ways)', shown: route.to ? name(route.to) : '', title: 'Pick where it ends', items: placeItems(route.from), problem: problemOf('to') }, id => put('to', id)),
            pickRow({ key: 'kind', label: 'Kind', hint: kindClass ? `Counts as: ${kindClass}` : 'What sort of way it is, like road or river', shown: route.kind ?? '', title: 'Pick a kind', items: kindItems(content), problem: problemOf('kind') }, id => put('kind', id))),
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Travel'),
            num('km', 'Km', 'How long it is. Without km (or hours) travel cannot time it'),
            num('hours', 'Hours', isSea ? 'The crossing time; when given, it sets the days instead of the km' : 'Only for a sea route: the crossing time'),
            row({ type: 'text', key: 'corridor', label: 'Corridor', hint: 'The river or road line it runs along, which the travel rules may name (a levee road)', value: route.corridor }, put)),
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Details'),
            row({ type: 'long', key: 'note', label: 'Note', hint: 'What the story should know about the way', value: route.note, rows: 3 }, put)),
        h('section', { class: 'sgrp st-usedby' }, h('div', { class: 'gt' }, 'Used by'),
            h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('small', users.length ? `${plural(users.length, 'record')} in the pack name${users.length === 1 ? 's' : ''} it, such as ${users.slice(0, 3).map(use => use.path.join('.')).join(', ')}.` : `No other record names this route (as "${keyOf(route)}").`)))));
    if (state.json === undefined) state.json = {};
    // Go to: the field the path names; a path no field here shows opens the JSON row at it instead.
    const marked = ctx.focus?.rec === rec && markFocus(form, ctx.focus.path);
    const json = jsonRow({ value: route, steps: where, noun: 'route', problems: mine, focus: ctx.focus?.rec === rec && !marked ? ctx.focus : null, state: state.json }, patches => ctx.commit(patches));
    const back = h('button', { type: 'button', class: 'btn2 st-back', onClick: () => ctx.go(PART) }, '‹ Routes');
    // A copy joins the same two places, so it carries a name of its own.
    const copy = () => {
        const made = ctx.commit([{ op: 'insert', path: [...BASE, at + 1], value: { ...route, name: freeName(section, `${keyOf(route)} copy`) } }]);
        if (made?.ok) ctx.go(PART, `routes.${at + 1}`);
    };
    const drop = () => { if (ctx.commit([{ op: 'remove', path: where }])?.ok) ctx.go(PART); };
    const title = titleOf(route, name);
    return h('section', { class: 'st-rec', dataset: { rec }, tabindex: '-1', 'aria-label': title },
        h('div', { class: 'st-rh' }, back, h('span', { class: 'st-rt' }, h('b', title)), h('small', `Route ${at + 1} of ${section.value.length}`),
            h('span', { class: 'st-flags' }, route.kind ? h('span', { class: 'tg2' }, route.kind) : null,
                h('button', { type: 'button', class: 'btn2 st-dup', onClick: copy }, 'Duplicate'), h('button', { type: 'button', class: 'btn2 dng st-del', onClick: drop }, 'Delete'))),
        said, form, json);
}

/** `section`: `{ key: 'routes', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the list, or the open route's page. */
export function editSection(section, ctx) {
    const head = h('div', { class: 'secl2' }, `Routes · ${section.count}`);
    const list = Array.isArray(section.value) ? section.value.filter(route => route && typeof route === 'object' && !Array.isArray(route)) : null;
    // a section that is not a clean list of records stays readable and editable as JSON
    if (!list || list.length !== section.value.length || ctx.legacy || typeof ctx.commit !== 'function') return [renderSection(section, ctx)];
    const at = recordIndex(ctx, list.length);
    return [h('div', { class: 'st-sec', dataset: { key: 'routes' } }, at < 0 ? [head, listPage(section, ctx)] : recordPage(section, ctx, at))];
}
