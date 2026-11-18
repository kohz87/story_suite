// The Overview editor: the pack's own fields (name, id, version, author, description, what it needs, and a world's recommended game) as
// settings rows on the Overview page (mock MK-1 rows, MK-9 "converted" Overview). Each edit is one patch; a cleared optional field takes its
// key out, as the checker reads a missing one. The format and kind are shown, not edited: the other kind is a new pack.
//
// The Studio calls the editor once per top-level field the pack holds, in the checker's field order, all in one draw. The call for the first
// field draws the whole form (so a field the pack lacks can be filled in); the later calls hand their problems to its rows and draw nothing.

import { h } from '../../ui/kit/dom.js';
import { PACK_FIELDS_V4 } from '../../packs/limits.js';
import { fieldRow as editRow, setProblem } from '../form/fields.js';
import { chipList } from '../form/list.js';
import { fieldRow as readRow } from '../views/value.js';

const TOP = PACK_FIELDS_V4.filter(key => key !== 'content');
const KIND = { world: 'World pack', game: 'Game pack' };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const drawn = new WeakMap(); // document → { rows: Map(path → row), nodes } of the form its first field's call drew

// The row a checker path belongs to: the path itself, else its nearest parent that has a row, else the group's first row.
const FALLBACK = { requires: 'requires.suite', recommends: 'recommends.game.id' };
function rowFor(rows, path) {
    const parts = String(path).split('.');
    for (let n = parts.length; n > 0; n--) {
        const key = parts.slice(0, n).join('.');
        if (rows.has(key)) return rows.get(key);
        if (n === 1 && FALLBACK[key]) return rows.get(FALLBACK[key]) ?? null;
    }
    return null;
}

function showProblems(form, problems) {
    const byRow = new Map();
    for (const problem of problems ?? []) {
        const row = rowFor(form.rows, problem.path);
        if (!row) continue;
        if (!byRow.has(row)) byRow.set(row, []);
        byRow.get(row).push(problem);
    }
    for (const [row, list] of byRow) setProblem(row, list.map(problem => problem.message).join(' '));
}

// The range a recommendation of `version` reads as: "^1" for 1.x.y, "^0.3" for 0.3.y.
const rangeOf = version => {
    const match = /^(\d+)\.(\d+)/.exec(String(version ?? ''));
    if (!match) return '';
    return match[1] === '0' ? `^0.${match[2]}` : `^${match[1]}`;
};

