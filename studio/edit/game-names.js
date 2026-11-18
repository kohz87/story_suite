// The game pack's Names part (views/route.js EDITORS: names), mock MK-7: the name cultures as a table (the order is the priority: when two
// cultures share a region the higher one wins) with the banned list under it, and one culture's record page (id, regions picked from the
// open world or typed when none is open, given and family names, the JSON row). `content.names` is one object whose key order is the culture
// order, so a move, a rename or a duplicate writes the whole object again in its new order; any other edit is a patch at its own path.

import { h } from '../../ui/kit/dom.js';
import { NAMES_LIMITS as LIMIT, SLUG } from '../../packs/limits.js';
import { foldKey, oneLine } from '../../core/text.js';
import { setProblem, fieldRow } from '../form/fields.js';
import { openPicker } from '../form/pick.js';
import { rowTable } from '../form/table.js';
import { deleteCard } from '../form/confirm.js';
import { jsonRow } from '../views/json-row.js';
import { renderSection } from '../views/records.js';

const PART = 'names';
const BASE = ['content', 'names'];
const SHOWN = 18;
const isObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const listOf = value => (Array.isArray(value) ? value.filter(item => typeof item === 'string') : []);
const ordinal = n => ['first', 'second', 'third'][n] ?? `${n + 1}th`;

/** The open world's regions ([{ id, name }]) and its name, or null when no world is open. */
function worldOf(ctx) {
    const pack = isObj(ctx.other?.doc) ? ctx.other.doc : isObj(ctx.other) ? ctx.other : null;
    if (!pack || pack.kind !== 'world') return null;
    const regions = (Array.isArray(pack.content?.regions) ? pack.content.regions : []).filter(region => isObj(region) && typeof region.id === 'string')
        .map(region => ({ id: region.id, name: typeof region.name === 'string' && region.name.trim() ? region.name : region.id }));
    return { name: typeof pack.name === 'string' ? pack.name : 'the open world', regions };
}

/** The names object from [key, value] pairs, in that order (a move, a rename or a copy keeps every other key where it was). */
const rebuild = entries => Object.fromEntries(entries);

/** Why a culture id cannot be used, or ''. */
function idRefusal(names, id, own = null) {
    if (!SLUG.test(id)) return 'A culture id is lowercase letters, digits and dashes, like "river".';
    if (id === 'banned' || id === 'names') return `"${id}" is kept for the pack's own use; pick another culture id.`;
    if (id !== own && Object.hasOwn(names, id)) return `Another culture is already "${id}".`;
    return '';
}

/**
 * A name chips row (given, family, banned, typed regions): the first SHOWN chips and "Show all N ›", × takes one out, the box adds one.
 * An add that is too long, a repeat (ignoring case) or past the list's limit is refused in words. `spec.label` (optional) draws a labelled row.
 */
function nameChips(spec, onChange) {
    const values = listOf(spec.values);
    const box = h('span', { class: 'chips3 st-names' });
    const row = h('div', { class: 'srow wide', dataset: { key: spec.key, type: 'names' } }, spec.label ? h('span', { class: 'lb' }, h('b', spec.label), spec.hint ? h('small', spec.hint) : null) : null, h('span', { class: 'ctl' }, box));
    const draw = () => {
        const shown = spec.state.all ? values : values.slice(0, SHOWN);
        const add = h('input', { class: 'txt2 kadd', placeholder: spec.placeholder ?? 'Add a name', 'aria-label': `${spec.noun}: add` });
        const take = () => {
            const text = oneLine(add.value);
            if (!text) return;
            const refusal = [...text].length > spec.longest ? `"${text}" is longer than ${spec.longest} characters.`
                : values.some(value => foldKey(value) === foldKey(text)) ? `"${text}" is already in the list.`
                    : values.length >= spec.max ? `The list holds at most ${spec.max}.` : '';
            setProblem(row, refusal);
            if (!refusal) onChange([...values, text]);
        };
        add.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault?.(); take(); } });
        add.addEventListener('change', take);
        box.replaceChildren(...[values.length ? null : h('span', { class: 'none' }, spec.none ?? 'None'),
            ...shown.map((value, at) => h('span', { class: 'kc' }, value, h('button', { type: 'button', 'aria-label': `Remove ${value}`, onClick: () => onChange(values.filter((_, i) => i !== at)) }, '×'))),
            values.length > shown.length ? h('button', { type: 'button', class: 'kc st-all', onClick: () => { spec.state.all = true; draw(); } }, `Show all ${values.length} ›`) : null,
            add].filter(Boolean)); // the DOM writes a null child as the text "null"
    };
    draw();
    return setProblem(row, spec.problem);
}

