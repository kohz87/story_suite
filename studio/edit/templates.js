// The templates editor (views/route.js EDITORS: templates): a searchable, filtered list of templates and one template's record page (mock MK-1):
// its id (renamed through the reference index), summary, scope, severity, reach and place kinds; when it happens (needs, requires, odds, chance,
// cooldown, per); what it sets and clears; the open-template menu (powers and scores with delta ranges −10..10, set, clear, ladder, cast; the facts
// it writes; the arc; the fallback); "used by" and the JSON row. A record is opened with Go to (focus "templates.<n>"), like places.

import { h } from '../../ui/kit/dom.js';
import { recordPanes } from '../form/panes.js';
import { EVENT_REACH, SLUG } from '../../packs/limits.js';
import { SCOPES } from '../../modules/world/chronicle/conditions/limits.js';
import { fieldRow, setProblem } from '../form/fields.js';
import { chipList } from '../form/list.js';
import { openPicker } from '../form/pick.js';
import { renderSection } from '../views/records.js';
import { jsonRow } from '../views/json-row.js';
import { definedIds, usedBy } from '../model/refs.js';
import { renameId } from '../model/rename.js';
import { partOfPath } from '../parts.js';
import { recordRow, filterChips } from '../form/reclist.js';
import { deleteCard } from '../form/confirm.js';

const PART = 'templates';
const BASE = ['content', 'templates'];
const SHOWN = 60;
const NONE = '—';
const FILTERS = [['all', 'All'], ['open', 'Open'], ['fixed', 'Fixed'], ['problems', 'Problems']];
const MENU = { powers: 'Powers', scores: 'Scores', set: 'Set a condition', clear: 'Clear a condition', ladder: 'Move along a ladder', cast: 'Move a person' };
const AT = ['@place', '@region', '@realm'];
const ODDS = /^(.+?)\s+(×\d+(?:\.\d+)?)$/;
const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const at = index => `content.templates[${index}]`;
const inRecord = (problem, index) => [`${at(index)}.`, `${at(index)}[`].some(start => String(problem.path).startsWith(start)) || problem.path === at(index);
const sub = t => [t.scope, t.severity, t.reach, t.per].filter(Boolean).join(' · ');

/** A fresh value for one menu pick; the id lists start empty (the picker fills them), powers start on "any". */
function freshPick(key) {
    return { powers: { pick: 1, of: 'any', delta: [-5, 5] }, scores: { pick: 1, of: [], delta: [-5, 5] }, set: { pick: 1, of: [], at: '@place', for: '10 days' },
        clear: { pick: 1, of: [] }, ladder: { of: [], step: 1, direction: 'up' }, cast: { pick: 1, of: 'figures', move: '@region' } }[key];
}

function freeId(list, refs, base) {
    const taken = new Set([...definedIds(refs, 'template').map(item => item.id), ...list.map(item => item?.template)]);
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    return id;
}

function recordIndex(ctx, count) {
    const match = /^templates\.(\d+)$/.exec(ctx.focus?.rec ?? '');
    return match && Number(match[1]) < count ? Number(match[1]) : -1;
}

// ---- the list ---------------------------------------------------------------------------------------------------------------------------------------

const passes = (t, filter, needle, bad) => (filter !== 'open' || t.open !== undefined) && (filter !== 'fixed' || t.open === undefined) && (filter !== 'problems' || bad)
    && (!needle || `${t.template ?? ''} ${t.summary ?? ''} ${sub(t)}`.toLowerCase().includes(needle));

