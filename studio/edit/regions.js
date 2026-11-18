// The regions and realms editor: a list of each (the two sections of the Places & routes part), and one record page per region (name, id,
// climate, other names, its realm, the places in it, where it is used) and per realm (name, id, its regions through the region picker).
// A record is opened with Go to (focus on "regions.<n>" or "realms.<n>"); renaming an id goes through the reference index (model/rename.js).

import { h } from '../../ui/kit/dom.js';
import { foldKey } from '../../core/text.js';
import { CLIMATES } from '../../packs/limits.js';
import { fieldRow } from '../form/fields.js';
import { chipList } from '../form/list.js';
import { subRecords } from '../form/records.js';
import { openPicker } from '../form/pick.js';
import { renderSection } from '../views/records.js';
import { jsonRow } from '../views/json-row.js';
import { definedIds, usedBy } from '../model/refs.js';
import { renameId } from '../model/rename.js';

const PART = 'map';
const AUTO = '(temperate, the default)';
const NOUN = { regions: { one: 'region', title: 'Region', kind: 'region', base: 'new-region', made: 'New region' }, realms: { one: 'realm', title: 'Realm', kind: 'realm', base: 'new-realm', made: 'New realm' } };
const OTHER = { regions: 'realms', realms: 'regions' };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const isObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const contentOf = ctx => ctx.doc?.doc?.content ?? ctx.doc?.content ?? {};
const listOf = (content, key) => (Array.isArray(content[key]) ? content[key] : []);
const titleOf = (record, at) => String(record?.name ?? record?.id ?? `#${at + 1}`);
// A realm lists a region by its id or by a name the region answers to (the checker takes both).
const names = region => [region?.name, ...(Array.isArray(region?.aliases) ? region.aliases : [])].filter(text => typeof text === 'string').map(foldKey);
const holds = (entry, region) => typeof entry === 'string' && (entry === region?.id || names(region).includes(foldKey(entry)));
const realmOf = (content, region) => listOf(content, 'realms').findIndex(realm => isObj(realm) && Array.isArray(realm.regions) && realm.regions.some(entry => holds(entry, region)));

function recordIndex(ctx, key, count) {
    const match = /^([A-Za-z]+)\.(\d+)$/.exec(ctx.focus?.rec ?? '');
    if (!match) return { at: -1, elsewhere: false };
    return match[1] === key && Number(match[2]) < count ? { at: Number(match[2]), elsewhere: false } : { at: -1, elsewhere: match[1] !== key };
}

// A free id for a new or copied region or realm: ids are unique across places, regions and realms.
function freeId(ctx, base) {
    const content = contentOf(ctx);
    const taken = new Set([...definedIds(ctx.refs, 'place'), ...definedIds(ctx.refs, 'region'), ...definedIds(ctx.refs, 'realm')].map(item => item.id));
    for (const key of ['places', 'regions', 'realms']) for (const record of listOf(content, key)) if (record?.id) taken.add(record.id);
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    return id;
}

// Adds a record to `key` (making the list when the pack has none yet) and opens it.
function addTo(ctx, key) {
    const list = listOf(contentOf(ctx), key);
    const noun = NOUN[key];
    const value = { id: freeId(ctx, noun.base), name: noun.made, ...(key === 'realms' ? { regions: [] } : {}) };
    const patch = Object.hasOwn(contentOf(ctx), key) ? { op: 'insert', path: ['content', key, list.length], value } : { op: 'set', path: ['content', key], value: [value] };
    if (ctx.commit([patch])?.ok) ctx.go(PART, `${key}.${list.length}`);
}

function regionSub(content, region) {
    const realm = listOf(content, 'realms')[realmOf(content, region)];
    const places = listOf(content, 'places').filter(place => place?.region === region.id).length;
    return [region.climate, realm ? `in ${realm.name ?? realm.id}` : null, plural(places, 'place')].filter(Boolean).join(' · ');
}

