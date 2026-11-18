// The cast editor (views/route.js EDITORS: cast): the list of people with a search and filters, and one person's record page (mock MK-1 "cast"):
// name, kind and role, the rest behind "more fields" (a companion has every field, a figure only the light ones plus any it already carries), where
// they start, their birthday, ties (a picker over the cast's ids, then the kind of tie), "Used by" and the JSON row. A record is opened with
// Go to (focus on "cast.<n>"), so the Studio's redraw and back button keep working. The portrait is cast-portrait.js's group; the NPC State fields
// (Level, meters, stages, secrets, Abilities, Keepsakes) and the "what NPC State seeds" panel are cast-npc.js's.

import { h } from '../../ui/kit/dom.js';
import { TIE_TAGS, WORLD_CAST_LIMITS } from '../../packs/limits.js';
import { fieldRow } from '../form/fields.js';
import { chipList } from '../form/list.js';
import { openPicker } from '../form/pick.js';
import { subRecords } from '../form/records.js';
import { renderSection } from '../views/records.js';
import { jsonRow } from '../views/json-row.js';
import { definedIds, usedBy } from '../model/refs.js';
import { renameId } from '../model/rename.js';
import { partOfPath } from '../parts.js';
import { npcGroups } from './cast-npc.js';
import { portraitGroup } from './cast-portrait.js';

const PART = 'cast';
const BASE = ['content', 'cast'];
const SHOWN = 40;
const KIND = { companion: 'Companion', figure: 'Figure' };
const FILTERS = [['all', 'All'], ['companion', 'Companions'], ['figure', 'Figures'], ['problems', 'Problems']];
// The fields behind "more fields": [key, type, label, hint]. `light` ones show for a figure too; `start` is three rows, `place` a place picker.
const MORE = [
    ['id', 'id', 'Id', 'Other records name this person by it. Renaming changes them too', true],
    ['aliases', 'chips', 'Other names', 'What the story may call them instead (at most 6)', true],
    ['look', 'long', 'Look', 'How they look at a glance', true],
    ['start', 'start', 'Start', '', true],
    ['birthday', 'text', 'Birthday', 'A month (its number or name) and a day, like "10 27" or "Icewane 27". Blank: none', true],
    ['protected', 'toggle', 'Protected', 'Generated world events never move them; only an authored event that names them may kill them', true],
    ['species', 'text', 'Species', 'Blank: human'], ['gender', 'text', 'Gender', ''], ['age', 'text', 'Age', 'A number, or words like "about 300"'],
    ['apparentAge', 'text', 'Looks', 'The age they seem, if it differs'], ['wears', 'long', 'Wears', 'Their usual clothes'],
    ['voice', 'long', 'Voice', 'How they sound'], ['personality', 'long', 'Personality', ''], ['history', 'long', 'History', 'What happened to them before the story'],
    ['mannerisms', 'chips', 'Mannerisms', 'Short habits (at most 4)'], ['drawnTo', 'chips', 'Drawn to', 'What draws them (at most 6 short phrases)'],
    ['homeBase', 'place', 'Home base', 'Where they live when the story does not move them'], ['withYou', 'long', 'With you', 'How they are with your character'],
    ['status', 'text', 'Status', 'Their state now, in a few words'], ['goal', 'text', 'Goal', 'What they want'],
    ['canDieUnmet', 'toggle', 'Can die unmet', 'The story may kill them before the party has met them'],
];
// Fields with a place on this page (the rest are only in the JSON row).
const FORMED = ['name', 'kind', 'role', 'ties', 'portrait', 'level', 'meters', 'stages', 'secrets', 'abilities', 'keepsakes', ...MORE.map(([key]) => key)];
const START = [['place', 'Starts at', 'The place they are on day one'], ['goal', 'Starting goal', 'What they are after at the start'], ['routine', 'Routine', 'What they do each day at the start']];

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const at = index => `content.cast[${index}]`;
const inRecord = (problem, index) => problem.path === at(index) || [`${at(index)}.`, `${at(index)}[`].some(start => String(problem.path).startsWith(start));
const subOf = person => [KIND[person?.kind] ?? person?.kind, person?.role].filter(Boolean).join(' · ');
const empty = value => value === '' || value === null || value === undefined || value === false || (Array.isArray(value) && !value.length);

// A free id, or a free name: ids and names (with aliases) are unique in a cast.
function free(list, base, key) {
    const taken = new Set(list.flatMap(person => (key === 'id' ? [person?.id] : [person?.name, ...(Array.isArray(person?.aliases) ? person.aliases : [])])));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(key === 'id' ? `${base}-${n}` : `${base} ${n}`)) return key === 'id' ? `${base}-${n}` : `${base} ${n}`;
}

