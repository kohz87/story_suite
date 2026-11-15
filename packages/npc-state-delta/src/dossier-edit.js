// What a manual dossier Save writes about field locks.
//
// "Protect edited stable profile fields" locks every stable field the reader changed, keeps the locks
// already on the dossier, and unticked clears them all. Either way the choice is the reader's own, so
// the record is marked explicit: a swipe or branch restore then re-applies the locked fields and the
// lock list itself (branch-core.js preserveUserNpcMetadata) instead of reverting to an older copy.
//
// Public face: re-exports its parts.
export { EDITOR_LOCKABLE_FIELDS, LOCKED_FIELD_KEYS, editorProfileLocks, lockedFieldKeys } from './dossier-edit-parts/locks.js';
export { EDITOR_FIELDS, editorShownValue, untouchedEditorFields } from './dossier-edit-parts/fields.js';
export { editorManualMemories, settleEditorSave } from './dossier-edit-parts/save.js';
