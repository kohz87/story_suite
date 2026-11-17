// Writes the card's collapsed one-line summary from a reply's digest.
import { STRINGS, fill } from '../../../../core/strings.js';
import { formatAmount } from '../../../../modules/inventory/money.js';
import { oneLine } from '../../../../core/text.js';
import { changesDigest } from './digest.js';

const T = STRINGS.summary;

// ---------------------------------------------------------------------------------------------------
// The one-line summary

const MAX_ITEMS = 3;

function itemList(entries, sign) {
    const shown = entries.slice(0, MAX_ITEMS).map(entry => `${sign}${entry.qty} ${entry.name}`);
    return entries.length > MAX_ITEMS ? [...shown, fill(T.more, { n: entries.length - MAX_ITEMS })] : shown;
}

function people(names) {
    if (names.length <= 1) return names.join('');
    if (names.length === 2) return fill(T.two, { a: names[0], b: names[1] });
    return fill(T.many, { first: names.slice(0, 2).join(', '), n: names.length - 2 });
}

/**
 * The card's collapsed one-line summary, in plain words: "+1 Moonveil Trout, −1 Rope · +30 gold ·
 * to Bluewatch Village · Fenna arrived", or "No changes" ("No item, coin or place changes" when only
 * another module's state moved). `currency` is `inventory.currency`'s
 * `{ name }` (default gold). `refused` is how many of the reply's change lines were not applied
 * (MODULES §F41): "… · 1 line not applied". `assisted` is how many lines the Assist safety net applied on the reply
 * (MODULES §F123): "… · 1 line from the safety net (assist)", so a folded card says so too (the lines are in its body). `lines`: the modules' own lines (replyCardLines), each told by its
 * `summary` (else its `text`) after the rest: "+1 Rope · AGI check 14 vs 10: success". Takes the same fields
 * as changesDigest, or a digest as `digest`. The reader's own edits are not in the line (they are in the opened card).
 */
export function changesSummary({ state = null, before = null, changes = [], currency = null, digest = null, refused = 0, assisted = 0, lines = [] } = {}) {
    const d = digest ?? changesDigest({ state, before, changes });
    // The currency word for an amount: its name for exactly 1, else its plural (MODULES §F1).
    const name = typeof currency?.name === 'string' && currency.name ? currency.name : T.defaultMoney;
    const plural = typeof currency?.plural === 'string' && currency.plural ? currency.plural : name;
    const money = n => (Math.abs(n) === 1 ? name : plural);
    // With coins (MODULES §F108) an amount is its mixed coins ("+3 silver 5 copper").
    const coined = Array.isArray(currency?.coins) && currency.coins.length > 0;
    const amount = n => (coined ? formatAmount(Math.abs(n), currency) : `${Math.abs(n)} ${money(n)}`);
    const parts = [];
    const items = [...itemList(d.gained, '+'), ...itemList(d.lost, '−')];
    if (items.length) parts.push(items.join(', '));
    if (d.held.length) parts.push(d.held.slice(0, MAX_ITEMS).map(entry => fill(T.held, { name: entry.name, qty: entry.qty })).join(', ')
        + (d.held.length > MAX_ITEMS ? fill(T.moreTail, { n: d.held.length - MAX_ITEMS }) : ''));
    if (d.coin !== null) parts.push(`${d.coin > 0 ? '+' : '−'}${amount(d.coin)}`);
    else if (d.coinNow !== null) parts.push(coined ? fill(T.coinNow, { n: formatAmount(d.coinNow, currency), money: '' }).replace(/\s{2,}/g, ' ').trim() : fill(T.coinNow, { n: d.coinNow, money: money(d.coinNow) }));
    if (d.place !== null) parts.push(d.place ? fill(T.to, { place: d.place }) : T.placeCleared);
    if (d.arrived.length) parts.push(fill(T.arrived, { names: people(d.arrived) }));
    if (d.left.length) parts.push(fill(T.left, { names: people(d.left) }));
    if (d.presentNow) parts.push(d.presentNow.length ? fill(T.here, { names: people(d.presentNow) }) : T.nobody);
    if (d.loot > 0) parts.push(d.loot === 1 ? T.lootOne : fill(T.lootMany, { n: d.loot }));
    for (const line of Array.isArray(lines) ? lines : []) {
        const told = oneLine(line?.summary || line?.text || '', 80);
        if (told) parts.push(told);
    }
    const helped = Number.isSafeInteger(assisted) && assisted > 0 ? assisted : 0;
    if (helped) parts.push(helped === 1 ? T.assistedOne : fill(T.assistedMany, { n: helped }));
    const count = Number.isSafeInteger(refused) && refused > 0 ? refused : 0;
    const notApplied = count === 0 ? null : count === 1 ? T.refusedOne : fill(T.refusedMany, { n: count });
    if (parts.length) return [...parts, ...(notApplied ? [notApplied] : [])].join(' · ');
    const nothing = d.other ? T.otherOnly : T.none;
    return notApplied ? `${nothing} · ${notApplied}` : nothing;
}