// ---- the list: cultures and the banned names ---------------------------------------------------------------------------------------------------

function listPage(names, ids, ctx, problems) {
    const world = worldOf(ctx);
    const regionName = id => world?.regions.find(region => region.id === id)?.name ?? id;
    const move = (at, step) => {
        const order = [...ids];
        order.splice(at + step, 0, ...order.splice(at, 1));
        let next = 0;
        ctx.commit([{ op: 'set', path: BASE, value: rebuild(Object.keys(names).map(key => (key === 'banned' ? [key, names[key]] : [order[next], names[order[next++]]]))) }]);
    };
    const add = () => {
        let id = 'new-culture';
        for (let n = 2; Object.hasOwn(names, id); n++) id = `new-culture-${n}`;
        const made = ctx.commit([{ op: 'set', path: [...BASE, id], value: { regions: world?.regions[0] ? [world.regions[0].id] : ['region'], given: ['Name'] } }]);
        if (made?.ok) ctx.go(PART, `names.${id}`);
    };
    const problemOf = id => problems.find(problem => String(problem.path) === `content.names.${id}` || String(problem.path).startsWith(`content.names.${id}.`))?.message;
    const table = rowTable({
        key: 'cultures', title: 'Cultures', noun: 'culture', max: LIMIT.cultures, foot: `${ids.length} of ${LIMIT.cultures} cultures`, addLabel: '+ Add a culture', move: false, remove: false,
        note: 'A new person in a place of one of a culture\'s regions gets a name from it. When two cultures share a region, the higher one in this list wins.',
        empty: 'No cultures yet: new people get names from the Built-in lists.',
        columns: [
            { key: 'culture', label: 'Culture · its regions', type: 'custom', render: value => h('span', { class: 'st-cult' }, h('b', value.id), h('small', listOf(value.regions).map(regionName).join(', ') || 'no regions')) },
            { key: 'names', label: 'Names', type: 'static', width: 'minmax(0, 1fr)' },
            { key: 'acts', label: '', type: 'custom', width: 'auto', render: value => h('span', { class: 'st-tacts' },
                h('button', { type: 'button', class: 'btn2 st-up', 'aria-label': `Move ${value.id} up`, disabled: value.at === 0, onClick: () => move(value.at, -1) }, '↑'),
                h('button', { type: 'button', class: 'btn2 st-down', 'aria-label': `Move ${value.id} down`, disabled: value.at === ids.length - 1, onClick: () => move(value.at, 1) }, '↓'),
                h('button', { type: 'button', class: 'btn2 st-open', 'aria-label': `Open ${value.id}`, onClick: () => ctx.go(PART, `names.${value.id}`) }, '›')) },
        ],
        rows: ids.map((id, at) => {
            const culture = isObj(names[id]) ? names[id] : {};
            return { label: id, problem: problemOf(id), values: { culture: { id, regions: culture.regions }, names: `${listOf(culture.given).length} given · ${listOf(culture.family).length} family`, acts: { id, at } } };
        }),
    }, { add });
    const banned = listOf(names.banned);
    const bannedRow = nameChips({ key: 'banned', label: 'Banned names', noun: 'Banned names', hint: `Overused names the story should not give anyone (${banned.length} of ${LIMIT.banned}). Merged with other packs' lists`,
        values: banned, max: LIMIT.banned, longest: LIMIT.bannedName, none: 'None', state: ctx.keep?.('names:banned') ?? {}, problem: problems.find(problem => String(problem.path).startsWith('content.names.banned'))?.message },
    values => ctx.commit([values.length ? { op: 'set', path: [...BASE, 'banned'], value: values } : { op: 'remove', path: [...BASE, 'banned'] }]));
    return [table, h('section', { class: 'sgrp st-banned' }, h('div', { class: 'gt' }, 'Banned'), bannedRow)];
}

