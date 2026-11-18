// The job: the game pack's Money part (views/route.js EDITORS; mock MK-7 "Money"): the currency (name, plural, short), its coins as a row
// table (coin, plural, worth in the coin worth 1; the list keeps itself in order of worth, so rows have no move buttons; each row says
// what the checker would refuse in it), and the prices card (the economy scale and its note). A part the pack leaves out is a "Not set"
// card with Set it here. The checker's problems show under their fields. Every change is one commit.

import { h } from '../../ui/kit/dom.js';
import { ECONOMY_FIELDS, ECONOMY_LIMITS } from '../../packs/limits.js';
import { MAX_COINS, MAX_COIN_VALUE } from '../../modules/inventory/money.js';
import { foldKey } from '../../core/text.js';
import { fieldRow, setProblem } from '../form/fields.js';
import { rowTable } from '../form/table.js';
import { renderSection } from '../views/records.js';

const CURRENCY = ['content', 'currency'];
const ECONOMY = ['content', 'economy'];
const BAD_NAME = /[\d|:#<>/]/;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const problemAt = (ctx, path) => (ctx.problems ?? []).find(problem => problem.path === path)?.message ?? '';

// One change: `undefined` takes the key out.
const change = (ctx, path, value) => ctx.commit([value === undefined ? { op: 'remove', path } : { op: 'set', path, value }]);

// What the checker would refuse in one coin, in words, and which cells it is about.
function coinProblem(coin, at, coins) {
    const name = typeof coin?.name === 'string' ? coin.name.trim() : '';
    if (!name) return { text: 'A coin needs a name.', bad: ['name'] };
    if (name.length > 24) return { text: 'A coin\'s name is at most 24 characters.', bad: ['name'] };
    if (BAD_NAME.test(name)) return { text: 'A coin\'s name can\'t hold digits or | : # < > /.', bad: ['name'] };
    if (coins.findIndex(other => foldKey(other?.name ?? '') === foldKey(name)) !== at) return { text: `Another coin is called ${name}: each name once.`, bad: ['name'] };
    if (coin.plural !== undefined && (typeof coin.plural !== 'string' || !coin.plural.trim() || coin.plural.length > 24)) return { text: 'A plural is 1 to 24 characters; blank uses the name.', bad: ['plural'] };
    if (!Number.isSafeInteger(coin.value) || coin.value < 1 || coin.value > MAX_COIN_VALUE) return { text: `Worth is a whole number from 1 to ${MAX_COIN_VALUE.toLocaleString('en')}.`, bad: ['value'] };
    return null;
}

// "1 gold = 10 silver = 100 copper": the dearest coin in each cheaper one it divides evenly.
function ladder(coins) {
    const good = coins.filter(coin => typeof coin?.name === 'string' && Number.isSafeInteger(coin.value) && coin.value >= 1).sort((a, b) => b.value - a.value);
    if (good.length < 2) return '';
    const top = good[0];
    return [`1 ${top.name}`, ...good.slice(1).filter(coin => top.value % coin.value === 0).map(coin => `${top.value / coin.value} ${top.value / coin.value === 1 ? coin.name : (coin.plural || coin.name)}`)].join(' = ');
}

// A name no coin has yet: "new coin", then "new coin b", "new coin c"…
function freshName(coins) {
    const taken = new Set(coins.map(coin => foldKey(coin?.name ?? '')));
    for (let n = 0; ; n += 1) { const name = n ? `new coin ${String.fromCharCode(97 + n)}` : 'new coin'; if (!taken.has(foldKey(name))) return name; }
}

function coinsTable(currency, ctx) {
    const coins = Array.isArray(currency.coins) ? currency.coins : [];
    const base = coins.find(coin => coin?.value === 1)?.name ?? currency.name ?? 'the smallest coin';
    const byWorth = list => list.map((coin, at) => ({ coin, at })).sort((a, b) => (Number(a.coin?.value) || 0) - (Number(b.coin?.value) || 0) || a.at - b.at).map(item => item.coin);
    const put = list => change(ctx, [...CURRENCY, 'coins'], list.length ? list : undefined);
    const rows = coins.map((coin, at) => {
        const found = coinProblem(coin, at, coins);
        return { values: { name: coin?.name ?? '', plural: coin?.plural ?? '', value: coin?.value ?? null }, problem: found?.text ?? null, bad: found?.bad ?? [] };
    });
    const whole = problemAt(ctx, 'content.currency.coins');
    const shown = rows.some(row => row.problem) ? '' : whole;
    const table = rowTable({
        key: 'coins', title: 'Coins', noun: 'coin', move: false, max: MAX_COINS, addLabel: '+ Add a coin',
        note: `Worth is counted in the coin worth 1, here ${base}. The list sorts itself by worth, so coins have no move buttons.`,
        empty: `No coins: amounts are written as a number of ${currency.plural || currency.name || 'the money'}. Add a coin to name them.`,
        foot: [`${coins.length} of ${MAX_COINS} coins`, ladder(coins)].filter(Boolean).join(' · '),
        columns: [
            { key: 'name', label: 'Coin', type: 'text', max: 24 },
            { key: 'plural', label: 'Plural', type: 'text', placeholder: 'Blank: the name', max: 24 },
            { key: 'value', label: 'Worth', type: 'number', min: 1, max: MAX_COIN_VALUE, step: 1, unit: base },
        ],
        rows,
    }, {
        change: (at, col, value) => {
            const next = coins.map(coin => ({ ...coin }));
            if (col === 'value') { if (value === null) return; next[at].value = value; return put(byWorth(next)); }
            const text = String(value ?? '').trim();
            if (text === (coins[at]?.[col] ?? '')) return;
            if (col === 'plural' && !text) delete next[at].plural; else next[at][col] = text;
            return put(next);
        },
        add: () => {
            const dearest = Math.max(0, ...coins.map(coin => Number(coin?.value) || 0));
            const coin = coins.length ? { name: freshName(coins), value: Math.min(Math.max(dearest * 10, 1), MAX_COIN_VALUE) } : { name: currency.name ?? 'coin', value: 1 };
            return put(byWorth([...coins.map(item => ({ ...item })), coin]));
        },
        remove: at => put(coins.filter((_, i) => i !== at)),
    });
    if (shown) table.append(h('small', { class: 'st-problem', role: 'alert' }, shown));
    return table;
}

function currencyNodes(currency, ctx) {
    const text = (key, label, hint, max, required = false) => {
        const row = fieldRow({ type: 'text', key, label, hint, value: currency[key] ?? '', size: 'short', problem: key === 'name' ? (problemAt(ctx, 'content.currency') || problemAt(ctx, 'content.currency.name')) : problemAt(ctx, `content.currency.${key}`) }, (_, value) => {
            const next = String(value ?? '').trim();
            if (!next && required) { setProblem(row, `${label} is needed: the money has a name.`); return; }
            if (next.length > max) { setProblem(row, `${label} is at most ${max} characters.`); return; }
            if (!next) { if (Object.hasOwn(currency, key)) change(ctx, [...CURRENCY, key], undefined); return; }
            if (next !== currency[key]) change(ctx, [...CURRENCY, key], next);
        });
        return row;
    };
    return [h('section', { class: 'sgrp st-currency' }, h('div', { class: 'gt' }, 'Currency'),
        text('name', 'Name', 'The money\'s name, used when the reader has not named one', 24, true),
        text('plural', 'Plural', 'Blank: the name', 24),
        text('short', 'Short', 'Up to 8 characters, after a number: "40 c"', 8)),
    coinsTable(currency, ctx)];
}

function economyNode(economy, ctx) {
    const scale = fieldRow({ type: 'number', key: 'scale', label: 'Price scale', hint: 'Multiplies the built-in prices: 0.01 for a world a hundred times poorer. Blank: 1', value: economy.scale ?? null, unit: '×', problem: problemAt(ctx, 'content.economy.scale') }, (_, value) => {
        if (value === null) { if (Object.hasOwn(economy, 'scale')) change(ctx, [...ECONOMY, 'scale'], undefined); return; }
        if (!(value >= ECONOMY_LIMITS.min && value <= ECONOMY_LIMITS.max)) { setProblem(scale, `The scale runs from ${ECONOMY_LIMITS.min} to ${ECONOMY_LIMITS.max} (1 leaves the prices as they are).`); return; }
        change(ctx, [...ECONOMY, 'scale'], value);
    });
    const note = fieldRow({ type: 'long', key: 'note', label: 'Note', hint: `What the scale means, for the reader (at most ${ECONOMY_LIMITS.note} characters)`, rows: 2, value: economy.note ?? '', problem: problemAt(ctx, 'content.economy.note') }, (_, value) => {
        const next = String(value ?? '').trim();
        if (next.length > ECONOMY_LIMITS.note) { setProblem(note, `The note is at most ${ECONOMY_LIMITS.note} characters.`); return; }
        if (!next) { if (Object.hasOwn(economy, 'note')) change(ctx, [...ECONOMY, 'note'], undefined); return; }
        if (next !== economy.note) change(ctx, [...ECONOMY, 'note'], next);
    });
    const stray = Object.keys(economy).filter(key => !ECONOMY_FIELDS.includes(key)).map(key => h('div', { class: 'srow', dataset: { key } },
        h('span', { class: 'lb' }, h('b', key), h('small', 'Not a prices field: the pack checker takes only the scale and the note.')),
        h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 dng st-dropkey', onClick: () => change(ctx, [...ECONOMY, key], undefined) }, 'Remove'))));
    return h('section', { class: 'sgrp st-economy' }, h('div', { class: 'gt' }, 'Prices'), scale, note, stray);
}

// A Money section the pack leaves out: the Built-in game's, with Set it here.
function notSet(title, said, ctx, path, value) {
    return h('section', { class: 'sgrp st-notset', dataset: { key: path.at(-1) } }, h('div', { class: 'gt' }, title),
        h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('b', 'Not set: the Built-in game\'s'), h('small', said)),
            h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 pri st-setit', onClick: () => change(ctx, path, value) }, 'Set it here'))));
}

/** `section`: `{ key: 'currency' | 'economy', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the section's cards. */
export function editSection(section, ctx) {
    if (ctx.legacy || ctx.kind !== 'game' || typeof ctx.commit !== 'function' || !isObject(section.value) || section.where !== 'content') return [renderSection(section, ctx)];
    const content = ctx.doc?.content ?? {};
    if (section.key === 'economy') {
        const before = content.currency === undefined ? [notSet('Currency', 'Amounts are plain numbers, with the reader\'s own money name if they gave one.', ctx, CURRENCY, { name: 'coin' })] : [];
        return [...before, economyNode(section.value, ctx)];
    }
    const after = content.economy === undefined ? [notSet('Prices', 'The built-in prices, as they are (a scale of 1).', ctx, ECONOMY, { scale: 1 })] : [];
    return [...currencyNodes(section.value, ctx), ...after];
}
