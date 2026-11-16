// Which fields a manual dossier Save locks, and the lock fields it writes.

import { normalizeCustomFields } from '../../core.js';
import { EDITOR_LOCKABLE_FIELDS, LOCKED_FIELD_KEYS } from '../fields/registry.js';

// The fields the editor locks when the reader changes them, and the stored keys a lock covers (a lock
// on a field keeps everything that field is made of, so a restored or imported copy never pairs a kept
// value with another copy's parts). Both come from the field registry.
export { EDITOR_LOCKABLE_FIELDS, LOCKED_FIELD_KEYS };
const LIST_FIELDS = new Set(['mannerisms', 'behaviorProfile', 'keyRelationships', 'aliases', 'memories']);

export function lockedFieldKeys(field) {
    return LOCKED_FIELD_KEYS[field] || [field];
}

function comparable(npc, key) {
    if (key === 'customFields') return JSON.stringify(normalizeCustomFields(npc?.customFields));
    return LIST_FIELDS.has(key) ? JSON.stringify(npc?.[key] || []) : String(npc?.[key] || '');
}

// The lock fields of the saved record, from the dossier before the Save (current), the edited copy
// (next) and the state of the protect checkbox.
export function editorProfileLocks(current, next, { protect = false } = {}) {
    if (!protect) return { manualProfileFields: [], manualProfileLocksExplicit: true };
    const locks = new Set(Array.isArray(current?.manualProfileFields) ? current.manualProfileFields : []);
    for (const key of EDITOR_LOCKABLE_FIELDS) if (comparable(current, key) !== comparable(next, key)) locks.add(key);
    return { manualProfileFields: [...locks], manualProfileLocksExplicit: true };
}
