// The places editor: a searchable list of places and, for one place, its record page (mock MK-1): name, id, kind, region, layer, climate,
// map position, other names, tags, note, hidden, where it is used, and its JSON row. A record is opened with Go to (focus on "places.<n>"),
// so the Studio's own redraw and back button keep working.

import { h } from '../../ui/kit/dom.js';
import { CLIMATES } from '../../packs/limits.js';
import { fieldRow } from '../form/fields.js';
import { chipList } from '../form/list.js';
import { openPicker } from '../form/pick.js';
import { renderSection } from '../views/records.js';
import { jsonRow } from '../views/json-row.js';
import { definedIds, usedBy } from '../model/refs.js';
import { renameId } from '../model/rename.js';

const PART = 'map';
const AUTO = '(from its region)';
const SHOWN = 60;
const BASE = ['content', 'places'];
const sub = place => [place.kind, place.region].filter(Boolean).join(' · ');
const classOf = (content, kind) => (content?.placeKinds && typeof content.placeKinds[kind] === 'string' ? content.placeKinds[kind] : null);

function recordIndex(ctx, count) {
    const match = /^places\.(\d+)$/.exec(ctx.focus?.rec ?? '');
    return match && Number(match[1]) < count ? Number(match[1]) : -1;
}

// A free id for a new or copied place.
function freeId(section, ctx, base) {
    const taken = new Set([...definedIds(ctx.refs, 'place'), ...definedIds(ctx.refs, 'region'), ...definedIds(ctx.refs, 'realm')].map(item => item.id));
    for (const place of section.value) if (place?.id) taken.add(place.id);
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    return id;
}

function listPage(section, ctx) {
    const rows = h('div', { class: 'slist st-plist' });
    const count = h('p', { class: 'fine' });
    const kept = ctx.keep?.('places:list') ?? {};
    const draw = () => {
        const needle = (kept.q ?? '').trim().toLowerCase();
        const hits = section.value.map((place, at) => ({ place, at })).filter(({ place }) => !needle || `${place?.name ?? ''} ${place?.id ?? ''} ${sub(place ?? {})}`.toLowerCase().includes(needle));
        const shown = kept.all || needle ? hits : hits.slice(0, SHOWN);
        rows.replaceChildren(...shown.map(({ place, at }) => h('button', { type: 'button', class: 'st-prow', dataset: { rec: `places.${at}` }, onClick: () => ctx.go(PART, `places.${at}`) },
            h('span', null, h('b', place?.name ?? place?.id ?? `#${at + 1}`), sub(place ?? {}) ? h('small', sub(place)) : null), h('span', { 'aria-hidden': 'true' }, '›'))));
        if (hits.length > shown.length) rows.append(h('button', { type: 'button', class: 'btn2 st-more', onClick: () => { kept.all = true; draw(); } }, `Show all ${hits.length}`));
        count.textContent = `${hits.length} of ${section.value.length}`;
    };
    const find = h('input', { class: 'psrch txt2', placeholder: 'Find a place…', 'aria-label': 'Find a place' });
    find.value = kept.q ?? '';
    find.addEventListener('input', () => { kept.q = find.value; draw(); });
    draw();
    const add = () => {
        const id = freeId(section, ctx, 'new-place');
        const made = ctx.commit([{ op: 'insert', path: [...BASE, section.value.length], value: { id, name: 'New place', x: 0, y: 0 } }]);
        if (made?.ok) ctx.go(PART, `places.${section.value.length}`);
    };
    return h('section', { class: 'sgrp st-plist-wrap' }, find, rows, count, h('div', { class: 'addrow' }, h('button', { type: 'button', class: 'btn2 st-add', onClick: add }, '+ Add a place')));
}

