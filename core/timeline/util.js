// Small shared pieces of the timeline package (docs/v2/TIMELINE.md): the failure envelope of contract §3,
// ids, and the marker a test's simulated crash carries. Public face: re-exports its parts.

export { HOST, isObject, makeId } from './util-parts/basics.js';
export { CODES, fail, codeOf } from './util-parts/envelope.js';
export { crash, crashing } from './util-parts/crash.js';
export { notDurable, isNotDurable, staleChat, isStaleChat } from './util-parts/early-end.js';
