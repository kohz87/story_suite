// Meter presets for Story Suite v2 (TRS ideas 2-3 as the coordinator took them): a named set of
// custom meters, a stage ladder and per-meter limits that the reader turns on in one click. The
// reader's settings keep only the ids in use (`presets`); the meters, the ladder and the limits are
// read from the preset each time, so a pack update reaches every chat that uses it.
//
//   preset = { id, name, describe, builtIn, meters: [custom meter rows], ladder: [{ name, needs,
//              milestone }], limits: { meterId: { ceiling?, floor? } } }
//
// * Built-in presets are plain and non-explicit: Companion, Rival, Mentor. The Mentor's desire
//   ceiling is 0, so that bond never turns romantic by the numbers.
// * A pack offers more through the content kind `meterPresets` (Story Block's `packs.content`,
//   PACKS.md: `{ id, title, meters: [{ id, name, min, max, start, describe?, bands?: [{ at, word }],
//   drift?: { toward, perDay } }], stages?: [{ id, name, needs: [{ meter, at }], milestone? }] }`); a
//   pack record is cleaned the same way and keeps the id `packs.content` gives it. A pack stage's
//   `milestone` is what the story is told when it is first reached, never a milestone it needs.
// * A preset's ladder runs on its own track: it applies to the NPCs the reader gave that preset in
//   the dossier editor (their limits come from it too), never to everyone.
//
// Pure: no DOM, no host. Bad entries are left out, never thrown.
// Public face: re-exports its parts.
export { MAX_PRESETS, PRESET_LADDER_MAX } from './npc-meters-presets-parts/shared-limits.js';
export { BUILT_IN_PRESETS } from './npc-meters-presets-parts/built-in.js';
export { normalizeLimit, normalizeLimits } from './npc-meters-presets-parts/limits.js';
export { normalizePreset } from './npc-meters-presets-parts/normalize.js';
export { presetCatalog, presetIds } from './npc-meters-presets-parts/catalog.js';
