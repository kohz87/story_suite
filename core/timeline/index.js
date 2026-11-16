// The timeline package (docs/v2/TIMELINE.md): save points, the restore protocol, participants.
//
// Public face: re-exports its parts.

export { createTimeline, MANUAL_LIMIT, createTimelinePart, withRuleOverlay } from './index-parts/build.js';
export { GENESIS_EPOCH, HOST_DOMAIN, epochOf } from './index-parts/epoch.js';
export { gateProblem, rulesHashOf } from './index-parts/guards.js';
export { capture, planRestore, registered } from './index-parts/manifest.js';
export { ACTIVE_READERS, crash } from './index-parts/support.js';
