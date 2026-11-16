// The replay guard of the loot blocks: whether the offer still holds what a take took.

import { isPlainObject } from '../../scene/domains/common.js';
import { resolveDef, aliasKey } from '../../scene/names.js';
import { nonBlank, isCount } from '../state.js';
import { itemText } from '../validate.js';
import { joinNames } from '../wear.js';
import { LOOT_GUARD, LOOT_OFFER, LOOT_OWNER } from './guard-names.js';
import { lootItems } from './offer-shape.js';

// The taken things (`wanted`, [{ name, qty }]) the offer's things no longer lay out: for each, the one thing of the offer its
// name means by the inventory's own lookup (an offer as a slice of defs keyed by position, each named and aliased by its own
// name), with at least as many; a name that means none, or more than one, or a thing an earlier taken name took, is gone.
function offeredFor(things, wanted) {
    const defs = {};
    const aliases = {};
    things.forEach((item, at) => {
        if (!isPlainObject(item) || item.coin !== undefined || !nonBlank(item.name)) return;
        defs[String(at)] = { name: item.name };
        aliases[aliasKey(item.name)] ??= String(at);
    });
    const used = new Set();
    return wanted.filter(want => {
        const found = resolveDef({ defs, aliases }, want.name);
        if (found.status !== 'found' || used.has(found.id)) return true;
        used.add(found.id);
        const qty = things[Number(found.id)].qty;
        return !(Number.isSafeInteger(qty) && qty >= want.qty);
    });
}
export function lootTakeGuard({ state, hash }, { guard }) {
    const predicate = guard?.predicate;
    const damaged = { ok: false, reason: 'its loot guard is damaged' };
    if (predicate?.kind === LOOT_OFFER) {
        return guard.owner === LOOT_OWNER && guard.version === 2 && guard.replyBound === true && typeof predicate.sid === 'string'
            && Object.keys(predicate).length === 2 && hash(predicate) === guard.inputHash ? { ok: true } : damaged;
    }
    if (guard?.owner !== LOOT_OWNER || guard.version !== 2 || !isPlainObject(predicate) || predicate.kind !== LOOT_GUARD
        || typeof predicate.sid !== 'string' || typeof predicate.claim !== 'string' || !isCount(predicate.coin, 0)
        || !Array.isArray(predicate.items) || predicate.items.some(item => !isPlainObject(item) || !nonBlank(item.name) || !isCount(item.qty, 1))) return damaged;
    if (hash(predicate) !== guard.inputHash) return damaged;
    const loot = state?.domains?.inventory?.loot;
    const offer = isPlainObject(loot) && Object.hasOwn(loot, predicate.sid) && isPlainObject(loot[predicate.sid]) ? loot[predicate.sid] : null;
    if (!offer || (offer.claim || `loot:${predicate.sid}`) !== predicate.claim) return { ok: false, reason: 'the loot it took is no longer on offer' };
    const things = lootItems(offer) ?? [];
    const gone = offeredFor(things, predicate.items);
    const purse = things.find(item => isPlainObject(item) && item.coin !== undefined)?.coin;
    const short = predicate.coin > 0 && !(Number.isSafeInteger(purse) && purse >= predicate.coin);
    if (gone.length || short) {
        const names = [...gone.map(want => itemText(want.name, want.qty)), ...(short ? ['the money'] : [])];
        return { ok: false, reason: `the loot on offer no longer holds ${joinNames(names)} it took` };
    }
    return { ok: true };
}
