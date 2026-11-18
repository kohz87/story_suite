// The Studio's lore editor (views/route.js EDITORS: lore): the list of entries with a search and filters, and one entry's form
// (title, id, text, keys, second keys and their rule, always sent, order, protected, hidden with its gate, the fact it records), a "used by" list and the JSON row.

import { h } from '../../ui/kit/dom.js';
import { fieldRow } from '../form/fields.js';
import { chipList } from '../form/list.js';
import { gateField } from '../form/gate.js';
import { jsonRow } from '../views/json-row.js';
import { recordPanes } from '../form/panes.js';
import { usedBy } from '../model/refs.js';
import { renameId } from '../model/rename.js';
import { partOfPath } from '../parts.js';
import { recordRow, filterChips } from '../form/reclist.js';
import { deleteCard } from '../form/confirm.js';

const SHOWN = 40;
const TEXT_MAX = 4000;
const BASE = ['content', 'lore'];
const RULES = [['and any', 'Any of them'], ['and all', 'All of them'], ['not any', 'None of them'], ['not all', 'Not all of them']];
const FILTERS = [['all', 'All'], ['hidden', 'Hidden'], ['protected', 'Protected'], ['constant', 'Always sent'], ['problems', 'Problems']];
const FIELDS = ['title', 'keys', 'secondaryKeys', 'logic', 'constant', 'order', 'text', 'protected', 'hidden', 'gate', 'id', 'writes_fact'];
const at = index => 'content.lore[' + index + ']';
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

/** Tokens in some text, about four characters each; rounded to ten once it is long enough for that to be honest. */
const tokens = text => {
    const n = Math.ceil(String(text ?? '').length / 4);
    return n >= 100 ? Math.round(n / 10) * 10 : n;
};
const inProblem = (problem, index) => [at(index) + '.', at(index) + '['].some(start => String(problem.path).startsWith(start)) || problem.path === at(index);

function keysLine(entry) {
    const keys = Array.isArray(entry.keys) ? entry.keys : [];
    return (keys.length ? 'keys: ' + keys.slice(0, 3).join(', ') + (keys.length > 3 ? ' +' + (keys.length - 3) : '') : 'no keys') + ' · about ' + tokens(entry.text) + ' tokens';
}

function flagsOf(entry) {
    return [entry.hidden === true ? 'hidden' : null, entry.protected === true ? 'protected' : null, entry.constant === true ? 'always sent' : null].filter(Boolean);
}

const passes = (entry, filter, query, bad) => {
    if (filter === 'hidden' && entry.hidden !== true) return false;
    if (filter === 'protected' && entry.protected !== true) return false;
    if (filter === 'constant' && entry.constant !== true) return false;
    if (filter === 'problems' && !bad) return false;
    const needle = query.trim().toLowerCase();
    return !needle || [entry.title, entry.id, ...(entry.keys ?? []), ...(entry.secondaryKeys ?? [])].join(' ').toLowerCase().includes(needle);
};

/**
 * The lore section. `section`: { key, where, value, count }; ctx: the editor context (views/route.js). The view (list or one entry, the filter, the search)
 * lives in ctx.keep('lore'), so it survives the redraw after each change; a focus on "lore.<n>" opens that entry and marks the field for the path.
 */
export function editSection(section, ctx) {
    const list = Array.isArray(section.value) ? section.value : [];
    const state = ctx.keep?.('lore') ?? {};
    const focused = /^lore\.(\d+)$/.exec(ctx.focus?.rec ?? '');
    if (focused && Number(focused[1]) < list.length) { state.open = Number(focused[1]); state.confirm = false; }
    if (state.open !== undefined && state.open !== null && !(state.open < list.length)) state.open = null;
    const root = h('div', { class: 'st-sec st-lore', dataset: { key: 'lore' } });
    const bad = list.map((_, index) => (ctx.problems ?? []).filter(problem => inProblem(problem, index)));
    // Both panes on every draw (form/panes.js): the list stays beside the open entry at 1280 px and wider.
    const draw = () => root.replaceChildren(recordPanes({ noun: 'entry', icon: '✎', list: listView(list, bad, ctx, state, draw),
        rec: typeof state.open === 'number' ? entryView(list, state.open, bad, ctx, state, draw) : null }));
    draw();
    return [root];
}

