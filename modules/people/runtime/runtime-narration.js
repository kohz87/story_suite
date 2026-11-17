/* NPC State Delta narration capture (role: narration-capture). The one-pass block a reply carries beside the story: arming a generation, receiving and
   holding the block per reply, stripping it from the displayed reply and from swipes, taking it for the scan, and the capture statistics. Also the
   hosted one-pass test. Built by index.js once per module instance with the shared runtime state. Bodies are moved from index.js without change. Public face: re-exports its parts. */

export { captureJournalEntry, recordAcceptedCapture, recordReadMark, recordAcceptedFill } from './runtime-narration-parts/capture-journal.js';
export { convertJournal } from './runtime-narration-parts/journal-convert.js';
export { textCapture, backgroundRuleOn } from './runtime-narration-parts/capture-text.js';
export { createNarrationPart } from './runtime-narration-parts/narration-part.js';
