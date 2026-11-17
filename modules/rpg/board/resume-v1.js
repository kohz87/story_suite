// Foe bars that a Combat Rules v1 fight resumes across fights. A v1 fight that ended lost or fled clears its foe groups from the Foes block, and a v1 foe has no block field of its own,
// so the bars survive only in that reply's fight receipt (`data.v2.result.foes`, each `<slot>.<n>` with its HP). When the story sets the same foes again (same slot, name, count, level
// and tier) while the newest fight that covered the slot is that lost or fled v1 one, the next fight starts from those bars. Pure: it reads the receipts in chat order and the sheet's foe slots.
import { isRollReceipt } from './results.js';
import { foeStats } from '../combat/foes.js';

const ENDED = new Set(['won', 'lost', 'fled']);
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const slotOf = foe => Number(String(foe?.id ?? '').split('.')[0]);

// The recorded members of one slot, in order: [] when the record holds none.
const membersOf = (result, slot) => result.foes.filter(foe => slotOf(foe) === slot);

// A recorded group is the same foes as a sheet slot: the member count (a foe that fell stays counted, at 0 HP), the level, the tier and each member's label exactly
// ("<name> <n>" for a group of several, "<name>" for one: combat/input.js foesOf).
function same(slot, members) {
    if (members.length !== Math.min(Number(slot.count) || 1, 6) || !members.length) return false;
    const name = String(slot.name ?? ''), mine = foeStats({ level: slot.level, tier: slot.tier });
    return members.every(foe => Number(foe.level) === mine.level && foe.tier === mine.tier && Number(foe.maxHp) === mine.hp
        && foe.label === (members.length > 1 ? `${name} ${String(foe.id).split('.')[1]}` : name));
}

/**
 * `receipts`: the chat's receipts in order (each `{ receipt }` or the receipt itself). `slots`: the sheet's standing v1 foe slots ({ slot, name, count, level, tier }).
 * → `{ foes: [{ id, hp }] }` for the opening's `resumed`, or null when no slot has a covering fight, the newest fight that covers a slot was won, was not v1, or its foes are not these.
 */
export function resumeFoesV1(receipts, slots) {
    const wanted = (Array.isArray(slots) ? slots : []).filter(slot => Number.isSafeInteger(slot?.slot) && slot.slot > 0);
    if (!wanted.length) return null;
    const kept = [];
    for (const slot of wanted) {
        // The newest fight of either engine that covered this slot decides: only a v1 fight that ended lost or fled resumes; a won one, an unfinished one, an old-engine one stops the search.
        let found = null;
        for (let at = (receipts?.length ?? 0) - 1; at >= 0; at -= 1) {
            const receipt = receipts[at]?.receipt ?? receipts[at], result = isRollReceipt(receipt) ? receipt.data?.v2?.result : null;
            if (!plain(result)) continue;
            const groups = result.board?.groups ?? (Array.isArray(result.members) ? result.members.map(member => member?.group) : []);
            if (!Array.isArray(groups) || !groups.includes(slot.slot)) continue;
            found = result.board?.v1 === 1 && ENDED.has(result.stop) && Array.isArray(result.foes) ? result : null;
            break;
        }
        if (!found || found.stop === 'won') return null;
        const members = membersOf(found, slot.slot);
        if (!same(slot, members)) return null;
        kept.push(...members.map(foe => ({ id: String(foe.id), hp: Number(foe.hp) })));
    }
    return { foes: kept };
}
