// The dossier's field registry: one read-only table of every stored NPC field that a hand-kept list
// used to name, and what each list is. The lists Delta's modules use are derived from it below.
//
// It describes; it decides nothing (the one function here only copies the snapshot fields). A number in an entry is the field's position in that list,
// so every derived list is exactly the list it replaces, order included (some orders are visible: the
// v2 dossier's key order, the revert groups' indexes, the sidecar's key order).
// tests/field-registry.test.js holds today's lists and checks each derived one against them.
//
// Entry keys:
//   kind          'identity' | 'text' | 'list' | 'map' | 'meter' | 'life' | 'part' (a stored part of
//                 another field) | 'meta' (book-keeping) | 'secret'
//   text          TEXT_FIELDS: the free-text fields a scan row can replace (core-mechanics applyIncoming)
//   evidence      PROFILE_EVIDENCE_FIELDS: the fields with a profile-evidence bucket
//   tracked       CHANGE_TRACKED_FIELDS: the fields with a "changed at" stamp (core.js)
//   dayTracked    DAY_TRACKED_FIELDS: the fields that also record the story day of a change
//   editorLock    EDITOR_LOCKABLE_FIELDS: the fields the editor's protect checkbox locks when changed
//   lock          [position, keys]: LOCKED_FIELD_KEYS, the stored keys a lock on this field keeps
//   revertGroup   [position, keys]: NPC_REVERT_GROUPS, keys reverted or kept together (branch.js)
//   revertList    NPC_REVERT_LIST_FIELDS: list fields reverted item by item
//   terminalFrozen  the fields a terminal death freezes at their last living value
//   aliasMerge    the text fields an alias merge takes from the longer copy
//   userMeta      the user metadata every branch restore keeps from the current dossier
//   refreshChanged  the fields a targeted Refresh reports as changed
//   snapshot      [position, how]: the inline-card snapshot (index.js snapshotNpc)
//   v2            DOSSIER_FIELDS: what the v2 npc.dossier query returns
//   prompt        'never' when the field must never reach a model-facing text; 'tail' when it reaches one only through
//                 the v2 module's tail (the hidden notes: opened ones as known, locked ones as hidden)
//
// Public face: re-exports its parts.
export { FIELDS } from './registry-parts/table.js';
export { RETURN_KEYS } from './registry-parts/return-keys.js';
export { RETURN_SHAPES, REFRESH_KEYS } from './registry-parts/return-shapes.js';
export { ALIAS_MERGE_TEXT_FIELDS, PROFILE_EVIDENCE_FIELDS, REFRESH_CHANGED_FIELDS, TEXT_FIELDS } from './registry-parts/lists-scan.js';
export { CHANGE_TRACKED_FIELDS, DAY_TRACKED_FIELDS, DOSSIER_FIELDS } from './registry-parts/lists-tracking.js';
export { BRANCH_USER_METADATA_FIELDS, EDITOR_LOCKABLE_FIELDS, LOCKED_FIELD_KEYS } from './registry-parts/lists-locks.js';
export { NPC_REVERT_GROUPS, NPC_REVERT_LIST_FIELDS, TERMINAL_FROZEN_FIELDS } from './registry-parts/lists-revert.js';
export { SNAPSHOT_FIELDS, snapshotNpc } from './registry-parts/snapshot.js';
