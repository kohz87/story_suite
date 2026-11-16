// The reader taking picked things from a reply's offer.

import { isPlainObject } from '../../scene/domains/common.js';
import { formatAmount } from '../money.js';
import { MAX_UNSTACKED, featureOn, FEATURE } from '../state.js';
import { itemText } from '../validate.js';
import { currencyIn, defineByName, grantInto, receive, told } from '../stacks.js';
import { joinNames } from '../wear.js';
import { readerCarry } from '../lines.js';
import { LOOT_GUARD, LOOT_OWNER } from './guard-names.js';
import { LOOT_ITEMS } from './limits.js';
import { lootItems } from './offer-shape.js';
import { owned } from './shared-owned.js';

// `inventory.lootTake { sid, pick: [index…] }` (the reader's "Take selected" on the reply's card):
// once per reply's offer (claim `loot:<sid>`), the picked things the party does not carry yet go to the
// party's bag, as the offer held them. The reader's own take: past the carry limit it is refused.
// The take is a guarded block (REPLAY.md, predicate `loot.take`): what a reply laid out goes away with it, so
// the take applies, with its claim, only while that reply's offer still lays out what was taken (lootTakeGuard).
export function lootTake(ctx, payload, env) {
    if (!featureOn(ctx, FEATURE.loot)) ctx.fail('FEATURE_OFF', 'Loot to pick from is turned off in the Features.');
    const inv = ctx.draft('inventory');
    const sid = payload.sid;
    const offer = typeof sid === 'string' && isPlainObject(inv.loot) && Object.hasOwn(inv.loot, sid) && isPlainObject(inv.loot[sid]) ? inv.loot[sid] : null;
    if (!offer) ctx.fail('NOT_FOUND', 'That loot is no longer there to take.');
    const things = lootItems(offer) ?? [];
    const picks = Array.isArray(payload.pick) ? payload.pick.map(at => (typeof at === 'string' && /^\d+$/.test(at) ? Number(at) : at)) : [];
    if (!picks.length || picks.length > LOOT_ITEMS || picks.some(at => !Number.isSafeInteger(at) || at < 0 || at >= things.length)) {
        ctx.fail('INVALID', 'Pick at least one of the things on offer to take.');
    }
    if (!ctx.claim(offer.claim || `loot:${sid}`)) ctx.fail('REFUSED', 'That loot has already been taken: each reply\'s loot is taken once.');
    const skipped = [];
    const wanted = [];
    const over = [];
    let coin = 0;
    for (const at of [...new Set(picks)].sort((a, b) => a - b)) {
        const item = things[at];
        if (item.coin !== undefined) { coin += item.coin; continue; }
        if (owned(inv, item.name)) { skipped.push(item.name); continue; }
        const { def, created } = defineByName(ctx, inv, item.name, env, { owner: 'party' });
        // The offer was held to what one grant can give as it read the item then; a pack enabled since (or an
        // offer an older version saved) can make it a thing that does not stack: what fits is taken, the rest stays.
        const qty = def.stack ? item.qty : Math.min(item.qty, MAX_UNSTACKED);
        if (qty < item.qty) over.push({ name: def.name, qty: item.qty - qty });
        wanted.push({ def, qty, created, offered: item.name });
    }
    if (!wanted.length && !coin) ctx.fail('REFUSED', `${joinNames(skipped)} ${skipped.length === 1 ? 'is' : 'are'} already carried.`);
    if (wanted.length) readerCarry(ctx, wanted.map(entry => ({ defId: entry.def.id, qty: entry.qty })), 'party');
    // What the take needs of the offer, decided now and kept on the block: the offer's names and how many of each were taken.
    const predicate = { kind: LOOT_GUARD, sid, claim: offer.claim || `loot:${sid}`, items: wanted.map(entry => ({ name: entry.offered, qty: entry.qty })), coin };
    ctx.replayGuard({ owner: LOOT_OWNER, version: 2, epoch: ctx.epoch, rulesHash: null, inputHash: ctx.hash(predicate), predicate });
    // FB-2: what the story offered is the story's own (`story: true`, as a `+ item` line's), whatever its
    // def (a pack's item named in the `? loot` line).
    const stacks = wanted.flatMap(entry => grantInto(ctx, inv, entry.def, entry.qty, 'party', '', false, true));
    // The money was counted for its reply when the loot was read: it is paid as offered.
    const currency = currencyIn(ctx);
    if (coin) receive(ctx, env, { owner: 'party', amount: coin, note: 'loot' });
    const where = offer.where ? ` (${offer.where})` : '';
    const left = skipped.length ? `; ${joinNames(skipped)} ${skipped.length === 1 ? 'is' : 'are'} already carried` : '';
    const took = [...wanted.map(entry => itemText(entry.def.name, entry.qty)), ...(coin ? [formatAmount(coin, currency)] : [])];
    const behind = over.length ? ` ${joinNames(over.map(entry => itemText(entry.name, entry.qty)))} ${over.length === 1 && over[0].qty === 1 ? 'is' : 'are'} left where ${over.length === 1 ? 'it' : 'they'} lay: a thing that does not stack is given at most ${MAX_UNSTACKED} at once.` : '';
    return {
        summary: `The party takes ${joinNames(took)}${where}${left}.${behind}`,
        data: { sid, taken: wanted.map(entry => ({ def: entry.def.id, qty: entry.qty })), coin, skipped, stacks, ...(over.length ? { left: over } : {}),
            v2: { result: { taken: predicate.items, coin } } },
        narrate: told(ctx),
        ...(behind ? { problem: behind.trim() } : {}),
    };
}
