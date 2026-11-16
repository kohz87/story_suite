// Reading a `? loot` line and laying the offer out on the reply.

import { isPlainObject, clone } from '../../common.js';
import { cleanName, resolveDef, aliasKey, trimText } from '../../names.js';
import { isCurrencyName, coinValue, formatAmount } from '../../money.js';
import { MAX_NAME, featureOn, FEATURE } from '../state.js';
import { itemText } from '../validate.js';
import { currencyIn, defineByName } from '../stacks.js';
import { lineQty, storyCoin, storyItems } from '../lines.js';
import { LOOT_OFFER, LOOT_OWNER } from './guard-names.js';
import { LOOT_ITEMS, LOOT_KEEP, MAX_WHERE } from './limits.js';
import { lootItems } from './offer-shape.js';
import { owned } from './shared-owned.js';

// "Lantern Oil x2", "Lantern Oil ×2" → { name, qty }: a count of any length is a count, never part of
// the name); without one, `fallback`. Money ("1000 gold", "Gold x500",
// "gold") → { money: amount }.
function lootPart(text, fallback, currency) {
    const counted = /^(.*?)\s*[x×]\s*(\d+)$/i.exec(text);
    const number = digits => Math.min(Number(digits), Number.MAX_SAFE_INTEGER);
    const { name, qty } = counted && counted[1].trim() ? { name: counted[1].trim(), qty: number(counted[2]) } : { name: text, qty: fallback };
    // A coin's name counts in the smallest unit: "3 silver" is 30 when silver is worth 10 (money.js coinValue).
    if (isCurrencyName(cleanName(name), currency)) return { name, money: number(qty * coinValue(cleanName(name), currency)) };
    const leading = /^(\d[\d,]*)\s+(.+)$/.exec(name);
    if (leading && isCurrencyName(cleanName(leading[2]), currency)) return { name: leading[2], money: number(Number(leading[1].replace(/,/g, '')) * coinValue(cleanName(leading[2]), currency)) };
    return { name, qty };
}

/** `? loot A, B x2, C — where | qty: n` (see above). */
export function captureLoot(ctx, line, env) {
    if (!featureOn(ctx, FEATURE.loot)) ctx.fail('FEATURE_OFF', 'Loot to pick from is turned off in the Features.');
    if (line?.op !== '?') ctx.fail('INVALID', `"${line?.op} loot" is not a change the inventory understands; write ? loot Thing, Other Thing — where it lies.`);
    const sid = ctx.carrier?.sid;
    if (ctx.cause !== 'story' || typeof sid !== 'string' || !sid) ctx.fail('REFUSED', 'Loot is laid out by a reply\'s change lines only.');
    const inv = ctx.draft('inventory');
    const fallback = lineQty(ctx, line, 1);
    if (fallback < 1) ctx.fail('INVALID', 'A quantity of loot must be at least 1.');
    const parts = String(line.name ?? '').split(/[,;]/).map(part => part.trim()).filter(Boolean);
    if (!parts.length) ctx.fail('INVALID', 'A loot line needs the things that lie there: ? loot Rusty Key, Lantern Oil — where.');
    const before = isPlainObject(inv.loot) && isPlainObject(inv.loot[sid]) ? inv.loot[sid] : null;
    const items = before ? clone(lootItems(before) ?? []) : [];
    const notes = [];
    const currency = currencyIn(ctx);
    // New definitions are worked out on a copy; the real ones are made only for what the reader takes.
    const scratch = { ...inv, defs: { ...inv.defs }, aliases: { ...inv.aliases } };
    for (const part of parts) {
        const { name: written, qty, money } = lootPart(part, fallback, currency);
        const name = cleanName(written);
        if (!name) continue;
        // Money in a loot line is a coin offer in that loot, counted for the reply now (as a
        // `+ coin` line would be) and paid into the wallet on Take: never an item, never left out unsaid.
        if (money !== undefined) {
            const purse = items.find(item => item.coin !== undefined);
            if (!purse && items.length >= LOOT_ITEMS) {
                notes.push(`One reply may lay out at most ${LOOT_ITEMS} things to pick from; ${formatAmount(money, currency)} was left out.`);
                continue;
            }
            if (money < 1) { notes.push(`${name}: an amount of money is more than nothing.`); continue; }
            const held = storyCoin(ctx, inv, money);
            if (purse) {
                purse.coin += held.amount;
                purse.name = formatAmount(purse.coin, currency);
            } else items.push({ name: formatAmount(held.amount, currency), qty: 1, coin: held.amount });
            continue;
        }
        if (items.length >= LOOT_ITEMS) {
            notes.push(`One reply may lay out at most ${LOOT_ITEMS} things to pick from; ${name} and the rest were left out.`);
            break;
        }
        if (name.length > MAX_NAME) { notes.push(`An item needs a name of 1 to ${MAX_NAME} characters; one was left out.`); continue; }
        if (owned(inv, name)) { notes.push(`${name} is already carried, so it is not offered.`); continue; }
        if (qty < 1) { notes.push(`${name}: a quantity of loot is at least 1.`); continue; }
        let held;
        let def;
        try {
            ({ def } = defineByName(ctx, scratch, name, env, { owner: 'party' }, false));
            if (items.some(item => aliasKey(item.name) === aliasKey(def.name) || resolveDef(scratch, item.name).id === def.id)) { notes.push(`${def.name} is offered once.`); continue; }
            held = storyItems(def, qty, false, 'offered');
        } catch (error) {
            if (typeof error?.code !== 'string') throw error;
            notes.push(error.message);
            continue;
        }
        items.push({ name: def.name, qty: held.qty });
        if (held.problem) notes.push(held.problem);
    }
    if (JSON.stringify(items) === JSON.stringify(lootItems(before) ?? [])) ctx.fail('REFUSED', notes.join(' ') || 'There is nothing in that loot to pick up.');
    if (!isPlainObject(inv.loot)) inv.loot = {};
    const others = Object.keys(inv.loot).filter(key => key !== sid)
        .sort((a, b) => (inv.loot[b]?.n ?? 0) - (inv.loot[a]?.n ?? 0) || (a < b ? -1 : 1));
    for (const key of others.slice(LOOT_KEEP - 1)) delete inv.loot[key];
    const here = trimText(line.text ?? '', MAX_WHERE);
    const where = before && before.where !== here ? trimText([before.where, here].filter(Boolean).join('; '), MAX_WHERE) : here;
    inv.loot[sid] = { sid, n: Number.isSafeInteger(ctx.rev) ? ctx.rev : 0, where, claim: `loot:${sid}`, items: { ...items } };
    // The offer is the reply's own (REPLAY.md "Reply-bound guards"): it goes with its reply, also when deleting the earliest
    // replies carries the rest of what they did forward, and a take of it (lootTakeGuard) goes with it.
    const offered = { kind: LOOT_OFFER, sid };
    ctx.replayGuard({ owner: LOOT_OWNER, version: 2, epoch: ctx.epoch, rulesHash: null, inputHash: ctx.hash(offered), predicate: offered, replyBound: true });
    const list = items.map(item => itemText(item.name, item.qty));
    return {
        summary: `Loot to pick from${where ? ` (${where})` : ''}: ${list.join(', ')}. The reader picks what to take (this reply's card, or To pick up in the Inventory).`,
        data: { sid, where, items: clone(items) },
        narrate: false,
        ...(notes.length ? { problem: notes.join(' ') } : {}),
    };
}