function listPage(list, bad, ctx, redraw) {
    const state = ctx.keep?.('cast:list') ?? {};
    const filter = state.filter ?? 'all';
    const rows = h('div', { class: 'st-list' });
    const passes = (person, index, key, needle) => (key === 'all' || (key === 'problems' ? bad[index].length > 0 : person.kind === key))
        && (!needle || [person.name, person.id, person.role, ...(person.aliases ?? [])].join(' ').toLowerCase().includes(needle));
    const fill = () => {
        const needle = (state.q ?? '').trim().toLowerCase();
        const found = list.map((person, index) => ({ person, index })).filter(({ person, index }) => passes(person, index, state.filter ?? 'all', needle));
        const shown = state.all || needle ? found : found.slice(0, SHOWN);
        rows.replaceChildren(...[...shown.map(({ person, index }) => h('button', { type: 'button', class: 'sgrp st-rec st-crow', dataset: { rec: `cast.${index}` }, onClick: () => ctx.go(PART, `cast.${index}`) },
            h('div', { class: 'st-rh' },
                typeof person.portrait === 'string' ? ctx.portrait?.(person.portrait) ?? null : null,
                h('div', { class: 'st-rt' }, h('b', person.name ?? person.id ?? `#${index + 1}`), subOf(person) ? h('small', subOf(person)) : null),
                h('span', { class: 'st-flags' }, person.protected === true ? h('span', { class: 'tg2' }, 'protected') : null,
                    bad[index].length ? h('span', { class: 'st-bad' }, `✕ ${bad[index].length}`) : null)))),
        found.length === 0 ? h('p', { class: 'fine' }, list.length ? 'No one matches.' : 'No people yet.') : null,
        found.length > shown.length ? h('button', { type: 'button', class: 'btn2 st-more', onClick: () => { state.all = true; fill(); } }, `Show all ${found.length}`) : null].filter(Boolean));
    };
    const search = h('input', { class: 'txt2 st-search', placeholder: 'Search the cast…', 'aria-label': 'Search the cast' });
    search.value = state.q ?? '';
    search.addEventListener('input', () => { state.q = search.value; state.all = false; fill(); });
    const root = h('div', { class: 'st-clist' });
    const chips = h('div', { class: 'st-filters' }, ...FILTERS.map(([key, label]) => h('button', { type: 'button', class: 'tg2 st-filter', dataset: { filter: key }, 'aria-pressed': String(filter === key),
        onClick: () => { state.filter = key; state.all = false; redraw(); } },
        key === 'problems' ? `${label} · ${bad.filter(found => found.length).length}` : label)));
    const full = list.length >= WORLD_CAST_LIMITS.entries;
    const add = h('button', { type: 'button', class: 'btn2 pri st-new', disabled: full, title: full ? `A pack holds at most ${WORLD_CAST_LIMITS.entries} people.` : null, onClick: () => {
        const made = ctx.commit([{ op: 'insert', path: [...BASE, list.length], value: { kind: 'figure', id: free(list, 'new-person', 'id'), name: free(list, 'New person', 'name') } }]);
        if (made?.ok) ctx.go(PART, `cast.${list.length}`);
    } }, 'New person');
    const n = kind => list.filter(person => person.kind === kind).length;
    fill();
    root.append(h('p', { class: 'fine st-counts' }, `${plural(list.length, 'person', 'people')} · ${plural(n('companion'), 'companion', 'companions')} · ${plural(n('figure'), 'figure', 'figures')}`),
        h('div', { class: 'st-bar' }, search, chips, add), rows);
    return root;
}

// A row with a button that opens an id picker.
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

