// Story-told Director capture. Reader acceptance uses typed evidence.
// Public face: re-exports its parts.

export { KEY_CHARS, SUMMARY_CHARS, NEW_THREADS_PER_REPLY, MAX_OPEN_THREADS } from './capture-parts/limits.js';
export { revOf, readerSaid, beginTurn } from './capture-parts/reply.js';
export { bareName, lineText, capKey, capSummary } from './capture-parts/text.js';
export { withoutDroppedLabels, toV1Op } from './capture-parts/reading.js';
export { addProblem, applyThreadLine } from './capture-parts/thread-line.js';
export { applyTimeLine } from './capture-parts/time-line.js';
