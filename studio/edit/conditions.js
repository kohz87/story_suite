// The job: the conditions form (views/route.js EDITORS). One card per condition: name, what it is about, how long it lasts, what it means, the
// Director and place-status switches, price and route effects, the "used by" lines (the events, templates, start and cast that set, clear or
// test it) and the JSON row. A rename goes through ST-REFS so every use follows; a condition that is used cannot be removed.

import { h } from '../../ui/kit/dom.js';
import { SCOPES } from '../../modules/world/chronicle/conditions/limits.js';
import { fieldRow, setProblem } from '../form/fields.js';
import { chipList } from '../form/list.js';
import { jsonRow, oddRecordCard } from '../views/json-row.js';
import { renderSection } from '../views/records.js';
import { usedBy } from '../model/refs.js';
import { renameId } from '../model/rename.js';

const PART_OF = { worldEvents: 'events', events: 'events', templates: 'templates', start: 'conditions', cast: 'cast', lore: 'lore' };
const PART_NAME = { events: 'Event', templates: 'Template', conditions: 'Start', cast: 'Person', lore: 'Lore' };
const GROUPS = [['set', 'Sets it'], ['clear', 'Clears it'], ['menu', 'Offered to the story'], ['test', 'Tests for it']];
const PRICE = /^(\S+)\s+(×\d+(?:\.\d+)?)$/;

const groupOf = role => (role === 'set' || role === 'clear' || role === 'menu' ? role : 'test');
const here = (ctx, key) => (ctx.problems ?? []).filter(problem => String(problem.path).startsWith(`content.conditions[${key.index}]`));