function listPage(list, bad, ctx) {
    const kept = ctx.keep?.('templates:list') ?? {};
    const rows = h('div', { class: 'slist reclist st-tlist' });
    const count = h('p', { class: 'fine' });
    const fill = () => {
        const needle = (kept.q ?? '').trim().toLowerCase();
        const hits = list.map((t, index) => ({ t, index })).filter(({ t, index }) => passes(t, kept.filter ?? 'all', needle, bad[index].length > 0));
        const shown = kept.all || needle ? hits : hits.slice(0, SHOWN);
        rows.replaceChildren(...shown.map(({ t, index }) => recordRow({ cls: 'st-trow', rec: `templates.${index}`, title: t.template ?? `#${index + 1}`, tags: [t.open !== undefined ? 'open' : null],
            sub: [sub(t), t.summary].filter(Boolean).join(' — '), bad: bad[index].length, onClick: () => ctx.go(PART, `templates.${index}`) })));
        if (!hits.length) rows.append(h('p', { class: 'fine' }, list.length ? 'No template matches.' : 'No templates yet.'));
        if (hits.length > shown.length) rows.append(h('button', { type: 'button', class: 'btn2 st-more', onClick: () => { kept.all = true; fill(); } }, `Show all ${hits.length}`));
        count.textContent = `${hits.length} of ${list.length}`;
    };
    const find = h('input', { class: 'psrch st-search', placeholder: 'Find a template…', 'aria-label': 'Find a template' });
    find.value = kept.q ?? '';
    find.addEventListener('input', () => { kept.q = find.value; fill(); });
    const chips = filterChips(FILTERS.map(([key, label]) => [key, key === 'problems' ? `${label} · ${bad.filter(b => b.length).length}` : label]), kept.filter ?? 'all',
        key => { kept.filter = key; kept.all = false; chips.querySelectorAll('.st-filter').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === key))); fill(); });
    const add = () => {
        const made = ctx.commit([{ op: 'insert', path: [...BASE, list.length], value: { template: freeId(list, ctx.refs, 'new-template'), scope: 'place' } }]);
        if (made?.ok) ctx.go(PART, `templates.${list.length}`);
    };
    const open = list.filter(t => t.open !== undefined).length;
    fill();
    return [h('p', { class: 'fine st-counts' }, `${plural(list.length, 'template')} · ${open} open · ${list.length - open} fixed`),
        h('section', { class: 'sgrp st-tlist-wrap' }, h('div', { class: 'st-bar' }, find, chips, h('button', { type: 'button', class: 'btn2 pri st-add', onClick: add }, 'New template')), rows, count)];
}

// ---- rows the record page shares --------------------------------------------------------------------------------------------------------------------

/** A list of ids picked from the pack (removable chips and "+ Add" that opens the id picker; ids already in the list are marked "added"). */
function idChips(spec, ctx, onChange) {
    const values = Array.isArray(spec.values) ? spec.values : [];
    const known = definedIds(ctx.refs, spec.kind);
    const label = id => known.find(item => item.id === id)?.name ?? id;
    const box = h('span', { class: 'chips3' }, values.length ? null : h('span', { class: 'none' }, 'None'),
        values.map((id, n) => h('span', { class: 'kc' }, spec.ordered ? `${n + 1}. ${label(id)}` : label(id),
            h('button', { type: 'button', 'aria-label': `Remove ${id}`, onClick: () => onChange(values.filter((_, i) => i !== n)) }, '×'))),
        h('button', { type: 'button', class: 'btn2 st-pickbtn', onClick: () => openPicker({}, { title: spec.title, items: known.map(item => ({ id: item.id, label: item.name, sub: item.id, disabled: values.includes(item.id), tag: values.includes(item.id) ? 'added' : null })) },
            id => onChange([...values, id])) }, '+ Add'));
    return setProblem(h('div', { class: 'srow wide', dataset: { key: spec.key, type: 'ids' } }, h('span', { class: 'lb' }, h('b', spec.label), spec.hint ? h('small', spec.hint) : null), h('span', { class: 'ctl' }, box)), spec.problem);
}

