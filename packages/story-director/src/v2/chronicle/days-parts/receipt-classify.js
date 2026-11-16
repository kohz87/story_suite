// Story Director v2, chronicle part: receipt bookkeeping and clock-setting classification. Pure.

import { DM_TYPES, PRESENCE_TEXT, PRESENT_TYPES } from './receipt-scene.js';
import { isInt, isRecord, text } from './shared-values.js';

// Receipts that set the clock (module story-director, `data.minutes`; `director.clock` is the reader's own edit of it).
// `director.advance` called by another module's command would have no receipt of its own, and the walk (clock-step.js) would then drift,
// as a settle is only a checkpoint there; no module calls it that way (tests/v2/time/advance-callers.test.js pins it).
const CLOCK_TYPES = new Set(['capture.time', 'director.seed', 'director.clock', 'time.settle', 'director.advance']);
// Receipts that are the code's own bookkeeping, never an event of the day (neither picked nor counted under "happened"): Story Block's
// fight board result (`rpg.resolve`, whose summary is the narrator's instruction), its no-roll step, field edits, timer ticks and
// reply-end settles (`dm.set`, `dm.tick`, `dm.settle`), the Director's own initiative pick and world pulse, the story-time settle and the cast's
// "nothing changed". Practice lines and add-xp are the reader's progress and stay.
export const BOOKKEEPING_TYPES = new Set([
    'rpg.resolve', 'rpg.noroll', 'dm.set', 'dm.tick', 'dm.settle', 'director.initiative', 'director.pulse', 'time.settle', 'cast.advance',
]);
// A block's template result (`capture.dm` / `dm.act`, `data.v2.result.kind`) that is a plain meter set (set-health, set-mana,
// set-stamina, set-slot-N) or a foe slot clear (clear-N) is bookkeeping; every other kind (register, deed, add-xp ...) is a story event.
const METER_KIND = /^(set-[a-z]+(-\d+)?|clear-\d+)$/;
/** Whether a receipt is the code's own bookkeeping: by type, by a block result's kind, a clock line "(not used)" or an empty summary (never by other text). */
export function isBookkeeping(receipt) {
    if (BOOKKEEPING_TYPES.has(receipt.type)) return true;
    // Who is or is not in the scene (state, not an event: "Met" has the arrivals) and the key people's "noted" tick.
    if (PRESENT_TYPES.has(receipt.type) && PRESENCE_TEXT.test(text(receipt.summary).trim())) return true;
    if (receipt.type === 'npc.tick' && /^Key people: noted/.test(text(receipt.summary).trim())) return true;
    if (typeof receipt.summary !== 'string' || !receipt.summary.trim()) return true;
    if (DM_TYPES.has(receipt.type)) return METER_KIND.test(receipt.data?.v2?.result?.kind ?? '');
    return receipt.type === 'capture.time' && /\(not used\)\.?\s*$/.test(receipt.summary);
}

export const receiptOf = entry => (isRecord(entry?.receipt) ? entry.receipt : isRecord(entry) && typeof entry.type === 'string' ? entry : null);
export const clockSet = receipt => CLOCK_TYPES.has(receipt.type) && (receipt.module === undefined || receipt.module === 'story-director') && isInt(receipt.data?.minutes);