/** The uses of one condition, grouped: [[label, [{ rec, part, text }]]] with the empty groups left out. Each entry is one record, once. */
function usesOf(ctx, name) {
    const seen = new Set();
    const groups = new Map(GROUPS.map(([key]) => [key, []]));
    for (const use of usedBy(ctx.refs, 'condition', name)) {
        const part = PART_OF[use.owner?.part];
        const group = groups.get(groupOf(use.role));
        const tag = `${groupOf(use.role)}|${use.rec}`;
        if (!part || seen.has(tag)) continue;
        seen.add(tag);
        const index = use.owner.index;
        group.push({ rec: use.rec, part, text: `${PART_NAME[part]} · ${use.owner.id ?? (index === null ? use.owner.part : `#${index + 1}`)}`, dangling: use.dangling });
    }
    return GROUPS.map(([key, label]) => [label, groups.get(key)]).filter(([, list]) => list.length);
}

function usedNode(ctx, name) {
    const groups = usesOf(ctx, name);
    const body = groups.length
        ? groups.map(([label, list]) => h('div', { class: 'st-used-g' }, h('small', label),
            h('span', { class: 'chips3' }, list.map(item => h('button', { type: 'button', class: 'kc st-used', dataset: { rec: item.rec }, onClick: () => ctx.go(item.part, item.rec) }, item.text)))))
        : [h('small', { class: 'none' }, 'Nothing uses this condition yet.')];
    return h('div', { class: 'srow wide st-usedby', dataset: { key: 'used-by' } }, h('span', { class: 'lb' }, h('b', 'Used by'), h('small', 'Events, templates and the start that set, clear or test it')), h('span', { class: 'ctl' }, body));
}

const priceChips = prices => Object.entries(prices ?? {}).map(([category, factor]) => `${category} ${factor}`);

function effectsRows(record, put) {
    const prices = chipList({ key: 'effects.prices', label: 'Prices', hint: 'A goods category and a factor, like "food ×2"; "all" for everything', values: priceChips(record.effects?.prices), placeholder: 'food ×2', none: 'No price change' },
        (key, values) => {
            const bad = values.find(value => !PRICE.test(value.trim()) || !(Number(PRICE.exec(value.trim())?.[2].slice(1)) > 0));
            setProblem(prices, bad ? `"${bad}" is not a price effect: write a category and ×N with N above 0, like "food ×2".` : '');
            if (bad) return;
            put('prices', values.length ? Object.fromEntries(values.map(value => PRICE.exec(value.trim()).slice(1, 3))) : undefined);
        });
    const routes = fieldRow({ type: 'text', key: 'effects.routes', label: 'Routes', hint: '"blocked" or "×0.5 speed"; empty for no route effect', value: typeof record.effects?.routes === 'string' ? record.effects.routes : '' },
        (key, value) => put('routes', value.trim() === '' ? undefined : value.trim()));
    return [prices, routes];
}

function card(record, index, ctx) {
    const steps = ['content', 'conditions', index];
    const rec = `conditions.${index}`;
    const mine = here(ctx, { index });
    const problemFor = field => mine.find(item => item.path === `content.conditions[${index}].${field}` || String(item.path).startsWith(`content.conditions[${index}].${field}.`))?.message;
    const set = (field, value) => ctx.commit(value === undefined
        ? [{ op: 'remove', path: [...steps, field] }]
        : [{ op: 'set', path: [...steps, field], value }]);
    const put = (field, value) => {
        const effects = { ...(record.effects ?? {}) };
        if (value === undefined) delete effects[field]; else effects[field] = value;
        return set('effects', Object.keys(effects).length ? effects : undefined);
    };
    const rows = [];
    const nameRow = fieldRow({ type: 'text', key: 'name', label: 'Name', hint: 'Lower-case words joined by "-"; other records that use it follow a rename', value: record.name, problem: problemFor('name') }, (key, value) => {
        const next = value.trim();
        if (next === record.name) return;
        if (!next) { setProblem(nameRow, 'A condition needs a name.'); return; }
        // An unnamed condition is named with a plain set: nothing can name it yet, so there is nothing to rename.
        const done = ctx.refs && typeof record.name === 'string' && record.name ? renameId(ctx.refs, ctx.doc, 'condition', record.name, next) : { ok: true, patches: [{ op: 'set', path: [...steps, 'name'], value: next }], elsewhere: [] };
        if (!done.ok) { setProblem(nameRow, done.refusal); return; }
        ctx.commit(done.patches);
    });
    rows.push(nameRow,
        fieldRow({ type: 'select', key: 'scope', label: 'About', hint: 'What the condition is attached to', value: record.scope, options: [...SCOPES], problem: problemFor('scope') }, (key, value) => set('scope', value)),
        fieldRow({ type: 'text', key: 'fades', label: 'Lasts', hint: 'A time like "10 days" or "1 season"; empty means until cleared', value: record.fades ?? '', problem: problemFor('fades') }, (key, value) => set('fades', value.trim() === '' ? undefined : value.trim())),
        fieldRow({ type: 'long', key: 'means', label: 'Means', hint: 'One plain sentence of at most 300 characters', rows: 2, value: record.means, problem: problemFor('means') }, (key, value) => set('means', value)),
        fieldRow({ type: 'toggle', key: 'open', label: 'Story may set or clear it', hint: 'Through an open template\'s menu', value: record.open === true, problem: problemFor('open') }, (key, value) => set('open', value ? true : undefined)),
        fieldRow({ type: 'toggle', key: 'placeStatus', label: 'Show as the place\'s status', value: record.placeStatus === true, problem: problemFor('placeStatus') }, (key, value) => set('placeStatus', value ? true : undefined)),
        ...effectsRows(record, put),
        usedNode(ctx, record.name));
    return { rec, rows, steps, mine };
}

function recordNode(record, index, ctx, on) {
    const { rec, rows, steps, mine } = card(record, index, ctx);
    const used = usedBy(ctx.refs, 'condition', record.name).length;
    const node = h('section', { class: 'sgrp st-rec', dataset: { rec }, tabindex: '-1' },
        h('div', { class: 'gt' }, record.name ?? `#${index + 1}`, record.scope ? h('small', ` · ${record.scope}${record.fades ? ` · ${record.fades}` : ''}`) : null),
        rows,
        h('div', { class: 'srow subrow' }, h('span', { class: 'lb' }, h('b', 'Order')),
            h('span', { class: 'ctl' },
                h('button', { type: 'button', class: 'btn2 st-up', 'aria-label': `Move ${record.name} up`, disabled: index === 0, onClick: () => on.move(index, -1) }, '↑'),
                h('button', { type: 'button', class: 'btn2 st-down', 'aria-label': `Move ${record.name} down`, disabled: index === on.count - 1, onClick: () => on.move(index, 1) }, '↓'),
                h('button', { type: 'button', class: 'btn2 dng st-remove', 'aria-label': `Remove ${record.name}`, onClick: () => on.remove(index, used, node) }, '×'))));
    node.append(jsonRow({ value: record, steps, noun: 'condition', problems: mine, focus: ctx.focus?.rec === rec ? ctx.focus : null, state: ctx.keep(`json:${rec}`) }, patches => ctx.commit(patches)));
    if (ctx.focus?.rec === rec && ctx.focus.path?.length) {
        const control = node.querySelector(`[data-key="${ctx.focus.path[0]}"] input, [data-key="${ctx.focus.path[0]}"] select, [data-key="${ctx.focus.path[0]}"] textarea`);
        if (control) control.classList.add('st-at');
    }
    return node;
}

const freshName = list => {
    const taken = new Set(list.map(item => item?.name));
    let n = 1;
    while (taken.has(n === 1 ? 'new-condition' : `new-condition-${n}`)) n += 1;
    return n === 1 ? 'new-condition' : `new-condition-${n}`;
};

/** `section`: `{ key, where, value, count }`; `ctx`: the editor context (views/route.js). Returns the section's nodes. */
export function editSection(section, ctx) {
    const list = Array.isArray(section.value) ? section.value : [];
    if (ctx.legacy || typeof ctx.commit !== 'function' || typeof ctx.keep !== 'function' || !Array.isArray(section.value)) return [renderSection(section, ctx)];
    const on = {
        count: list.length,
        move: (at, step) => ctx.commit([{ op: 'move', path: ['content', 'conditions', at], to: at + step }]),
        remove: (at, used, node) => {
            if (used) { setProblem(node.querySelector('.subrow'), `Used in ${used} place${used === 1 ? '' : 's'}: take those out first.`); return; }
            ctx.commit([{ op: 'remove', path: ['content', 'conditions', at] }]);
        },
    };
    const add = () => ctx.commit([{ op: 'insert', path: ['content', 'conditions', list.length], value: { name: freshName(list), scope: 'region', fades: 'until cleared', means: '' } }]);
    return [h('div', { class: 'st-sec', dataset: { key: 'conditions' } },
        h('div', { class: 'secl2' }, `Conditions · ${list.length}`),
        h('div', { class: 'st-list' }, list.map((record, index) => (record !== null && typeof record === 'object' && !Array.isArray(record) ? recordNode(record, index, ctx, on)
            : oddRecordCard({ value: record, steps: ['content', 'conditions', index], rec: `conditions.${index}`, index, noun: 'condition', problems: here(ctx, { index }), state: ctx.keep?.(`json:conditions.${index}`) ?? {} }, patches => ctx.commit(patches))))),
        h('div', { class: 'addrow' }, h('button', { type: 'button', class: 'btn2 st-add', onClick: add }, '+ Add a condition')))];
}
