// The built-in meters and presets a cast entry may name, and the reserved meter words.

// The meters NPC State Delta has before any preset (a secret or a stage may name them without the entry listing them): its four
// own and the ones its built-in presets (companion, rival, mentor) add.
export const CAST_BUILT_IN_METERS = Object.freeze(['trust', 'affection', 'desire', 'tension', 'loyalty', 'respect', 'rivalry', 'approval']);
// The ids of NPC State Delta's built-in meter presets (its src/npc-meters-presets.js BUILT_IN_PRESETS): what an entry's `meters.preset`
// may name without the pack, or the reader, defining a preset of that id. The validator checks only that `preset` is a well-formed id
// (NPC State Delta decides at the first meeting whether it knows it); an editor offers these. tests/v2/packs/cast-presets.test.js pins
// the list against NPC State Delta's own.
export const CAST_BUILT_IN_PRESETS = Object.freeze(['companion', 'rival', 'mentor']);
// Words NPC State Delta keeps for itself (a stage line, a reason): never a meter id.
export const METER_RESERVED = Object.freeze(['stage', 'stages', 'disposition', 'name', 'meter', 'meters', 'reason', 'why', 'because', 'note', 'cause']);