function listView(list, bad, ctx, state, draw) {
    const filter = state.filter ?? 'all';
    const count = key => list.filter((entry, index) => passes(entry, key, '', bad[index].length > 0)).length;
    const rows = h('div', { class: 'slist reclist st-list' });
    const fill = () => {
        const found = list.map((entry, index) => ({ entry, index })).filter(({ entry, index }) => passes(entry, state.filter ?? 'all', state.q ?? '', bad[index].length > 0));
        const shown = state.all ? found : found.slice(0, SHOWN);
        // A filtered list says how many it shows, and that the open entry (beside it at 1280 px) is not among them (mock MK-2 "filter").
        const narrowed = (state.filter ?? 'all') !== 'all' || Boolean((state.q ?? '').trim());
        const away = typeof state.open === 'number' && narrowed && !found.some(({ index }) => index === state.open);
        rows.replaceChildren(...[away ? h('p', { class: 'fine st-notin' }, 'The open entry isn’t in this list. ', h('button', { type: 'button', class: 'lnk st-showit', onClick: () => { Object.assign(state, { filter: 'all', q: '', all: false }); draw(); } }, 'Show it ›')) : null,
        narrowed ? h('p', { class: 'fine st-of' }, found.length + ' of ' + plural(list.length, 'entry', 'entries')) : null,
        ...shown.map(({ entry, index }) => recordRow({ cls: 'st-lorerow', rec: 'lore.' + index, title: entry.title ?? entry.id ?? '#' + (index + 1), tags: flagsOf(entry), sub: keysLine(entry),
            bad: bad[index].length, onClick: () => { state.open = index; state.confirm = false; draw(); } })),
        found.length === 0 ? h('p', { class: 'fine' }, list.length ? 'No entry matches.' : 'No lore entries yet.') : null,
        !state.all && found.length > SHOWN ? h('button', { type: 'button', class: 'btn2 st-more', onClick: () => { state.all = true; fill(); } }, 'Show all ' + found.length) : null].filter(Boolean)); // a null child would print "null"
    };
    const search = h('input', { class: 'psrch st-search', placeholder: 'Search lore…', 'aria-label': 'Search lore' });
    search.value = state.q ?? '';
    search.addEventListener('input', () => { state.q = search.value; state.all = false; fill(); });
    const chips = filterChips(FILTERS.map(([key, label]) => [key, key === 'problems' ? label + ' · ' + count('problems') : label]), filter, key => { state.filter = key; state.all = false; draw(); });
    const add = h('button', { type: 'button', class: 'btn2 pri st-new', onClick: () => create(list, ctx, state) }, 'New entry');
    const n = key => list.filter(entry => entry[key] === true).length;
    fill();
    return [h('p', { class: 'fine st-counts' }, plural(list.length, 'entry', 'entries') + ' · ' + n('hidden') + ' hidden · ' + n('protected') + ' protected · ' + n('constant') + ' always sent'),
        h('div', { class: 'st-bar' }, search, chips, add), rows];
}

// A title no other entry has ("New entry", "New entry 2"…): titles are unique in a pack.
function freshTitle(list, base) {
    const taken = new Set(list.map(entry => entry?.title));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(base + ' ' + n)) return base + ' ' + n;
}

function create(list, ctx, state) {
    const was = { open: state.open, q: state.q, filter: state.filter }; // each key, set or not, so a refusal restores it exactly
    Object.assign(state, { open: list.length, q: '', filter: 'all' }); // before commit: the Studio redraws inside it
    const result = ctx.commit([{ op: 'insert', path: [...BASE, list.length], value: { title: freshTitle(list, 'New entry'), keys: [], text: '' } }]);
    if (!result?.ok) Object.assign(state, was);
}

function duplicate(list, index, ctx, state) {
    const copy = JSON.parse(JSON.stringify(list[index]));
    copy.title = freshTitle(list, String(copy.title ?? 'Entry') + ' (copy)');
    delete copy.id; // an id names one entry
    const was = state.open;
    state.open = index + 1;
    const result = ctx.commit([{ op: 'insert', path: [...BASE, index + 1], value: copy }]);
    if (!result?.ok) state.open = was;
}