function listPage(section, ctx) {
    const content = contentOf(ctx);
    const key = section.key;
    const sub = key === 'regions' ? region => regionSub(content, region) : realm => plural(Array.isArray(realm.regions) ? realm.regions.length : 0, 'region');
    const rows = section.value.map((record, at) => h('button', { type: 'button', class: 'st-prow', dataset: { rec: `${key}.${at}` }, onClick: () => ctx.go(PART, `${key}.${at}`) },
        h('span', null, h('b', titleOf(record, at)), h('small', sub(record))), h('span', { 'aria-hidden': 'true' }, '›')));
    const other = OTHER[key];
    const adds = [h('button', { type: 'button', class: 'btn2 st-add', onClick: () => addTo(ctx, key) }, `+ Add a ${NOUN[key].one}`)];
    // the part shows only the keys the pack holds, so the first record of the other list is added from here
    if (!Object.hasOwn(content, other)) adds.push(h('button', { type: 'button', class: 'btn2 st-add-other', onClick: () => addTo(ctx, other) }, `+ Add a ${NOUN[other].one}`));
    const empty = section.value.length ? null : h('p', { class: 'fine' }, `No ${key} yet.`);
    return h('section', { class: 'sgrp st-plist-wrap' }, h('div', { class: 'slist st-plist' }, rows), empty, h('div', { class: 'addrow' }, adds));
}

// A button row that opens the id picker.
function pickRow(spec, onPick) {
    const row = h('div', { class: 'srow', dataset: { key: spec.key, type: 'pick' } },
        h('span', { class: 'lb' }, h('b', spec.label), spec.hint ? h('small', spec.hint) : null),
        h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-pickbtn', onClick: () => openPicker({}, { title: spec.title, items: spec.items }, onPick) }, spec.shown)));
    if (spec.problem) {
        row.classList.add('bad');
        row.append(h('small', { class: 'st-problem', role: 'alert' }, spec.problem));
    }
    return row;
}

const line = text => h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('small', text)));

