// Field names and limits of ready-made NPC meter presets.

// Ready-made NPC meter sets for NPC State Delta (MODULES §F81, §F90):
// `{ id, title, meters: [{ id, name, min, max, start, describe?, bands?, drift? }], stages?: [{ id, name, needs, milestone? }] }`.
// The limits follow NPC State Delta's own (six custom meters from -1000 to 1000, eight stages, names of 40).
export const METER_PRESET_FIELDS = Object.freeze(['id', 'title', 'meters', 'stages']);
export const METER_FIELDS = Object.freeze(['id', 'name', 'min', 'max', 'start', 'describe', 'bands', 'drift']);
export const METER_STAGE_FIELDS = Object.freeze(['id', 'name', 'needs', 'milestone']);
export const METER_LIMITS = Object.freeze({ presets: 4, meters: 6, min: -1000, max: 1000, id: 40, name: 40, title: 40, describe: 200, bands: 8, word: 24, stages: 8, needs: 4, milestone: 200 });