function recordPage(list, index, bad, ctx, redraw) {
    const person = list[index];
    const where = [...BASE, index];
    const rec = `cast.${index}`;
    const state = ctx.keep?.(`cast:${rec}`) ?? {};
    const focusPath = ctx.focus?.rec === rec && Array.isArray(ctx.focus.path) ? ctx.focus.path : [];
    const focusKey = focusPath[0] === 'start' ? `start.${focusPath[1]}` : focusPath[0];
    if (focusKey && MORE.some(([key]) => key === focusKey.split('.')[0])) state.more = true;
    const said = h('p', { class: 'st-problem', role: 'alert', hidden: true });
    const tell = text => { said.textContent = text ?? ''; said.hidden = !text; };
    const commit = patches => { const result = ctx.commit(patches); if (!result?.ok) tell(result?.refusal ?? 'The change was not made.'); return result; };
    const problemOf = key => bad[index].find(problem => problem.path === `${at(index)}.${key}` || String(problem.path).startsWith(`${at(index)}.${key}[`))?.message;
    // One field: an empty value takes the key out, as the checker reads a missing one; a field that is not there makes no edit.
    const put = (key, value) => {
        if (empty(value)) return Object.hasOwn(person, key) ? commit([{ op: 'remove', path: [...where, key] }]) : null;
        return commit([{ op: 'set', path: [...where, key], value }]);
    };
    // A list's item rows are keyed "<list>.<n>" (ties.2), so a path into an item marks that row.
    const focusItem = Number.isInteger(focusPath[1]) ? `${focusPath[0]}.${focusPath[1]}` : null;
    const mark = row => {
        if (focusKey && (row.dataset?.key === focusKey || (focusItem && row.dataset?.key === focusItem))) {
            const control = row.querySelector('input,textarea,select,button');
            if (control) { control.classList.add('st-at'); control.dataset.at = '0'; }
        }
        return row;
    };
    const places = definedIds(ctx.refs, 'place');
    const placePick = (key, label, hint, value, onPick) => mark(pickRow({ key, label, hint, title: `Pick ${label.toLowerCase()}`, problem: problemOf(key),
        shown: value ? places.find(item => item.id === value)?.name ?? value : '', items: [{ id: '', label: 'No place' }, ...places.map(item => ({ id: item.id, label: item.name ?? item.id, sub: item.id }))] }, onPick));

    const rename = value => {
        const id = String(value).trim();
        if (id === person.id) return;
        const plan = typeof person.id === 'string' && (ctx.refs?.defs?.cast ?? []).some(item => item.id === person.id)
            ? renameId(ctx.refs, ctx.doc, 'cast', person.id, id) : { ok: true, patches: [{ op: 'set', path: [...where, 'id'], value: id }] };
        if (!plan.ok) return tell(plan.refusal);
        if (commit(plan.patches)?.ok && plan.elsewhere?.length) (ctx.say ?? tell)(`The other open pack names this person ${plural(plan.elsewhere.length, 'time', 'times')}; change those by hand.`);
    };
    const putStart = (key, value) => {
        const start = person.start && typeof person.start === 'object' && !Array.isArray(person.start) ? person.start : null;
        if (empty(value)) {
            if (!start || !Object.hasOwn(start, key)) return null;
            return commit([Object.keys(start).length === 1 ? { op: 'remove', path: [...where, 'start'] } : { op: 'remove', path: [...where, 'start', key] }]);
        }
        return commit([start ? { op: 'set', path: [...where, 'start', key], value } : { op: 'set', path: [...where, 'start'], value: { [key]: value } }]);
    };
    const moreRow = ([key, type, label, hint]) => {
        if (type === 'id') return mark(fieldRow({ type: 'text', key, label, hint, value: person.id ?? '', problem: problemOf('id') }, (_, value) => rename(value)));
        if (type === 'chips') return mark(chipList({ key, label, hint, values: Array.isArray(person[key]) ? person[key] : [], placeholder: `Add ${label === 'Other names' ? 'a name' : 'one'}…` }, put));
        if (type === 'place') return placePick(key, label, hint, person[key], id => put(key, id));
        if (type === 'toggle') return mark(fieldRow({ type, key, label, hint, value: person[key] === true, problem: problemOf(key) }, put));
        if (type === 'start') {
            const start = person.start && typeof person.start === 'object' ? person.start : {};
            return START.map(([part, name, help]) => (part === 'place'
                ? placePick('start.place', name, help, start.place, id => putStart('place', id))
                : mark(fieldRow({ type: 'text', key: `start.${part}`, label: name, hint: help, value: start[part] ?? '', problem: problemOf(`start.${part}`) }, (_, value) => putStart(part, String(value).trim())))));
        }
        const write = key === 'age' ? value => put(key, /^\d{1,5}$/.test(String(value).trim()) ? Number(value) : String(value).trim()) : value => put(key, type === 'long' ? value : String(value).trim());
        return mark(fieldRow({ type, key, label, hint, value: person[key] ?? '', rows: 3, problem: problemOf(key) }, (_, value) => write(value)));
    };
    const figure = person.kind === 'figure';
    const offered = MORE.filter(([key, , , , light]) => !figure || light || state.every || person[key] !== undefined);
    const hiddenCount = MORE.length - offered.length;
    const moreBar = h('div', { class: 'srow st-morebar' },
        h('span', { class: 'lb' }, h('small', state.more ? (figure && hiddenCount ? `A figure needs only a name; ${plural(hiddenCount, 'companion field is', 'companion fields are')} not shown.` : '')
            : `${plural(offered.length, 'more field', 'more fields')}: ${offered.slice(0, 5).map(([, , label]) => label.toLowerCase()).join(', ')}…`)),
        h('span', { class: 'ctl' }, state.more && figure && hiddenCount ? h('button', { type: 'button', class: 'btn2 st-every', onClick: () => { state.every = true; redraw(); } }, 'Show every field') : null,
            h('button', { type: 'button', class: 'btn2 st-moreshow', 'aria-expanded': String(Boolean(state.more)), onClick: () => { state.more = !state.more; redraw(); } }, state.more ? 'Hide' : 'Show')));
    const person1 = h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Person'),
        mark(fieldRow({ type: 'text', key: 'name', label: 'Name', value: person.name ?? '', problem: problemOf('name') }, (_, value) => put('name', String(value).trim()))),
        mark(fieldRow({ type: 'segmented', key: 'kind', label: 'Kind', hint: 'A companion has every field; a figure only the light ones', value: KIND[person.kind] ?? person.kind, options: Object.values(KIND), problem: problemOf('kind') },
            (_, label) => put('kind', Object.keys(KIND).find(key => KIND[key] === label)))),
        mark(fieldRow({ type: 'text', key: 'role', label: 'Role', hint: 'Who they are in a few words, like "the ferryman"', value: person.role ?? '', problem: problemOf('role') }, (_, value) => put('role', String(value).trim()))),
        ...(state.more ? offered.flatMap(moreRow) : []), moreBar);

    const page = h('section', { class: 'st-rec', dataset: { rec }, tabindex: '-1', 'aria-label': String(person.name ?? person.id ?? `Person ${index + 1}`) });
    const names = new Map(list.map(other => [other?.id, other?.name ?? other?.id]));
    const kit = { ctx, where, at: at(index), problems: bad[index], state, focusPath, commit, put, redraw };
    const groups = [person1, portraitGroup(person, where, list, { ctx, tell, say: ctx.say }), tiesGroup(person, where, list, names, bad[index].filter(problem => String(problem.path).startsWith(`${at(index)}.ties`)), commit, mark),
        ...npcGroups(person, list, kit), usedGroup(person, names, ctx)];
    const extra = Object.keys(person).filter(key => !FORMED.includes(key));
    const copy = () => {
        const value = { ...structuredClone(person), id: free(list, `${person.id ?? 'person'}-copy`, 'id'), name: free(list, `${person.name ?? person.id ?? 'Person'} (copy)`, 'name') };
        delete value.aliases; // a name or alias names one person
        if (commit([{ op: 'insert', path: [...BASE, index + 1], value }])?.ok) ctx.go(PART, `cast.${index + 1}`);
    };
    const drop = state.confirm
        ? [h('button', { type: 'button', class: 'btn2 dng st-sure', onClick: () => { state.confirm = false; if (commit([{ op: 'remove', path: where }])?.ok) ctx.go(PART); } }, 'Delete this person'),
            h('button', { type: 'button', class: 'btn2 st-keep', onClick: () => { state.confirm = false; redraw(); } }, 'Keep them')]
        : [h('button', { type: 'button', class: 'btn2 dng st-del', onClick: () => { state.confirm = true; redraw(); } }, 'Delete')];
    page.append(
        h('div', { class: 'st-bar' }, h('button', { type: 'button', class: 'btn2 st-back', onClick: () => ctx.go(PART) }, '‹ Cast'),
            h('span', { class: 'st-acts' }, h('button', { type: 'button', class: 'btn2 st-dup', onClick: copy }, 'Duplicate'), ...drop)),
        h('div', { class: 'st-rt st-entryhead' }, h('b', String(person.name ?? person.id ?? '')), h('small', subOf(person) || `Person ${index + 1}`),
            person.protected === true ? h('span', { class: 'tg2' }, 'protected') : null, h('small', { class: 'fine' }, `Person ${index + 1} of ${list.length}`)),
        said, ...groups,
        extra.length ? h('p', { class: 'fine st-extra' }, `Also in this person, only in the JSON below: ${extra.join(', ')}.`) : null,
        jsonRow({ value: person, steps: where, noun: 'person', problems: bad[index], focus: focusKey && !FORMED.includes(focusKey.split('.')[0]) ? ctx.focus : null, state: ctx.keep?.(`json:${rec}`) ?? {} }, patches => ctx.commit(patches)));
    return page;
}

