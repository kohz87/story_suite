// The job: the game pack's start editor (views/route.js EDITORS: game `start`; mock MK-7 "Start"). The purse is the player's money in the
// smallest coin, with what it comes to in this pack's coins; the items are a list of names, each with a quantity and a note, that a chat
// matches to the world's items by name when it starts (or makes up). Rows move, are removed and are added (at most GAME_START_LIMITS.items);
// with a world open, a name that is not one of its items says so, and "From the world…" adds one of its items by name.

import { h } from '../../ui/kit/dom.js';
import { GAME_START_LIMITS as L } from '../../packs/limits.js';
import { foldKey } from '../../core/text.js';
import { fieldRow, setProblem } from '../form/fields.js';
import { openPicker } from '../form/pick.js';
import { renderSection } from '../views/records.js';

const BASE = ['content', 'start'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const contentOf = doc => (isObject(doc?.doc?.content) ? doc.doc.content : isObject(doc?.content) ? doc.content : {});
const said = result => (result?.ok ? '' : result?.refusal ?? 'The change was not made.');
const coinName = (coin, n) => (n === 1 ? coin.name : coin.plural ?? coin.name);

// The pack's coins, largest first, from content.currency (valued in the smallest coin); [] when the pack sets no money.
function coinsOf(content) {
    const currency = isObject(content.currency) ? content.currency : {};
    const coins = (Array.isArray(currency.coins) ? currency.coins : []).filter(coin => isObject(coin) && typeof coin.name === 'string' && Number.isInteger(coin.value) && coin.value > 0);
    if (!coins.length && typeof currency.name === 'string') coins.push({ name: currency.name, plural: currency.plural, value: 1 });
    return coins.sort((a, b) => b.value - a.value);
}

// "40 copper = 4 silver": the amount in the smallest coin, then in the fewest coins (left out when that is the same thing).
function moneyHint(money, coins) {
    const base = 'What the player starts with';
    const smallest = coins.at(-1);
    if (!smallest) return `${base}, in the smallest coin of the game's money. Blank: none`;
    const head = `${base}, in ${coinName(smallest, 2)} (the smallest coin)`;
    if (!Number.isInteger(money) || money <= 0) return `${head}. Blank: none`;
    let left = money;
    const parts = [];
    for (const coin of coins) {
        const n = Math.floor(left / coin.value);
        if (n) parts.push(`${n} ${coinName(coin, n)}`);
        left -= n * coin.value;
    }
    const whole = `${money} ${coinName(smallest, money)}`;
    return parts.length === 1 && parts[0] === whole ? head : `${head}: ${whole} = ${parts.join(' ')}`;
}

// The open world's item names (and other names), folded, and the items for the picker; null when no world is open.
function worldItems(ctx) {
    if (!ctx.other) return null;
    const list = (Array.isArray(contentOf(ctx.other).items) ? contentOf(ctx.other).items : []).filter(item => isObject(item) && typeof item.name === 'string' && item.name.trim());
    const names = new Set(list.flatMap(item => [item.name, ...(Array.isArray(item.aliases) ? item.aliases : [])]).map(foldKey));
    return { list, names };
}

function purse(start, ctx, coins) {
    const row = fieldRow({ type: 'number', key: 'money', label: 'Money', hint: moneyHint(start.money, coins), value: start.money, unit: coins.at(-1) ? coinName(coins.at(-1), 2) : undefined,
        problem: (ctx.problems ?? []).find(item => item.path === 'content.start.money')?.message }, (key, value) => {
        if (value === null) return Object.hasOwn(start, 'money') ? setProblem(row, said(ctx.commit([{ op: 'remove', path: [...BASE, 'money'] }]))) : undefined;
        if (!Number.isInteger(value) || value < 0 || value > L.money) return setProblem(row, `A whole number from 0 to ${L.money}.`);
        setProblem(row, said(ctx.commit([{ op: 'set', path: [...BASE, 'money'], value }])));
    });
    return h('section', { class: 'sgrp st-purse' }, h('div', { class: 'gt' }, 'Purse'), row);
}

function itemRow(entry, index, items, ctx, world) {
    const steps = [...BASE, 'items', index];
    const here = `content.start.items[${index}]`;
    const problem = (ctx.problems ?? []).find(item => item.path === here || String(item.path).startsWith(`${here}.`))?.message;
    const label = typeof entry.name === 'string' && entry.name ? entry.name : `Item ${index + 1}`;
    const set = (field, value) => setProblem(row, said(ctx.commit([value === undefined ? { op: 'remove', path: [...steps, field] } : { op: 'set', path: [...steps, field], value }])));
    const move = step => setProblem(row, said(ctx.commit([{ op: 'move', path: steps, to: index + step }])));
    const name = h('input', { type: 'text', class: 'txt2 st-iname', placeholder: 'An item name', 'aria-label': `Item ${index + 1}` });
    name.value = entry.name ?? '';
    const qty = h('input', { type: 'number', value: entry.qty ?? 1, 'aria-label': `How many ${label}` });
    const note = h('input', { type: 'text', class: 'txt2 st-inote', placeholder: 'Blank: none', 'aria-label': `Note on ${label}` });
    note.value = entry.note ?? '';
    const known = world && typeof entry.name === 'string' && entry.name.trim() ? world.names.has(foldKey(entry.name)) : true;
    const row = h('div', { class: 'srow subrow st-item', dataset: { index: String(index) } },
        h('span', { class: 'lb' }, h('small', String(index + 1)), name,
            known ? null : h('small', { class: 'st-unmatched' }, 'Not one of the open world\'s items: a chat makes it up')),
        h('span', { class: 'ctl' }, h('span', { class: 'num' }, h('span', 'Qty'), qty), note,
            h('button', { type: 'button', class: 'btn2 st-up', 'aria-label': `Move ${label} up`, disabled: index === 0, onClick: () => move(-1) }, '↑'),
            h('button', { type: 'button', class: 'btn2 st-down', 'aria-label': `Move ${label} down`, disabled: index === items.length - 1, onClick: () => move(1) }, '↓'),
            h('button', { type: 'button', class: 'btn2 dng st-remove', 'aria-label': `Remove ${label}`, onClick: () => setProblem(row, said(ctx.commit([{ op: 'remove', path: steps }]))) }, '×')));
    name.addEventListener('change', () => {
        const text = name.value.replace(/\s+/g, ' ').trim();
        if (!text || text.length > L.name) return setProblem(row, `An item's name is 1 to ${L.name} characters.`);
        if (items.some((other, at) => at !== index && isObject(other) && foldKey(other.name) === foldKey(text))) return setProblem(row, `"${text}" is already in the list.`);
        if (text !== entry.name) set('name', text);
    });
    qty.addEventListener('change', () => {
        const text = String(qty.value).trim();
        const n = Number(text);
        if (!text) return Object.hasOwn(entry, 'qty') ? set('qty', undefined) : undefined;
        if (!Number.isInteger(n) || n < 1 || n > L.qty) return setProblem(row, `How many: a whole number from 1 to ${L.qty}.`);
        if (n !== entry.qty) set('qty', n);
    });
    note.addEventListener('change', () => {
        const text = note.value.trim();
        if (text.length > L.note) return setProblem(row, `A note is at most ${L.note} characters (this is ${text.length}).`);
        if (!text) return Object.hasOwn(entry, 'note') ? set('note', undefined) : undefined;
        if (text !== entry.note) set('note', text);
    });
    return setProblem(row, problem);
}

function itemGroup(start, ctx) {
    const items = Array.isArray(start.items) ? start.items : [];
    const world = worldItems(ctx);
    const full = items.length >= L.items;
    const taken = new Set(items.filter(isObject).map(entry => foldKey(entry.name)));
    const add = text => ctx.commit(Array.isArray(start.items)
        ? [{ op: 'insert', path: [...BASE, 'items', items.length], value: { name: text } }]
        : [{ op: 'set', path: [...BASE, 'items'], value: [{ name: text }] }]);
    const fresh = () => { let text = 'New item'; for (let n = 2; taken.has(foldKey(text)); n++) text = `New item ${n}`; return text; };
    const pick = () => openPicker({}, { title: 'Add one of the world\'s items', items: world.list.map(item => ({ id: item.name, label: item.name, sub: [item.kind, item.id].filter(Boolean).join(' · '),
        ...(taken.has(foldKey(item.name)) ? { disabled: true, tag: 'listed' } : {}) })) }, add);
    const whole = (ctx.problems ?? []).find(item => item.path === 'content.start.items')?.message;
    return h('section', { class: 'sgrp st-items' }, h('div', { class: 'gt' }, `Items · ${items.length}`),
        whole ? h('p', { class: 'st-problem', role: 'alert' }, whole) : null,
        items.length ? items.map((entry, index) => (isObject(entry) ? itemRow(entry, index, items, ctx, world) : null)) : h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('small', { class: 'none' }, 'The player starts with no items.'))),
        h('div', { class: 'addrow' },
            h('button', { type: 'button', class: 'btn2 st-add', disabled: full, onClick: () => add(fresh()) }, '+ Add an item'),
            world?.list.length ? h('button', { type: 'button', class: 'btn2 st-from-world', disabled: full, onClick: pick }, 'From the world…') : null,
            h('small', { class: 'fine' }, `${items.length} of ${L.items} · matched to the world's items by name when a chat starts`)));
}

/** `section`: `{ key: 'start', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the purse and the items, or the
 * read-only cards for a format 3 pack and a start that is not an object (or whose items are not a list). */
export function editSection(section, ctx) {
    const start = section.value;
    if (ctx.legacy || typeof ctx.commit !== 'function' || !isObject(start) || (start.items !== undefined && !Array.isArray(start.items))) return [renderSection(section, ctx)];
    const coins = coinsOf(contentOf(ctx.doc));
    return [h('div', { class: 'st-sec', dataset: { key: 'start' } }, h('div', { class: 'secl2' }, 'Start · what the player starts with'), purse(start, ctx, coins), itemGroup(start, ctx))];
}