// What the record pages share: problems, put (one field, an empty value removes the key), rename, the header with Duplicate and Delete, and the JSON row.
function recordKit(section, ctx, at) {
    const key = section.key;
    const noun = NOUN[key];
    const record = section.value[at];
    const where = ['content', key, at];
    const rec = `${key}.${at}`;
    const mine = (ctx.problems ?? []).filter(problem => String(problem.path).startsWith(`content.${key}[${at}]`));
    const problemOf = field => mine.find(problem => problem.path === `content.${key}[${at}].${field}`)?.message;
    const said = h('p', { class: 'st-problem', role: 'alert', hidden: true });
    const tell = text => { said.textContent = text ?? ''; said.hidden = !text; };
    const commit = patches => { const result = ctx.commit(patches); if (!result?.ok) tell(result?.refusal ?? 'The change was not made.'); return result; };
    const put = (field, value) => {
        const gone = value === '' || value === null || value === false || (Array.isArray(value) && !value.length);
        if (gone && !Object.hasOwn(record, field)) return;
        commit([gone ? { op: 'remove', path: [...where, field] } : { op: 'set', path: [...where, field], value }]);
    };
    const rename = (_, to) => {
        const id = String(to).trim();
        if (id === record.id) return;
        if (!id) return tell(`A ${noun.one} needs an id.`);
        const done = record.id === undefined ? { ok: true, patches: [{ op: 'set', path: [...where, 'id'], value: id }] } : renameId(ctx.refs, ctx.doc, noun.kind, record.id, id);
        if (!done.ok) return tell(done.refusal);
        if (commit(done.patches)?.ok && done.elsewhere?.length) tell(`The other open pack names this ${noun.one} ${plural(done.elsewhere.length, 'time')}; change those by hand.`);
    };
    const row = (spec, change) => fieldRow({ ...spec, problem: problemOf(spec.key) }, change);
    const copy = () => {
        const value = { ...structuredClone(record), id: freeId(ctx, `${record.id ?? noun.one}-copy`), name: `${record.name ?? noun.one} copy` };
        if (key === 'realms') value.regions = [];
        if (ctx.commit([{ op: 'insert', path: ['content', key, at + 1], value }])?.ok) ctx.go(PART, `${key}.${at + 1}`);
    };
    const drop = () => { if (ctx.commit([{ op: 'remove', path: where }])?.ok) ctx.go(PART); };
    const page = (...groups) => {
        const state = ctx.keep?.(`${key}:${rec}`) ?? {};
        state.json ??= {};
        const json = jsonRow({ value: record, steps: where, noun: noun.one, problems: mine, focus: ctx.focus?.rec === rec ? ctx.focus : null, state: state.json }, patches => ctx.commit(patches));
        return h('section', { class: 'st-rec', dataset: { rec }, tabindex: '-1', 'aria-label': titleOf(record, at) },
            h('div', { class: 'st-rh' }, h('button', { type: 'button', class: 'btn2 st-back', onClick: () => ctx.go(PART) }, '‹ Places & routes'),
                h('span', { class: 'st-rt' }, h('b', titleOf(record, at))), h('small', `${noun.title} ${at + 1} of ${section.value.length}`),
                h('span', { class: 'st-flags' }, h('button', { type: 'button', class: 'btn2 st-dup', onClick: copy }, 'Duplicate'), h('button', { type: 'button', class: 'btn2 dng st-del', onClick: drop }, 'Delete'))),
            said, h('div', { class: 'st-edit', dataset: { rec: key } }, ...groups), json);
    };
    const usedLine = () => {
        const users = usedBy(ctx.refs, noun.kind, record.id);
        return h('section', { class: 'sgrp st-usedby' }, h('div', { class: 'gt' }, 'Used by'),
            line(users.length ? `${plural(users.length, 'record')} in the pack name it, such as ${users.slice(0, 3).map(use => use.path.join('.')).join(', ')}.` : `No other record names this ${noun.one} (as ${record.id ?? 'its id'}).`));
    };
    return { record, where, put, rename, row, commit, problemOf, page, usedLine };
}

function regionPage(section, ctx, at) {
    const kit = recordKit(section, ctx, at);
    const { record: region, row, put } = kit;
    const content = contentOf(ctx);
    const realms = listOf(content, 'realms');
    const home = realmOf(content, region);
    // moving a region takes it out of the realm that lists it and adds its id to the one picked (a region belongs to one realm)
    const moveTo = id => {
        const to = realms.findIndex(realm => realm?.id === id);
        if (to === home) return;
        const patches = [];
        if (home >= 0) patches.push({ op: 'set', path: ['content', 'realms', home, 'regions'], value: realms[home].regions.filter(entry => !holds(entry, region)) });
        if (to >= 0) patches.push({ op: 'set', path: ['content', 'realms', to, 'regions'], value: [...(Array.isArray(realms[to].regions) ? realms[to].regions : []), region.id] });
        if (patches.length) kit.commit(patches);
    };
    const places = listOf(content, 'places').map((place, n) => ({ place, n })).filter(({ place }) => place?.region === region.id);
    return kit.page(
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Region'),
            row({ type: 'text', key: 'name', label: 'Name', hint: 'Shown in lists and on the map', value: region.name }, put),
            row({ type: 'text', key: 'id', label: 'Id', hint: 'Places and realms name it by this. Renaming changes them too', value: region.id }, kit.rename),
            row({ type: 'select', key: 'climate', label: 'Climate', hint: 'The weather follows it; a place may set its own', value: region.climate ?? AUTO, options: [AUTO, ...CLIMATES] }, (field, value) => put(field, value === AUTO ? '' : value)),
            chipList({ key: 'aliases', label: 'Other names', hint: 'What the story may call it instead (at most 6)', values: region.aliases, placeholder: 'Add a name…' }, put)),
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'In the world'),
            pickRow({ key: 'realm', label: 'Realm', hint: 'The realm that holds it', shown: home >= 0 ? titleOf(realms[home], home) : 'None', title: 'Pick a realm',
                items: [{ id: '', label: 'No realm' }, ...realms.filter(realm => realm?.id).map(realm => ({ id: realm.id, label: titleOf(realm), sub: realm.id }))] }, moveTo),
            h('div', { class: 'srow wide st-inside', dataset: { key: 'places' } }, h('span', { class: 'lb' }, h('b', 'Places'), h('small', places.length ? `${plural(places.length, 'place')} in this region.` : 'No place is in this region yet.')),
                h('span', { class: 'ctl' }, places.slice(0, 12).map(({ place, n }) => h('button', { type: 'button', class: 'btn2 st-goplace', onClick: () => ctx.go(PART, `places.${n}`) }, titleOf(place, n)))))),
        kit.usedLine());
}