/** A low..high range of whole numbers within [min, max] (a delta, an arc's steps). A bad pair is refused in words and not committed. */
function rangeRow(spec, onChange) {
    const [lo, hi] = Array.isArray(spec.value) ? spec.value : [];
    const input = (value, which) => h('input', { type: 'number', class: 'txt2 st-range', min: String(spec.min), max: String(spec.max), step: '1', value: value ?? '', 'aria-label': `${spec.label}: ${which}` });
    const low = input(lo, 'low');
    const high = input(hi, 'high');
    const read = h('small', { class: 'fine st-readout' }, Number.isInteger(lo) && Number.isInteger(hi) ? `${spec.sign ? signed(lo) : lo} to ${spec.sign ? signed(hi) : hi}` : '');
    const row = h('div', { class: 'srow', dataset: { key: spec.key, type: 'range' } }, h('span', { class: 'lb' }, h('b', spec.label), h('small', spec.hint)), h('span', { class: 'ctl' }, low, h('span', '…'), high, read));
    const take = () => {
        const pair = [low.value, high.value].map(text => (String(text).trim() === '' ? NaN : Number(text)));
        const bad = !pair.every(n => whole(n, spec.min, spec.max)) ? `Both ends must be whole numbers from ${spec.min} to ${spec.max}.` : pair[0] > pair[1] ? 'The low end comes first.' : '';
        setProblem(row, bad || spec.problem);
        if (!bad) { read.textContent = `${spec.sign ? signed(pair[0]) : pair[0]} to ${spec.sign ? signed(pair[1]) : pair[1]}`; onChange(pair); }
    };
    low.addEventListener('change', take);
    high.addEventListener('change', take);
    return setProblem(row, spec.problem);
}

/** likelier_if / less_if as chips: "<entry> ×N", in the author's key order. A chip that does not end in ×N is refused in words. */
function oddsRow(spec, onChange) {
    const row = chipList({ key: spec.key, label: spec.label, hint: spec.hint, values: Object.entries(spec.value ?? {}).map(([key, value]) => `${key} ${value}`), placeholder: spec.placeholder, none: 'None' }, (key, values) => {
        const bad = values.find(text => !ODDS.test(text.trim()));
        setProblem(row, bad ? `"${bad}" needs odds at the end, like "raiders@region ×0.5" (×0 blocks).` : '');
        if (!bad) onChange(values.length ? Object.fromEntries(values.map(text => ODDS.exec(text.trim()).slice(1, 3))) : undefined);
    });
    return setProblem(row, spec.problem);
}

// ---- the open-template menu -------------------------------------------------------------------------------------------------------------------------

