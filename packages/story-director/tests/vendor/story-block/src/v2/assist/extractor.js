// The after-reply extractor, Assist's safety net (SPEC §0.5, §4.2, MODULES §F100, §F123): when it is
// on, one cheap model call reads each finished reply after its capture, with the reply's own change lines
// and the grammar of the kinds the reader allows (`assistExtractorKinds`), and proposes only the lines
// the story clearly told but its block did not write (time passing, a new place, who came or went, the
// weather, quest progress or a turn-in, wounds, an item handed over). Code then keeps only what the value
// wall lets through (safety.js: never coin, new items, XP, loot or heals), drops a line the block already
// has (C-1's matching, capture.js sameChangeLine, and the same op, kind and name) or a place, time or weather
// line when the block set that kind, and hands the rest to
// the host's capture, which checks each like a story line and marks it as the extractor's. The output is
// stored with the reply (capture.js withAssist), so replay, swipes and Re-read never call the model again.
// Never for quiet or impersonate generations, never for a continue (its reply was read when it first
// arrived), once per carrier and swipe. It is told the scene's place, the map's place names near it and the story's
// date and time (where.js), and its lines that name a known place by an invented name, or set a time with no clock
// time, are refused with a Problems line on the reply.
// Public face: re-exports its parts.

export { EXTRACTOR_HEAD, WHERE_HEAD, WRITTEN_HEAD, REPLY_HEAD } from './extractor-parts/heads.js';
export { EXTRACTOR_FOOT, WORLD_FOOT, footFor } from './extractor-parts/foot.js';
export { grammarKind, allowedGrammar } from './extractor-parts/grammar.js';
export { REPLY_LIMIT, extractorPrompt } from './extractor-parts/prompt.js';
export { SCENE_KINDS, notWritten } from './extractor-parts/not-written.js';
export { MAX_LINES, parseExtractorAnswer } from './extractor-parts/answer.js';
export { ANSWER_TOKENS, createExtractor } from './extractor-parts/create.js';