// A button row that opens the id picker.
function pickRow(spec, ctx, onPick) {
    const shown = spec.value ? spec.shownAs ?? spec.value : 'None';
    const row = h('div', { class: 'srow', dataset: { key: spec.key, type: 'pick' } },
        h('span', { class: 'lb' }, h('b', spec.label), spec.hint ? h('small', spec.hint) : null),
        h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-pickbtn', onClick: () => openPicker({}, { title: spec.title, items: spec.items }, onPick) }, shown)));
    if (spec.problem) {
        row.classList.add('bad');
        row.append(h('small', { class: 'st-problem', role: 'alert' }, spec.problem));
    }
    return row;
}

function recordPage(section, ctx, at) {
    const place = section.value[at];
    const content = ctx.doc?.doc?.content ?? ctx.doc?.content ?? {};
    const where = [...BASE, at];
    const rec = `places.${at}`;
    const mine = (ctx.problems ?? []).filter(problem => String(problem.path).startsWith(`content.places[${at}]`));
    const problemOf = field => mine.find(problem => problem.path === `content.places[${at}].${field}`)?.message;
    const state = ctx.keep?.(`places:${rec}`) ?? {};
    const said = h('p', { class: 'st-problem', role: 'alert', hidden: true });
    const tell = text => { said.textContent = text ?? ''; said.hidden = !text; };
    // One field: an empty value takes the key out of the record, as the checker reads a missing one.
    const put = (field, value) => {
        const gone = value === '' || value === null || value === false || (Array.isArray(value) && !value.length);
        if (gone && !Object.hasOwn(place, field)) return;
        const result = ctx.commit([gone ? { op: 'remove', path: [...where, field] } : { op: 'set', path: [...where, field], value }]);
        if (!result?.ok) tell(result?.refusal ?? 'The change was not made.');
    };
    const rename = (key, to) => {
        const id = String(to).trim();
        if (id === place.id) return;
        if (!id) return tell('A place needs an id.');
        const done = place.id === undefined ? { ok: true, patches: [{ op: 'set', path: [...where, 'id'], value: id }] } : renameId(ctx.refs, ctx.doc, 'place', place.id, id);
        if (!done.ok) return tell(done.refusal);
        const result = ctx.commit(done.patches);
        if (!result?.ok) tell(result?.refusal ?? 'The change was not made.');
        else if (done.elsewhere?.length) tell(`The other open pack names this place ${done.elsewhere.length} time${done.elsewhere.length === 1 ? '' : 's'}; change those by hand.`);
    };
    const regions = definedIds(ctx.refs, 'region');
    const kinds = Object.keys(content.placeKinds ?? {});
    const row = (spec, change) => fieldRow({ ...spec, problem: problemOf(spec.key) }, change);
    const num = (key, label, hint) => row({ type: 'number', key, label, hint, value: place[key] }, (field, value) => { if (typeof value === 'number') put(field, value); });
    const kindClass = classOf(content, place.kind);
    const users = usedBy(ctx.refs, 'place', place.id);

    const form = h('div', { class: 'st-edit', dataset: { rec: 'places' } },
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Place'),
            row({ type: 'text', key: 'name', label: 'Name', hint: 'Shown in lists and on the map', value: place.name }, put),
            row({ type: 'text', key: 'id', label: 'Id', hint: 'Other records name it by this. Renaming changes them too', value: place.id }, rename),
            pickRow({ key: 'kind', label: 'Kind', hint: kindClass ? `Counts as: ${kindClass}` : 'What sort of place it is', value: place.kind, title: 'Pick a kind', problem: problemOf('kind'),
                items: [{ id: '', label: 'No kind' }, ...kinds.map(kind => ({ id: kind, label: kind, sub: classOf(content, kind) ?? '' }))] }, ctx, id => put('kind', id)),
            pickRow({ key: 'region', label: 'Region', hint: 'The part of the world it is in', value: place.region, shownAs: regions.find(item => item.id === place.region)?.name, title: 'Pick a region', problem: problemOf('region'),
                items: [{ id: '', label: 'No region' }, ...regions.map(item => ({ id: item.id, label: item.name, sub: item.id }))] }, ctx, id => put('region', id)),
            row({ type: 'text', key: 'layer', label: 'Layer', hint: 'A map layer name, like "underground". Blank: the main map', value: place.layer }, put),
            row({ type: 'select', key: 'climate', label: 'Climate', hint: 'Blank: the region\'s climate', value: place.climate ?? AUTO, options: [AUTO, ...CLIMATES] }, (field, value) => put(field, value === AUTO ? '' : value))),
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'On the map'),
            num('x', 'X', 'How far east, in map units'), num('y', 'Y', 'How far north, in map units')),
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Details'),
            chipList({ key: 'aliases', label: 'Other names', hint: 'What the story may call it instead', values: place.aliases, placeholder: 'Add a name…' }, put),
            chipList({ key: 'tags', label: 'Tags', hint: 'Lowercase words, like river or port', values: place.tags, placeholder: 'Add a tag…' }, put),
            row({ type: 'long', key: 'note', label: 'Note', hint: 'What the story should know about it', value: place.note, rows: 3 }, put),
            row({ type: 'toggle', key: 'hidden', label: 'Hidden', hint: 'Kept off the map until the story finds it', value: place.hidden === true }, put)),
        h('section', { class: 'sgrp st-usedby' }, h('div', { class: 'gt' }, 'Used by'),
            h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('small', users.length ? `${users.length} place${users.length === 1 ? '' : 's'} in the pack name it, such as ${users.slice(0, 3).map(use => use.path.join('.')).join(', ')}.` : `No other record names this place (as ${place.id ?? 'its id'}).`)))));
    if (state.json === undefined) state.json = {};
    const json = jsonRow({ value: place, steps: where, noun: 'place', problems: mine, focus: ctx.focus?.rec === rec ? ctx.focus : null, state: state.json }, patches => ctx.commit(patches));
    const back = h('button', { type: 'button', class: 'btn2 st-back', onClick: () => ctx.go(PART) }, '‹ Places');
    const copy = () => {
        const id = freeId(section, ctx, `${place.id ?? 'place'}-copy`);
        const made = ctx.commit([{ op: 'insert', path: [...BASE, at + 1], value: { ...place, id, name: `${place.name ?? id} copy` } }]);
        if (made?.ok) ctx.go(PART, `places.${at + 1}`);
    };
    const drop = () => { if (ctx.commit([{ op: 'remove', path: where }])?.ok) ctx.go(PART); };
    return h('section', { class: 'st-rec', dataset: { rec }, tabindex: '-1', 'aria-label': String(place.name ?? place.id ?? `Place ${at + 1}`) },
        h('div', { class: 'st-rh' }, back, h('span', { class: 'st-rt' }, h('b', String(place.name ?? place.id ?? ''))), h('small', `Place ${at + 1} of ${section.value.length}`),
            h('span', { class: 'st-flags' }, place.hidden ? h('span', { class: 'tg2' }, 'hidden') : null,
                h('button', { type: 'button', class: 'btn2 st-dup', onClick: copy }, 'Duplicate'), h('button', { type: 'button', class: 'btn2 dng st-del', onClick: drop }, 'Delete'))),
        said, form, json);
}

/** `section`: `{ key: 'places', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the list, or the open place's page. */
export function editSection(section, ctx) {
    const head = h('div', { class: 'secl2' }, `Places · ${section.count}`);
    const list = Array.isArray(section.value) ? section.value.filter(place => place && typeof place === 'object') : null;
    // a section that is not a clean list of records stays readable and editable as JSON
    if (!list || list.length !== section.value.length || ctx.legacy || typeof ctx.commit !== 'function') return [renderSection(section, ctx)];
    const at = recordIndex(ctx, list.length);
    return [h('div', { class: 'st-sec', dataset: { key: 'places' } }, at < 0 ? [head, listPage(section, ctx)] : recordPage(section, ctx, at))];
}