function menuGroup(key, entry, ctx, io) {
    const field = name => `open.menu.${key}.${name}`;
    const put = (name, value) => io.put(['open', 'menu', key, name], value);
    const kind = { powers: 'power', scores: 'score', set: 'condition', clear: 'condition', ladder: 'condition', cast: 'cast' }[key];
    const rows = [];
    // A whole number in [min, max]; blank takes the key out (the game reads 1), anything else is refused in words.
    const count = (name, label, hint, max) => {
        const row = fieldRow({ type: 'number', key: field(name), label, hint, value: entry[name], problem: io.problem(field(name)) }, (k, value) => {
            const bad = value !== null && !whole(value, 1, max);
            setProblem(row, bad ? `A whole number from 1 to ${max}.` : '');
            if (!bad) put(name, value ?? undefined);
        });
        return row;
    };
    if (key !== 'ladder') rows.push(count('pick', 'How many', 'The Director picks 1 to 8 of them; blank is 1', 8));
    const any = (key === 'powers' && entry.of === 'any') || (key === 'cast' && entry.of === 'figures');
    if (key === 'powers' || key === 'cast') {
        rows.push(fieldRow({ type: 'toggle', key: field('of.any'), label: key === 'powers' ? 'Any power' : 'Any figure', hint: key === 'powers' ? 'Off: only the powers listed below' : 'Off: only the people listed below', value: any },
            (k, value) => put('of', value ? (key === 'powers' ? 'any' : 'figures') : [])));
    }
    if (!any) rows.push(idChips({ key: field('of'), label: key === 'ladder' ? 'Rungs, in order' : 'From', hint: key === 'ladder' ? 'At least two conditions, lowest first' : 'Menus name ids, never display names', kind, values: entry.of, ordered: key === 'ladder', title: `Pick a ${kind === 'cast' ? 'person' : kind}`, problem: io.problem(field('of')) }, ctx, list => put('of', list)));
    if (key === 'powers' || key === 'scores') rows.push(rangeRow({ key: field('delta'), label: 'Change', hint: 'The range the Director may move it by, within −10..10', value: entry.delta, min: -10, max: 10, sign: true, problem: io.problem(field('delta')) }, pair => put('delta', pair)));
    if (key === 'set') {
        rows.push(fieldRow({ type: 'select', key: field('at'), label: 'At', hint: 'Where it is set; the condition\'s scope must match', value: AT.includes(entry.at) ? entry.at : NONE, options: [NONE, ...AT], problem: io.problem(field('at')) }, (k, value) => put('at', value === NONE ? undefined : value)),
            fieldRow({ type: 'text', key: field('for'), label: 'For at most', hint: 'The longest the Director may set it, like "10 days"', value: entry.for ?? '', problem: io.problem(field('for')) }, (k, value) => put('for', value.trim() || undefined)));
    }
    if (key === 'ladder') {
        rows.push(count('step', 'Steps', '1 to 3 rungs at a time; blank is 1', 3),
            fieldRow({ type: 'select', key: field('direction'), label: 'Direction', value: entry.direction ?? NONE, options: [NONE, 'up', 'down', 'either'], problem: io.problem(field('direction')) }, (k, value) => put('direction', value === NONE ? undefined : value)));
    }
    if (key === 'cast') rows.push(fieldRow({ type: 'text', key: field('move'), label: 'Moves to', hint: '"@region", "@place", "@realm" or a place of this pack', value: entry.move ?? '', problem: io.problem(field('move')) }, (k, value) => put('move', value.trim() || undefined)));
    return h('section', { class: 'sgrp st-menu', dataset: { menu: key } },
        h('div', { class: 'gt' }, MENU[key], h('button', { type: 'button', class: 'btn2 dng st-unpick', 'aria-label': `Remove the ${MENU[key].toLowerCase()} pick`, onClick: () => io.put(['open', 'menu', key], undefined) }, '×')),
        rows);
}

function openPart(t, ctx, io) {
    const isOpen = t.open !== undefined;
    const toggle = fieldRow({ type: 'toggle', key: 'open', label: 'Open template', hint: 'The Director fills in the details from a menu you set', value: isOpen, problem: isOpen ? null : io.problem('open') },
        (k, value) => (value ? io.put(['open'], { menu: {} }) : io.commit([{ op: 'remove', path: [...io.where, 'open'] }, ...(t.arc === undefined ? [] : [{ op: 'remove', path: [...io.where, 'arc'] }])])));
    const head = h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Open template'), toggle);
    if (!isOpen) return [head];
    const menu = t.open && typeof t.open.menu === 'object' && t.open.menu ? t.open.menu : {};
    const missing = Object.keys(MENU).filter(key => !Object.hasOwn(menu, key));
    head.append(setProblem(h('div', { class: 'srow wide', dataset: { key: 'open.menu' } }, h('span', { class: 'lb' }, h('b', 'Menu'), h('small', Object.keys(menu).length ? 'What the Director may pick from' : 'Add at least one pick')),
        h('span', { class: 'ctl chips3' }, missing.map(key => h('button', { type: 'button', class: 'btn2 st-addpick', dataset: { pick: key }, onClick: () => io.put(['open', 'menu', key], freshPick(key)) }, `+ ${MENU[key]}`)))), io.problem('open.menu')));
    const groups = Object.entries(menu).filter(([key, entry]) => MENU[key] && entry && typeof entry === 'object').map(([key, entry]) => menuGroup(key, entry, ctx, io));
    const steps = Array.isArray(t.arc?.steps) ? t.arc.steps : undefined;
    const more = h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Facts and arc'),
        setProblem(chipList({ key: 'open.writes_facts', label: 'Facts it may write', hint: 'Fact ids, lower-case-with-hyphens', values: t.open.writes_facts, placeholder: 'Add a fact…' }, (k, values) => io.put(['open', 'writes_facts'], values.length ? values : undefined)), io.problem('open.writes_facts')),
        fieldRow({ type: 'toggle', key: 'arc.on', label: 'Starts an arc', hint: 'A run of 2 to 4 happenings, the opening and the ending included', value: t.arc !== undefined }, (k, value) => io.put(['arc'], value ? { steps: [2, 4] } : undefined)),
        t.arc === undefined ? null : rangeRow({ key: 'arc', label: 'Arc length', hint: 'Happenings in all, from 2 to 4', value: steps, min: 2, max: 4, problem: io.problem('arc') }, pair => io.put(['arc'], { steps: pair })));
    return [head, ...groups, more];
}