// ---- one culture ------------------------------------------------------------------------------------------------------------------------------

function regionsRow(culture, ctx, put, problem) {
    const world = worldOf(ctx);
    const values = listOf(culture.regions);
    if (!world) {
        return nameChips({ key: 'regions', label: 'Regions', noun: 'Regions', hint: 'No world is open, so region ids are typed. Open a world to pick them', values, max: LIMIT.regions, longest: LIMIT.region,
            placeholder: 'Add a region id', state: { all: true }, problem }, list => put('regions', list));
    }
    const known = new Map(world.regions.map(region => [region.id, region.name]));
    const missing = values.filter(id => !known.has(id));
    const full = values.length >= LIMIT.regions;
    const row = h('div', { class: 'srow wide', dataset: { key: 'regions', type: 'ids' } },
        h('span', { class: 'lb' }, h('b', 'Regions'), h('small', `The open world's regions, by id (at most ${LIMIT.regions}). Pick from ${world.name}'s ${world.regions.length}`)),
        h('span', { class: 'ctl chips3' }, values.length ? null : h('span', { class: 'none' }, 'None'),
            values.map((id, at) => h('span', { class: ['kc', known.has(id) ? null : 'warn'], title: id }, known.get(id) ?? id,
                h('button', { type: 'button', 'aria-label': `Remove ${known.get(id) ?? id}`, onClick: () => put('regions', values.filter((_, i) => i !== at)) }, '×'))),
            h('button', { type: 'button', class: 'btn2 st-pickbtn', disabled: full, onClick: () => openPicker({}, { title: 'Pick a region',
                items: world.regions.map(region => ({ id: region.id, label: region.name, sub: region.id, disabled: values.includes(region.id), tag: values.includes(region.id) ? 'added' : null })) },
            id => put('regions', [...values, id])) }, '+ Add a region')));
    if (problem) return setProblem(row, problem);
    if (missing.length) row.append(h('small', { class: 'st-tprob warn', role: 'status' }, `! ${missing.map(id => `"${id}"`).join(', ')} ${missing.length === 1 ? 'is not a region' : 'are not regions'} of ${world.name}; nobody there gets these names.`));
    return row;
}

