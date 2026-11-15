// NPC mood (VAD): the per-NPC mood state, its clamp, the event -> delta rules, the settling toward a resting mood
// over story time, the fixed 3x3 word table and the cause text. Pure: no DOM, no host, no clock, no randomness. The story minute is given in, and
// the state is plain data on the NPC record (`mood`), written in the same change as the move that caused it, so a
// replay, a rebuild, a swipe or a Re-read gives the live values. Nothing here reads story text.
//
//   mood = { v, a, d, day, cause, at?, from?, rest? }
//   v      valence: -3 unpleasant .. 3 pleasant          (whole numbers, code-set only)
//   a      arousal: -3 slack .. 3 keyed up               (Energy bar)
//   d      dominance: -3 cornered .. 3 in control        (Control bar)
//   day    the story day the axes were last settled to
//   at     the story minute of the last event; from = the axes at that minute; rest = this person's resting mood (their
//          temperament, -2..2 per axis, default 0,0,0). The axes now are always eased from `from` over (now - at), so the
//          result does not depend on how often it is read: the same minute twice gives the same axes. Old records (no
//          at/from/rest) read as at = day start, from = their axes, rest = 0.
//   All three axes are always kept, also at rest (they settle at `rest`, never removed or nulled).
//   cause  the last cause text, e.g. "trust dropped: Astra lied" (plain text; the UI escapes it)
//
// Events come from code: a trust drop or betrayal from the reply's own trust move (eventsFromMoves), rest and safety
// from the rest kinds. Fight and hurt are NOT derived here: no NSD reader of RPG receipts exists yet.
// TODO: add 'hurt' and 'fight' events when that reader lands (NSDMAP section 1, RPG receipts).
// Wired in src/: run() applies the events of a line's trust move (feature npc-state-delta.mood-pull), the tick decays, the tail and the dossier row read the word.
// A mood WORD the scanner wrote ("mortified and flustered") is read through the fixed lexicon below (MOOD_LEXICON, moodFromWord): the scanner may give no numbers
// (its prompt is locked) unless it gave numbers too (moodNumbers); without numbers the axes are the average of the words found, rounded; a text with no known word gives no numbers and leaves the axes as they are.
// Never imports the host, the meter modules or the instinct modules.
// Public face: re-exports its parts.

export { MOOD_MIN, MOOD_MAX, clampAxis, dayOf } from './npc-mood-parts/axes.js';
export { CAUSE_MAX, cleanReason, causeText } from './npc-mood-parts/text.js';
export { MOOD_BAND_EDGE, TRUST_DROP_MIN, BETRAYAL_TRUST, SEVERE_DROP_MIN } from './npc-mood-parts/thresholds.js';
export { DAY_MIN, HALF_LIFE, REST_LIMIT, EVENT_DELTAS } from './npc-mood-parts/timing.js';
export { neutralMood, normalizeMood } from './npc-mood-parts/state.js';
export { easeAxis, restingMood, restMood, decayMood } from './npc-mood-parts/settle.js';
export { applyEvents, eventsFromMoves } from './npc-mood-parts/events.js';
export { MOOD_WORDS, bandOf, moodWord, storedMoodWord } from './npc-mood-parts/words.js';
export { moodBars } from './npc-mood-parts/bars.js';
export { MOOD_LEXICON } from './npc-mood-parts/lexicon.js';
export { plainMoodWords, moodFromWord, moodNumbers } from './npc-mood-parts/word-read.js';
export { applyWord, UNRATED } from './npc-mood-parts/word-apply.js';
export { MOOD_LOG_MAX, readMoodLog, nextMoodLog } from './npc-mood-parts/log.js';
