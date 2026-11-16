// What the hosted slice does with a held event: the reader's words for the receipt and the cut of a forwarded scanner change to a
// lower tier, and the reply's last-event record (lastEvent: readEvent, nextEvent, eventSummary, askedOf). A pure part of the pacing rule (src/relationship-pacing.js, which holds the count); never imports npc-meters.js.
// Public face: re-exports its parts.
export { dayRuleFor, clockReaders, pacingNote, cutToTier } from './npc-meters-pacing-parts/tier-words.js';
export { EVENT_MAX, LOG_MAX } from './npc-meters-pacing-parts/shared-limits.js';
export { readEvent } from './npc-meters-pacing-parts/event-read.js';
export { eventLog } from './npc-meters-pacing-parts/event-log.js';
export { nextEvent, withEvidence } from './npc-meters-pacing-parts/event-write.js';
export { cutWords } from './npc-meters-pacing-parts/event-text.js';
export { eventSummary, askedOf, movesOf } from './npc-meters-pacing-parts/event-summary.js';