function culturePage(names, ids, id, ctx, problems) {
    const culture = names[id];
    const at = ids.indexOf(id);
    const rec = `names.${id}`;
    const where = [...BASE, id];
    const state = ctx.keep?.(`names:${rec}`) ?? {};
    const mine = problems.filter(problem => String(problem.path) === `content.names.${id}` || String(problem.path).startsWith(`content.names.${id}.`));
    const problemOf = field => mine.find(problem => String(problem.path).startsWith(`content.names.${id}.${field}`))?.message;
    const said = h('p', { class: 'st-problem', role: 'alert', hidden: true });
    const tell = text => { said.textContent = text ?? ''; said.hidden = !text; return null; };
    const commit = patches => { const result = ctx.commit(patches); if (!result?.ok) tell(result?.refusal ?? 'The change was not made.'); return result; };
    const put = (field, list) => commit([list.length || field !== 'family' ? { op: 'set', path: [...where, field], value: list } : { op: 'remove', path: [...where, field] }]);
    const entries = Object.entries(names);
    const rename = (key, value) => {
        const next = String(value).trim();
        if (next === id) return null;
        const refusal = idRefusal(names, next, id);
        if (refusal) return tell(refusal);
        const made = commit([{ op: 'set', path: BASE, value: rebuild(entries.map(([key2, item]) => [key2 === id ? next : key2, item])) }]);
        return made?.ok ? ctx.go(PART, `names.${next}`) : null;
    };
    const copy = () => {
        if (ids.length >= LIMIT.cultures) return tell(`A pack holds at most ${LIMIT.cultures} cultures.`);
        let next = `${id}-copy`;
        for (let n = 2; Object.hasOwn(names, next); n++) next = `${id}-copy-${n}`;
        const made = commit([{ op: 'set', path: BASE, value: rebuild(entries.flatMap(entry => (entry[0] === id ? [entry, [next, structuredClone(culture)]] : [entry]))) }]);
        return made?.ok ? ctx.go(PART, `names.${next}`) : null;
    };
    const card = () => deleteCard({ title: id, uses: 0, onDelete: () => { state.confirm = false; if (commit([{ op: 'remove', path: where }])?.ok) ctx.go(PART); },
        onKeep: () => { state.confirm = false; sure?.remove(); sure = null; } });
    let sure = state.confirm ? card() : null;
    const drop = () => { if (!sure) { state.confirm = true; sure = card(); said.before(sure); } };
    const flags = h('span', { class: 'st-flags' }, h('button', { type: 'button', class: 'btn2 st-dup', onClick: copy }, 'Duplicate'), h('button', { type: 'button', class: 'btn2 dng st-del', onClick: drop }, 'Delete'));
    const given = listOf(culture.given);
    const family = listOf(culture.family);
    state.given ??= {};
    state.family ??= {};
    state.json ??= {};
    const page = h('section', { class: 'st-rec', dataset: { rec }, tabindex: '-1', 'aria-label': id },
        h('div', { class: 'st-rh' }, h('button', { type: 'button', class: 'btn2 st-back', onClick: () => ctx.go(PART) }, '‹ Names'),
            h('span', { class: 'st-rt' }, h('b', id)), h('small', `Culture ${at + 1} of ${ids.length} · ${ordinal(at)} in the list`), flags),
        sure, said,
        h('div', { class: 'st-edit', dataset: { rec: 'names' } },
            h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Culture'),
                fieldRow({ type: 'text', key: 'id', label: 'Id', hint: 'A short name for the list. Nothing else names it', value: id }, rename),
                regionsRow(culture, ctx, put, problemOf('regions'))),
            h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, `Given names · ${given.length} of ${LIMIT.given}`),
                nameChips({ key: 'given', noun: 'Given names', values: given, max: LIMIT.given, longest: LIMIT.name, state: state.given, problem: problemOf('given') }, list => put('given', list))),
            h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, `Family names · ${family.length} of ${LIMIT.family}`),
                h('p', { class: 'fine st-tnote' }, 'None: people of this culture get only a given name.'),
                nameChips({ key: 'family', noun: 'Family names', values: family, max: LIMIT.family, longest: LIMIT.name, state: state.family, problem: problemOf('family') }, list => put('family', list)))),
        jsonRow({ value: culture, steps: where, noun: 'culture', problems: mine, focus: ctx.focus?.rec === rec ? ctx.focus : null, state: state.json }, patches => ctx.commit(patches)));
    const field = ctx.focus?.rec === rec ? ctx.focus.path?.[0] : null;
    if (field) page.querySelector(`.st-edit [data-key="${field}"]`)?.querySelector('input')?.classList.add('st-at');
    return page;
}

/** `section`: `{ key: 'names', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the cultures and banned list, or one culture's page. */
export function editSection(section, ctx) {
    const names = section.value;
    if (ctx.legacy || typeof ctx.commit !== 'function' || !isObj(names)) return [renderSection(section, ctx)];
    const ids = Object.keys(names).filter(key => key !== 'banned');
    const problems = ctx.problems ?? [];
    const open = /^names\.(.+)$/.exec(ctx.focus?.rec ?? '')?.[1];
    const body = open && ids.includes(open) && isObj(names[open]) ? culturePage(names, ids, open, ctx, problems) : listPage(names, ids, ctx, problems);
    return [h('div', { class: 'st-sec', dataset: { key: 'names' } }, body)];
}