function entryView(list, index, bad, ctx, state, draw) {
    const entry = list[index];
    const note = h('small', { class: 'st-problem', role: 'status' });
    const say = result => { if (!result?.ok) note.textContent = result?.refusal ?? 'The change was not made.'; return result; };
    const focusKey = ctx.focus?.rec === 'lore.' + index ? ctx.focus.path?.[0] : null;
    const problemOf = key => bad[index].find(problem => problem.path === at(index) + '.' + key || String(problem.path).startsWith(at(index) + '.' + key + '['))?.message ?? '';
    const put = (key, value, drop = false) => {
        if (drop) return Object.hasOwn(entry, key) ? say(ctx.commit([{ op: 'remove', path: [...BASE, index, key] }])) : null;
        return say(ctx.commit([{ op: 'set', path: [...BASE, index, key], value }]));
    };
    const mark = row => { if (focusKey && row.dataset?.key === focusKey) { const control = row.querySelector('input,textarea,select'); if (control) { control.classList.add('st-at'); control.dataset.at = '0'; } } return row; };
    const field = (spec, drop) => mark(fieldRow({ problem: problemOf(spec.key), ...spec }, (key, value) => put(key, value, drop?.(value))));
    const flag = (key, label, hint) => field({ type: 'toggle', key, label, hint, value: entry[key] === true }, value => value !== true);
    const group = (title, ...rows) => h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, title), ...rows.filter(Boolean));

    const text = field({ type: 'long', key: 'text', label: 'Text', hint: 'What the story is told when the entry comes in', value: entry.text ?? '', rows: 8 });
    const count = h('small', { class: 'fine st-count' });
    const counts = value => { count.textContent = value.length.toLocaleString('en-US') + ' of ' + TEXT_MAX.toLocaleString('en-US') + ' characters · about ' + tokens(value) + ' tokens'; };
    counts(entry.text ?? '');
    text.querySelector('textarea')?.addEventListener('input', event => counts(event.target?.value ?? ''));
    text.append(count);

    // An id that other records name is renamed through the rename plan, which rewrites them too; any other id change is a plain set.
    const known = typeof entry.id === 'string' && (ctx.refs?.defs?.lore ?? []).some(item => item.id === entry.id);
    const changeId = value => {
        const next = String(value).trim();
        if (!next) {
            const named = known ? usedBy(ctx.refs, 'lore', entry.id).length : 0;
            return named ? say({ ok: false, refusal: `${named === 1 ? 'A record names' : `${named} records name`} this entry by its id, so it keeps one; give it a new id instead.` }) : put('id', null, true);
        }
        if (next === entry.id) return null;
        if (!known) return put('id', next);
        const plan = renameId(ctx.refs, ctx.doc, 'lore', entry.id, next);
        return plan.ok ? say(ctx.commit(plan.patches)) : say({ ok: false, refusal: plan.refusal });
    };
    const idRow = mark(fieldRow({ type: 'text', key: 'id', label: 'Id', hint: 'Other records name it by this. Renaming changes them too', value: entry.id ?? '', problem: problemOf('id') }, (_, value) => changeId(value)));

    const ruleLabel = Object.fromEntries(RULES);
    const ruleValue = Object.fromEntries(RULES.map(([value, label]) => [label, value]));
    const keys = (key, label, hint, placeholder) => mark(chipList({ key, label, hint, values: Array.isArray(entry[key]) ? entry[key] : [], placeholder }, (_, values) => put(key, values, key === 'secondaryKeys' && !values.length)));
    const gate = entry.hidden === true || entry.gate !== undefined
        ? mark(gateField({ key: 'gate', label: 'Gate', hint: 'Terms joined by or / and; and binds first. Checked as you type', value: entry.gate ?? '', content: ctx.doc?.doc?.content ?? ctx.doc?.content ?? {}, ownerId: null, rec: entry.id ?? entry.title ?? 'lore.' + index }, (_, value) => put('gate', value, value === '')))
        : null;
    const uses = typeof entry.id === 'string' ? usedBy(ctx.refs, 'lore', entry.id) : [];
    const head = h('div', { class: 'st-bar' },
        h('button', { type: 'button', class: 'btn2 st-back', onClick: () => { state.open = null; state.confirm = false; draw(); } }, '‹ Lore'),
        h('span', { class: 'st-acts' },
            h('button', { type: 'button', class: 'btn2 st-dup', onClick: () => duplicate(list, index, ctx, state) }, 'Duplicate'),
            h('button', { type: 'button', class: 'btn2 dng st-del', onClick: () => { state.confirm = true; draw(); } }, 'Delete')));
    const sure = state.confirm ? deleteCard({ title: String(entry.title ?? entry.id ?? 'Lore entry ' + (index + 1)), uses: uses.length,
        onDelete: () => { Object.assign(state, { open: null, confirm: false }); const result = say(ctx.commit([{ op: 'remove', path: [...BASE, index] }])); if (!result?.ok) Object.assign(state, { open: index, confirm: true }); },
        onKeep: () => { state.confirm = false; draw(); } }) : null;
    const extra = Object.keys(entry).filter(key => !FIELDS.includes(key));
    // One record element holds the whole entry, so Go to and F8 find the marked field (or the JSON row) in it and a redraw keeps the box being typed in.
    return [h('section', { class: 'st-rec', dataset: { rec: 'lore.' + index }, tabindex: '-1', 'aria-label': String(entry.title ?? 'Lore entry ' + (index + 1)) }, head,
        h('div', { class: 'st-rt st-entryhead' }, h('b', entry.title ?? '(no title)'),
            h('small', 'Lore entry ' + (index + 1) + ' of ' + list.length), ...flagsOf(entry).map(name => h('span', { class: 'tg2' }, name))),
        sure, note,
        group('Entry', field({ type: 'text', key: 'title', label: 'Title', hint: 'Shown in lists and to the Director', value: entry.title ?? '' }), idRow, text),
        group('When it comes in',
            keys('keys', 'Keys', 'Words in the chat that bring it in', 'Add a key…'),
            keys('secondaryKeys', 'Second keys', 'Checked as well, by the rule below', 'Add a second key…'),
            mark(fieldRow({ type: 'select', key: 'logic', label: 'Second keys rule', hint: 'How the second keys must match', options: RULES.map(rule => rule[1]), value: ruleLabel[entry.logic] ?? RULES[0][1], problem: problemOf('logic') },
                (_, label) => put('logic', ruleValue[label], label === RULES[0][1] && entry.logic === undefined))),
            flag('constant', 'Always sent', 'Sent every reply, keys or not'),
            field({ type: 'number', key: 'order', label: 'Order', hint: 'The World Info order number. Blank: none', value: entry.order ?? null }, value => value === null)),
        group('Who sees it',
            flag('protected', 'Protected', 'Plans keep to it as written'),
            flag('hidden', 'Hidden', 'Kept from the story until its gate opens'),
            gate,
            entry.hidden === true || entry.writes_fact !== undefined
                ? field({ type: 'text', key: 'writes_fact', label: 'Fact it records', hint: 'Set when this entry is learned; events and gates test it as fact:<id>', value: entry.writes_fact ?? '' }, value => !String(value).trim()) : null),
        group('Used by', ...(uses.length ? uses.map(use => usedRow(use, ctx)) : [h('p', { class: 'fine' }, typeof entry.id === 'string' ? 'No other record names this entry (as learned:lore/' + entry.id + ').' : 'Give the entry an id for other records to name it.')])),
        extra.length ? h('p', { class: 'fine' }, 'Also in this entry, only in the JSON below: ' + extra.join(', ') + '.') : null,
        jsonRow({ value: entry, steps: [...BASE, index], noun: 'entry', problems: bad[index], focus: focusKey && !FIELDS.includes(focusKey) ? ctx.focus : null, state: ctx.keep?.('json:lore.' + index) ?? {} }, patches => ctx.commit(patches)))];
}

function usedRow(use, ctx) {
    const part = partOfPath('content.' + use.owner.part + (typeof use.owner.index === 'number' ? '[' + use.owner.index + ']' : ''), ctx.kind);
    return h('div', { class: 'srow' },
        h('span', { class: 'lb' }, h('b', use.owner.id ?? use.rec), h('small', use.owner.part + ' · ' + (use.role ?? 'text'))),
        h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2', 'aria-label': 'Go to ' + (use.owner.id ?? use.rec), onClick: () => ctx.go(part.part, part.rec ?? use.rec) }, 'Go to')));
}