function form(doc, ctx) {
    const rows = new Map();
    // The last edit's note or refusal lives in keep, so the redraw after the edit (and after its check) still shows it.
    const state = ctx.keep?.('overview') ?? {};
    const said = h('p', { class: 'st-problem', role: 'alert', hidden: !state.note }, state.note ?? '');
    const tell = text => { state.note = text ?? ''; said.textContent = state.note; said.hidden = !text; };
    const commit = (patches, note = '') => {
        state.note = note;
        const result = ctx.commit(patches);
        tell(result?.ok ? note : result?.refusal ?? 'The change was not made.');
        return result;
    };
    const has = (object, key) => isObject(object) && Object.hasOwn(object, key);
    // A top-level text field: blank takes the key out (an id or version cannot be blank).
    const put = (key, value) => {
        const text = typeof value === 'string' ? value.trim() : value;
        if (text === '' || text === null) {
            if (key === 'id' || key === 'version') return tell(`A pack needs ${key === 'id' ? 'an id' : 'a version'}; it was left as it was.`);
            if (has(doc, key)) commit([{ op: 'remove', path: [key] }]);
            return undefined;
        }
        if (text === doc[key]) return undefined;
        const named = key === 'id' && ctx.kind === 'game' && ctx.other?.recommends?.game?.id === doc.id;
        return commit([{ op: 'set', path: [key], value: text }], named ? `The open world recommends this game as ${doc.id}; change it there too.` : '');
    };
    // A field of `requires`: blank (or an empty list) takes it out; `requires` itself is written whole when the pack has none.
    const need = (key, value) => {
        const gone = value === '' || (Array.isArray(value) && !value.length);
        const requires = isObject(doc.requires) ? doc.requires : null;
        if (gone) return has(requires, key) ? commit([{ op: 'remove', path: ['requires', key] }]) : undefined;
        if (requires?.[key] === value) return undefined;
        return commit([requires ? { op: 'set', path: ['requires', key], value } : { op: 'set', path: ['requires'], value: { [key]: value } }]);
    };
    // The recommended game: written whole; both blank takes `recommends` out.
    const game = isObject(doc.recommends?.game) ? doc.recommends.game : {};
    const recommend = (key, value) => {
        const next = { ...game };
        if (value) next[key] = value; else delete next[key];
        if (!Object.keys(next).length) return has(doc, 'recommends') ? commit([{ op: 'remove', path: ['recommends'] }]) : undefined;
        if (next[key] === game[key]) return undefined;
        return commit([{ op: 'set', path: ['recommends'], value: { ...(isObject(doc.recommends) ? doc.recommends : {}), game: next } }]);
    };
    // `short`: a version or range, drawn as a short box (mock MK-9 "converted" Overview).
    const text = (path, spec, change, short = false) => {
        const row = editRow({ type: 'text', key: path, ...spec }, (key, value) => change(String(value ?? '').trim()));
        const input = short ? row.querySelector('input') : null;
        if (input) { input.classList.add('st-short'); if (input.style) input.style.maxWidth = '12em'; }
        rows.set(path, row);
        return row;
    };

    const pack = [
        text('name', { label: 'Name', hint: 'Shown in Settings › Packs. Blank: the id', value: doc.name }, value => put('name', value)),
        text('id', { label: 'Id', hint: 'Settings and chats name it by this: lowercase letters, digits and dashes', value: doc.id }, value => put('id', value)),
        text('version', { label: 'Version', hint: 'Like 1.0.0. Raise it when you share a new copy', value: doc.version }, value => put('version', value), true),
        text('author', { label: 'Author', hint: 'Who made it', value: doc.author }, value => put('author', value)),
    ];
    const about = editRow({ type: 'long', key: 'description', label: 'Description', hint: 'What a reader gets from it, shown in Settings › Packs', value: typeof doc.description === 'string' ? doc.description : '', rows: 3 },
        (key, value) => put('description', String(value ?? '').trim()));
    rows.set('description', about);
    const kindRow = h('div', { class: 'srow', dataset: { key: 'kind', type: 'fixed' } },
        h('span', { class: 'lb' }, h('b', 'Kind'), h('small', `Fixed: for a ${ctx.kind === 'game' ? 'world' : 'game'}, start a new pack`)),
        h('span', { class: 'ctl' }, h('span', { class: 'st-val' }, `${KIND[ctx.kind] ?? 'Pack'} · format ${doc.format ?? '?'}`)));
    rows.set('kind', kindRow);
    rows.set('format', kindRow);

    const requires = isObject(doc.requires) ? doc.requires : {};
    const needs = [
        h('div', { class: 'gt' }, 'Needs'),
        text('requires.suite', { label: 'Story Suite version', hint: 'A range, like ^0.1 (this version line and later fixes)', value: requires.suite }, value => need('suite', value), true),
    ];
    if (requires.storyBlock !== undefined) {
        needs.push(text('requires.storyBlock', { label: 'Story Block version', hint: 'The older name; format 4 reads only the Story Suite version. Blank takes it out', value: String(requires.storyBlock) }, value => need('storyBlock', value)));
    }
    const capabilities = chipList({ key: 'requires.capabilities', label: 'Modules it needs', hint: 'Names like inventory or party; the pack does not load without them',
        values: Array.isArray(requires.capabilities) ? requires.capabilities.map(String) : [], placeholder: 'Add a name…' }, (key, values) => need('capabilities', values));
    rows.set('requires.capabilities', capabilities);
    needs.push(capabilities);

    const recommends = [];
    if (ctx.kind !== 'game') {
        const other = ctx.other && ctx.other.kind === 'game' && typeof ctx.other.id === 'string' ? ctx.other : null;
        recommends.push(h('div', { class: 'gt' }, 'Recommends'),
            text('recommends.game.id', { label: 'Game', hint: 'The id of the game pack this world is written for. Blank: none', value: game.id }, value => recommend('id', value)),
            text('recommends.game.version', { label: 'Game version', hint: 'A range, like ^1', value: game.version }, value => recommend('version', value), true));
        rows.set('recommends.game', rows.get('recommends.game.id'));
        if (other && (other.id !== game.id || rangeOf(other.version) !== game.version)) {
            const use = () => commit([{ op: 'set', path: ['recommends'], value: { ...(isObject(doc.recommends) ? doc.recommends : {}), game: { id: other.id, version: rangeOf(other.version) || '^1' } } }]);
            recommends.push(h('div', { class: 'srow st-use-open' },
                h('span', { class: 'lb' }, h('b', `Use the open game: ${other.name ?? other.id}`), h('small', `${other.id} ${rangeOf(other.version) || '^1'}`)),
                h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-use-game', onClick: use }, 'Use it'))));
        }
    }
    return { rows, said, nodes: [said, ...pack, about, kindRow, ...needs, ...recommends] };
}

/**
 * `section`: `{ key, where: 'top', value, count }`; `ctx`: the editor context (views/route.js). The first of the pack's top-level fields
 * returns the whole form; the others return nothing and mark their problems on it. A format 3 pack (or one that cannot be edited) is read-only.
 */
// A read-only pack (format 3): its fields in words, in the mock's order (MK-9 "old"), drawn once by the first field's call; the format is
// in the subtitle, and what it needs reads as "suite ^2.0" rather than JSON.
const READ = [['name', 'Name'], ['id', 'Id'], ['version', 'Version'], ['author', 'Author'], ['description', 'Description'], ['requires', 'Needs'], ['recommends', 'Recommends']];
const words = value => (isObject(value) && Object.values(value).every(item => typeof item === 'string' || typeof item === 'number')
    ? Object.entries(value).map(([key, item]) => `${key} ${item}`).join(', ') : value);

function readOnly(section, doc) {
    if (!isObject(doc)) return [readRow(section.key, section.value)];
    if (section.key !== TOP.find(key => doc[key] !== undefined)) return [];
    return READ.filter(([key]) => doc[key] !== undefined).map(([key, label]) => readRow(label, words(doc[key])));
}

export function editSection(section, ctx) {
    const doc = ctx.doc?.doc ?? ctx.doc;
    if (ctx.legacy || typeof ctx.commit !== 'function' || !isObject(doc)) return readOnly(section, doc);
    const first = TOP.find(key => doc[key] !== undefined);
    if (section.key !== first && drawn.has(doc)) {
        showProblems(drawn.get(doc), ctx.problems);
        return [];
    }
    const made = form(doc, ctx);
    drawn.set(doc, made);
    showProblems(made, ctx.problems);
    return made.nodes;
}