// Ties: each a person from the cast and a kind of tie. Add picks the person, then the kind; the kind button on a row changes it.
function tiesGroup(person, where, list, names, problems, commit, mark) {
    const ties = Array.isArray(person.ties) ? person.ties : [];
    const tagItems = TIE_TAGS.map(tag => ({ id: tag, label: tag }));
    const add = () => openPicker({}, { title: 'Tie to whom?', items: list.filter(other => other?.id && other.id !== person.id).map(other => ({ id: other.id, label: other.name ?? other.id, sub: other.id,
        tag: ties.filter(tie => tie?.with === other.id).map(tie => tie.tag).join(', ') || null })) }, id => openPicker({}, { title: `What is ${names.get(id) ?? id} to them?`, items: tagItems }, tag => {
        const tie = { with: id, tag };
        commit([ties.length || Array.isArray(person.ties) ? { op: 'insert', path: [...where, 'ties', ties.length], value: tie } : { op: 'set', path: [...where, 'ties'], value: [tie] }]);
    }));
    const group = subRecords({ title: 'Ties', addLabel: '+ Add a tie', items: ties.map(tie => ({ title: names.get(tie?.with) ?? String(tie?.with ?? '?'), sub: `${tie?.tag ?? '?'} · ${tie?.with ?? '?'}` })) }, {
        add,
        move: (from, step) => commit([{ op: 'move', path: [...where, 'ties', from], to: from + step }]),
        remove: from => commit([ties.length === 1 ? { op: 'remove', path: [...where, 'ties'] } : { op: 'remove', path: [...where, 'ties', from] }]),
    });
    group.dataset.key = 'ties';
    group.classList.add('st-ties');
    group.querySelectorAll('.subrow').forEach(row => {
        const n = Number(row.dataset.index);
        row.dataset.key = `ties.${n}`;
        row.querySelector('.ctl').prepend(h('button', { type: 'button', class: 'btn2 st-tietag', 'aria-label': `Kind of tie with ${names.get(ties[n]?.with) ?? ties[n]?.with}`,
            onClick: () => openPicker({}, { title: 'Kind of tie', items: tagItems }, tag => commit([{ op: 'set', path: [...where, 'ties', n, 'tag'], value: tag }])) }, ties[n]?.tag ?? '?'));
        mark(row);
    });
    for (const problem of problems) group.append(h('small', { class: 'st-problem', role: 'alert' }, problem.message));
    return group;
}

