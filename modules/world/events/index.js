// The events part of Story Block (MODULES §A, §E): pack events checked before each reply.
//
// No domain of its own: whether an event happened is a claim in `meta.claims` (`event:<id>`), its cue a
// `system` receipt, its effects other modules' commands. The coordinator's module.js merges this part;
// `createEventsPart` takes the three dependencies so tests (and the coordinator, if it prefers) can
// inject them. The default `part` reaches them lazily through the public sdk (SPEC §6):
//   events  → view.query('packs.content', { kind: 'events' })   (SB-packs)
//   command → globalThis.StoryBlock.sdk.command
//   query   → globalThis.StoryBlock.sdk.query                  (for events.status outside a view)
//
// Public face: re-exports its parts.

export { CALLS, LIMITS, compile, evaluate, evaluateCondition, parse, tokenize } from './condition.js';
export { FIRE, claimKey, createEngine, createFireEvent, fireEvent, inspect, normalizeEvents, repeatKey } from './engine.js';
export { EVENTS_NOTE, renderEventsSection, summaryLine } from './section.js';
export { packEvents } from './index-parts/pack-events.js';
export { createEventsPart, part } from './index-parts/events-part.js';
