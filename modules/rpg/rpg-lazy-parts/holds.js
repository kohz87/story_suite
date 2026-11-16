// Whether a chat and its metadata hold anything the RPG wrote (holdsRpg), so its code is fetched before the chat is replayed.

import { CHECK_STEP, DICE, FIGHT, PRACTICE_STEP, RESOLVE } from '../names.js';

// (`capture.party` is the receipt of a `+ party` line; the guarded block it makes is `dm.join`.)
const GUARD_KINDS = new Set([RESOLVE, FIGHT, PRACTICE_STEP, CHECK_STEP, DICE, 'dm.join', 'capture.party', 'capture.roll']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// The fight board is an interaction kind (I6): its settle receipt, its guard and its unsent scratch are the RPG's too.
const FIGHT_KIND = 'story-block/fight';
const fightSettle = receipt => receipt?.type === 'interaction.settle' && receipt.replan?.payload?.kindId === FIGHT_KIND;
const fightGuard = span => span?.guard?.predicate?.kind === 'interaction' && span.guard.predicate.id === FIGHT_KIND;
const fightScratch = box => isRecord(box) && [box.open, box.start, box.send?.payload, box.last, ...Object.values(isRecord(box.held) ? box.held : {}).map(held => held?.current?.prechecks?.find(step => step?.payload?.kindId === FIGHT_KIND)?.payload)].some(item => item?.kindId === FIGHT_KIND);

/**
 * Whether the chat (SillyTavern's message array) and its metadata hold anything of the RPG's: a receipt or a guarded block
 * of `rpg.*`, `dm.join` or a `+ party` line on any carrier (or a settle of the fight kind), or its plan hold / start notes (or an unsent fight) in the metadata. Cheap: one pass over the records' receipts and spans.
 */
export function holdsRpg(chat, metadata = null) {
    try {
        if (isRecord(metadata) && (metadata.rpgPlan != null || isRecord(metadata.storySuite?.rpgStart) || fightScratch(metadata.storySuiteInteraction))) return true;
        for (const message of Array.isArray(chat) ? chat : []) {
            const records = [message?.extra?.storySuite, ...(Array.isArray(message?.swipe_info) ? message.swipe_info.map(info => info?.extra?.storySuite) : [])];
            for (const record of records) {
                if (!isRecord(record)) continue;
                if ((record.receipts ?? []).some(receipt => GUARD_KINDS.has(receipt?.type) || fightSettle(receipt))) return true;
                if ((record.spans ?? []).some(span => GUARD_KINDS.has(span?.guard?.predicate?.kind) || fightGuard(span))) return true;
            }
        }
    } catch { /* an unreadable chat holds nothing we can name */ }
    return false;
}
