// Whether a chat and its metadata hold anything the RPG wrote (holdsRpg), so its code is fetched before the chat is replayed.

import { CHECK_STEP, DICE, FIGHT, PRACTICE_STEP, RESOLVE } from '../names.js';

// (`capture.party` is the receipt of a `+ party` line; the guarded block it makes is `dm.join`.)
const GUARD_KINDS = new Set([RESOLVE, FIGHT, PRACTICE_STEP, CHECK_STEP, DICE, 'dm.join', 'capture.party', 'capture.roll']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Whether the chat (SillyTavern's message array) and its metadata hold anything of the RPG's: a receipt or a guarded block
 * of `rpg.*`, `dm.join` or a `+ party` line on any carrier, or its plan hold / start notes in the metadata. Cheap: one pass over the records' receipts and spans.
 */
export function holdsRpg(chat, metadata = null) {
    try {
        if (isRecord(metadata) && (metadata.rpgPlan != null || isRecord(metadata.storySuite?.rpgStart))) return true;
        for (const message of Array.isArray(chat) ? chat : []) {
            const records = [message?.extra?.storySuite, ...(Array.isArray(message?.swipe_info) ? message.swipe_info.map(info => info?.extra?.storySuite) : [])];
            for (const record of records) {
                if (!isRecord(record)) continue;
                if ((record.receipts ?? []).some(receipt => GUARD_KINDS.has(receipt?.type))) return true;
                if ((record.spans ?? []).some(span => GUARD_KINDS.has(span?.guard?.predicate?.kind))) return true;
            }
        }
    } catch { /* an unreadable chat holds nothing we can name */ }
    return false;
}