// ---- one template -----------------------------------------------------------------------------------------------------------------------------------

function usedNode(ctx, id) {
    const uses = id ? usedBy(ctx.refs, 'template', id) : [];
    const seen = new Set();
    const items = uses.filter(use => !seen.has(use.rec) && seen.add(use.rec)).map(use => {
        const place = partOfPath(`content.${use.owner.part}${use.owner.index === null ? '' : `[${use.owner.index}]`}`, ctx.kind);
        return h('button', { type: 'button', class: 'kc st-used', dataset: { rec: use.rec }, onClick: () => ctx.go(place.part, place.rec ?? use.rec) }, `${use.owner.id ?? use.rec} · ${use.role}`);
    });
    return h('section', { class: 'sgrp st-usedby' }, h('div', { class: 'gt' }, 'Used by'),
        h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('small', items.length ? 'Records that test for this template\'s arc (arc-ended:)' : `No other record names this template (as arc-ended:${id ?? '…'}).`)), items.length ? h('span', { class: 'ctl chips3' }, items) : null));
}

function recordPage(list, index, bad, ctx) {
    const t = list[index];
    const where = [...BASE, index];
    const rec = `templates.${index}`;
    const mine = bad[index];
    const state = ctx.keep?.(`templates:${rec}`) ?? {};
    const said = h('p', { class: 'st-problem', role: 'alert', hidden: true });
    const tell = text => { said.textContent = text ?? ''; said.hidden = !text; };
    const commit = patches => { const result = ctx.commit(patches); if (!result?.ok) tell(result?.refusal ?? 'The change was not made.'); return result; };
    const getAt = path => path.reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), t);
    // One value at a path below the record: undefined takes the key out (as the checker reads a missing one).
    const put = (path, value) => {
        if (value === undefined && getAt(path) === undefined) return null;
        return commit([value === undefined ? { op: 'remove', path: [...where, ...path] } : { op: 'set', path: [...where, ...path], value }]);
    };
    const problem = field => mine.find(item => item.path === `${at(index)}.${field}` || [`${at(index)}.${field}.`, `${at(index)}.${field}[`].some(start => String(item.path).startsWith(start)))?.message;
    const io = { where, put, commit, problem };
    const text = (key, label, hint, rows) => fieldRow({ type: rows ? 'long' : 'text', rows, key, label, hint, value: t[key] ?? '', problem: problem(key) }, (k, value) => put([key], value.trim() || undefined));
    const pick = (key, label, hint, options) => fieldRow({ type: 'select', key, label, hint, value: options.includes(t[key]) ? t[key] : NONE, options: [NONE, ...options], problem: problem(key) }, (k, value) => put([key], value === NONE ? undefined : value));
    const lines = (key, label, hint, placeholder) => setProblem(chipList({ key, label, hint, values: Array.isArray(t[key]) ? t[key] : [], placeholder }, (k, values) => put([key], values.length ? values : undefined)), problem(key));
    const rename = (k, value) => {
        const id = String(value).trim();
        if (id === t.template) return;
        const known = (ctx.refs?.defs?.template ?? []).some(item => item.id === t.template);
        const done = known ? renameId(ctx.refs, ctx.doc, 'template', t.template, id) : SLUG.test(id) ? { ok: true, patches: [{ op: 'set', path: [...where, 'template'], value: id }] } : { ok: false, refusal: 'An id is lower-case words joined by "-".' };
        if (!done.ok) { tell(done.refusal); return; }
        commit(done.patches);
    };
    const kinds = Array.isArray(t.where?.kinds) ? t.where.kinds : [];
    const form = h('div', { class: 'st-edit', dataset: { rec: 'templates' } },
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Template'),
            fieldRow({ type: 'text', key: 'template', label: 'Id', hint: 'Other records name it by this. Renaming changes them too', value: t.template, problem: problem('template') }, rename),
            text('summary', 'Summary', 'One line of at most 300 characters; {place} and {region} are filled in', 2),
            pick('scope', 'About', 'What the happening is attached to', SCOPES),
            pick('severity', 'Severity', 'Minor or major', ['minor', 'major']),
            pick('reach', 'Reach', 'How far the news travels', EVENT_REACH),
            setProblem(chipList({ key: 'where', label: 'Place kinds', hint: 'Only at places of these kinds (placeKinds or engine classes); none: anywhere', values: kinds, placeholder: 'Add a kind…' }, (k, values) => put(['where'], values.length ? { ...(t.where ?? {}), kinds: values } : undefined)), problem('where'))),
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'When it happens'),
            lines('needs', 'Needs', 'Each must hold at the place, like "evacuated@place"', 'evacuated@place'),
            lines('requires', 'Requires', 'All of these must hold', 'unrest@place'),
            lines('requires_any', 'Requires any', 'At least one of these must hold', 'grain-dear@region'),
            oddsRow({ key: 'likelier_if', label: 'Likelier if', hint: 'An entry and odds, like "score:tide-pressure >= 30 ×2"', value: t.likelier_if, placeholder: 'plague@region ×2', problem: problem('likelier_if') }, value => put(['likelier_if'], value)),
            oddsRow({ key: 'less_if', label: 'Less likely if', hint: 'An entry and odds; ×0 blocks it', value: t.less_if, placeholder: 'raiders@region ×0', problem: problem('less_if') }, value => put(['less_if'], value)),
            text('chance', 'Chance', '"20% over the window" or "30% per season"'),
            text('cooldown', 'Cooldown', 'Like "1 season per place"'),
            text('per', 'How often', 'For an open template, like "region per season"')),
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'What it does'),
            lines('sets', 'Sets', 'A condition, where and how long, like "unrest@place: 10 days"', 'unrest@place: 10 days'),
            lines('clears', 'Clears', 'A condition and where, like "evacuated@place"', 'evacuated@place')),
        ...openPart(t, ctx, io),
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Fallback'),
            setProblem(chipList({ key: 'fallback.sets', label: 'Sets instead', hint: 'When the Director cannot fill the template', values: t.fallback?.sets, placeholder: 'unrest@place: 10 days' }, (k, values) => put(['fallback'], fallbackWith(t.fallback, 'sets', values))), problem('fallback.sets') ?? problem('fallback')),
            setProblem(chipList({ key: 'fallback.clears', label: 'Clears instead', values: t.fallback?.clears, placeholder: 'unrest@place' }, (k, values) => put(['fallback'], fallbackWith(t.fallback, 'clears', values))), problem('fallback.clears'))),
        usedNode(ctx, t.template));
    if (state.json === undefined) state.json = {};
    const json = jsonRow({ value: t, steps: where, noun: 'template', problems: mine, focus: ctx.focus?.rec === rec ? ctx.focus : null, state: state.json }, patches => ctx.commit(patches));
    const copy = () => { if (commit([{ op: 'insert', path: [...BASE, index + 1], value: { ...structuredClone(t), template: freeId(list, ctx.refs, `${t.template ?? 'template'}-copy`) } }])?.ok) ctx.go(PART, `templates.${index + 1}`); };
    const used = t.template ? usedBy(ctx.refs, 'template', t.template).length : 0;
    const card = () => deleteCard({ title: String(t.template ?? `Template ${index + 1}`), uses: 0, onDelete: () => { state.confirm = false; if (commit([{ op: 'remove', path: where }])?.ok) ctx.go(PART); },
        onKeep: () => { state.confirm = false; sure?.remove(); sure = null; } });
    let sure = state.confirm && !used ? card() : null;
    const drop = () => {
        if (used) return tell(`Named in ${plural(used, 'place')} (arc-ended:${t.template}): take those out first.`);
        if (!sure) { state.confirm = true; sure = card(); said.before(sure); }
        return null;
    };
    const flags = h('span', { class: 'st-flags' }, t.open !== undefined ? h('span', { class: 'tg2' }, 'open') : null, h('button', { type: 'button', class: 'btn2 st-dup', onClick: copy }, 'Duplicate'),
        h('button', { type: 'button', class: 'btn2 dng st-del', onClick: drop }, 'Delete'));
    const page = h('section', { class: 'st-rec', dataset: { rec }, tabindex: '-1', 'aria-label': String(t.template ?? `Template ${index + 1}`) },
        h('div', { class: 'st-rh' }, h('button', { type: 'button', class: 'btn2 st-back', onClick: () => ctx.go(PART) }, '‹ Templates'),
            h('span', { class: 'st-rt' }, h('b', String(t.template ?? ''))), h('small', `Template ${index + 1} of ${list.length}`), flags),
        sure, said, form, json);
    markFocus(page, ctx.focus?.rec === rec ? ctx.focus.path : null);
    return page;
}

