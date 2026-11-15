// The derived lists for editor locks and the metadata a branch restore keeps: lockable fields, lock keys and user metadata.

import { listOf, pairsOf } from './derive.js';

export const EDITOR_LOCKABLE_FIELDS = listOf('editorLock');
export const BRANCH_USER_METADATA_FIELDS = listOf('userMeta');
export const LOCKED_FIELD_KEYS = Object.freeze(Object.fromEntries(pairsOf('lock').map(([key, keys]) => [key, Object.freeze([...keys])])));
