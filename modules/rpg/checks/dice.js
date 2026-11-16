// The three d20 a reply offers outside a fight, and what is recorded with them: one seeded stream per reply, the rules and difficulty numbers it was
// offered under, the practice one use gives, and each party member's exact bonuses (the table the note tells). Pure: the same seed gives the same dice, so a
// Re-read asks again (the prelude's recorded payload and seed) without rolling anything new, and nothing here reads today's settings. (The note's text lives in
// cue.js, a shared helper, so the tail can tell it without loading this.)
// Public face: re-exports its parts.

export { CHECK_DICE_COUNT, replyDice, offerLine } from './dice-parts/roll.js';
export { dicePayload } from './dice-parts/payload.js';
export { diceOf, tableOf } from './dice-parts/recorded.js';
export { diceRecord } from './dice-parts/record.js';
