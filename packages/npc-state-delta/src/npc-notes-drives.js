// NPC notes, drives (phase 2 item 4): how strongly each instinct pull moves one NPC. Seven small ints 0..3 under short keys
// (belo, clos, awe, pres, comf, conf, hone), default 2 (normal, multiplier 1). The slice leaf is one JSON text object: readDrives
// (absent reads as the defaults, malformed reads as null), setDrives (writes a merged object; on the first write it is seeded from
// the cast pack's entry or the first description, see seedDrives), and no story grammar writes it. The pull code scales each
// instinct score by its strength (applyStrength, scaledInst) and the dossier gets fixed rows (driveRows). The first three keys
// match the mood-pull instinct keys (belo, clos, awe). Pure: no imports, never touches storage or npc-meters.js.
// Seeding: the pack's drives win; otherwise a drive starts high only when the first description carries TWO DIFFERENT cue words for it.
// Growth (rule 1, the `npc.drives` command): the evidence the scan already recorded (new memories, behavior and mannerism lines, the
// relationship reason) is read for cue words; a drive steps one level (up on its own cues, down on its short opposite list) when its cues
// show in 2 DIFFERENT replies since its last change. The pending reply, the source and the reason live in the leaf's `x` object, so the
// step is stored like any change (swipe, delete, Re-read and replay give the same drives as live).
// Public face: re-exports its parts.
export { DRIVE_MIN, DRIVE_MAX, DRIVE_DEFAULT, DRIVES_TEXT_MAX } from './npc-notes-drives-parts/shared-limits.js';
export { DRIVE_RULE, DRIVE_LIST_STRENGTH, DRIVES } from './npc-notes-drives-parts/shared-table.js';
export { readExtras } from './npc-notes-drives-parts/extras.js';
export { readDrives, setDrives } from './npc-notes-drives-parts/stored.js';
export { seedDrives, seedDetail } from './npc-notes-drives-parts/seed.js';
export { strengthMultiplier, applyStrength, scaledInst, driveRows } from './npc-notes-drives-parts/pull.js';
export { driveEvidence, growDrives } from './npc-notes-drives-parts/growth.js';
export { parseLever } from './npc-notes-drives-parts/lever.js';
