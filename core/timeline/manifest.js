// The all-domain payload and version manifest (contract §8; docs/v2/TIMELINE.md). A snapshot captures every domain the
// state holds, found by looking at the registry and the state themselves: there is no list of domains kept by hand, so a
// module that registers a domain tomorrow is captured tomorrow. A restore installs the captured slices absolutely and says,
// domain by domain, where each came from.
//
// Pure: the registry and the state in, a payload or a plan out; nothing is stored here.
//
// Public face: re-exports its parts.

export { domainDef, versionOf, registered } from './manifest-parts/domains.js';
export { SCHEMA, savepointsProblems, initialSavepoints, previousDayOf } from './manifest-parts/savepoints.js';
export { capture, payloadProblem } from './manifest-parts/payload.js';
export { planRestore } from './manifest-parts/restore.js';