const fallbackWith = (fallback, key, values) => {
    const next = { ...(fallback && typeof fallback === 'object' ? fallback : {}) };
    if (values.length) next[key] = values; else delete next[key];
    return Object.keys(next).length ? next : undefined;
};

// Go to / F8: the control of the deepest field on the path that the page draws gets `st-at` (and the caret at its start).
function markFocus(page, path) {
    if (!Array.isArray(path) || !path.length) return;
    const steps = path.filter(step => typeof step === 'string');
    for (let n = steps.length; n > 0; n--) {
        const control = page.querySelector(`.st-edit [data-key="${steps.slice(0, n).join('.')}"]`)?.querySelector('input,select,textarea,button');
        if (control) { control.classList.add('st-at'); control.dataset.at = '0'; return; }
    }
}

/** `section`: `{ key: 'templates', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the list, or the open template's page. */
export function editSection(section, ctx) {
    const list = Array.isArray(section.value) ? section.value : null;
    // a section that is not a clean list of records (or a read-only pack) stays readable and editable as JSON
    if (!list || list.some(t => !t || typeof t !== 'object' || Array.isArray(t)) || ctx.legacy || typeof ctx.commit !== 'function') return [renderSection(section, ctx)];
    const bad = list.map((_, index) => (ctx.problems ?? []).filter(problem => inRecord(problem, index)));
    const index = recordIndex(ctx, list.length);
    return [h('div', { class: 'st-sec', dataset: { key: 'templates' } }, recordPanes({ noun: 'template', icon: '❖', list: [h('div', { class: 'secl2' }, `Templates · ${list.length}`), ...listPage(list, bad, ctx)],
        rec: index < 0 ? null : recordPage(list, index, bad, ctx) }))];
}