function usedGroup(person, names, ctx) {
    const uses = typeof person.id === 'string' ? usedBy(ctx.refs, 'cast', person.id) : [];
    const rows = uses.map(use => {
        const part = partOfPath(`content.${use.owner.part}${typeof use.owner.index === 'number' ? `[${use.owner.index}]` : ''}`, ctx.kind);
        const title = use.owner.part === 'cast' ? names.get(use.owner.id) ?? use.owner.id : use.owner.id ?? use.rec;
        return h('div', { class: 'srow' },
            h('span', { class: 'lb' }, h('b', String(title ?? '')), h('small', `${use.owner.part} · ${use.role ?? 'text'}${use.pack === 'other' ? ' · the other pack' : ''}`)),
            use.pack === 'other' ? null : h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-open', 'aria-label': `Open ${title}`, onClick: () => ctx.go(part.part, part.rec ?? use.rec) }, 'Open ›')));
    });
    return h('section', { class: 'sgrp st-usedby' }, h('div', { class: 'gt' }, `Used by · ${uses.length}`),
        ...(rows.length ? rows : [h('p', { class: 'fine' }, typeof person.id === 'string' ? `No other record names this person (as ${person.id}).` : 'Give this person an id for other records to name them.')]));
}

/** `section`: `{ key: 'cast', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the list, or the open person's page. */
export function editSection(section, ctx) {
    const list = Array.isArray(section.value) ? section.value : null;
    // a cast that is not a clean list of records (or a format 3 pack) stays readable and editable as JSON
    if (!list || list.some(person => !person || typeof person !== 'object' || Array.isArray(person)) || ctx.legacy || typeof ctx.commit !== 'function') return [renderSection(section, ctx)];
    const bad = list.map((_, index) => (ctx.problems ?? []).filter(problem => inRecord(problem, index)));
    const focused = /^cast\.(\d+)$/.exec(ctx.focus?.rec ?? '');
    const open = focused && Number(focused[1]) < list.length ? Number(focused[1]) : -1;
    const root = h('div', { class: 'st-sec st-cast', dataset: { key: 'cast' } });
    const draw = () => root.replaceChildren(open < 0 ? listPage(list, bad, ctx, draw) : recordPage(list, open, bad, ctx, draw));
    draw();
    return [root];
}