function realmPage(section, ctx, at) {
    const kit = recordKit(section, ctx, at);
    const { record: realm, row, put } = kit;
    const content = contentOf(ctx);
    const regions = listOf(content, 'regions');
    const listed = Array.isArray(realm.regions) ? realm.regions : [];
    const setList = value => kit.commit([{ op: 'set', path: [...kit.where, 'regions'], value }]);
    const owner = region => listOf(content, 'realms').findIndex((other, n) => n !== at && isObj(other) && Array.isArray(other.regions) && other.regions.some(entry => holds(entry, region)));
    const pick = () => openPicker({}, { title: 'Pick a region', items: regions.filter(region => region?.id).map(region => {
        const there = owner(region);
        const tag = listed.some(entry => holds(entry, region)) ? 'in this realm' : there >= 0 ? `in ${titleOf(listOf(content, 'realms')[there], there)}` : null;
        return { id: region.id, label: titleOf(region), sub: [region.id, region.climate].filter(Boolean).join(' · '), tag, disabled: Boolean(tag) };
    }) }, id => setList([...listed, id]));
    const items = listed.map(entry => {
        const region = regions.find(each => holds(entry, each));
        return { title: region ? titleOf(region) : String(entry), sub: region ? region.id : 'not a region in this pack' };
    });
    const group = subRecords({ title: 'Regions', items, addLabel: '+ Add a region' }, {
        add: pick,
        move: (n, step) => { const next = [...listed]; [next[n], next[n + step]] = [next[n + step], next[n]]; setList(next); },
        remove: n => setList(listed.filter((_, i) => i !== n)),
    });
    group.dataset.key = 'regions';
    const problem = kit.problemOf('regions');
    if (problem) group.append(h('small', { class: 'st-problem', role: 'alert' }, problem));
    return kit.page(
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Realm'),
            row({ type: 'text', key: 'name', label: 'Name', hint: 'A kingdom, a league, a domain: who rules these regions', value: realm.name }, put),
            row({ type: 'text', key: 'id', label: 'Id', hint: 'Events name it by this. Renaming changes them too', value: realm.id }, kit.rename)),
        group, kit.usedLine());
}

/** `section`: `{ key: 'regions' | 'realms', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the list, the open record's page,
 * or nothing while another record of the part is open. */
export function editSection(section, ctx) {
    const key = section.key;
    const clean = Array.isArray(section.value) && section.value.every(isObj);
    // a section that is not a clean list of records stays readable and editable as JSON
    if (!NOUN[key] || !clean || ctx.legacy || typeof ctx.commit !== 'function') return [renderSection(section, ctx)];
    const { at, elsewhere } = recordIndex(ctx, key, section.value.length);
    if (elsewhere) return [];
    const head = h('div', { class: 'secl2' }, `${key === 'regions' ? 'Regions' : 'Realms'} · ${section.count}`);
    const body = at < 0 ? [head, listPage(section, ctx)] : (key === 'regions' ? regionPage : realmPage)(section, ctx, at);
    return [h('div', { class: 'st-sec', dataset: { key } }, body)];
}
