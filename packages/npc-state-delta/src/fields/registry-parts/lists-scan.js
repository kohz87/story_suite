// The derived field lists a scan, an alias merge and a Refresh read: text, evidence, alias-merge and refresh-changed fields.

import { listOf } from './derive.js';

export const TEXT_FIELDS = listOf('text');
export const PROFILE_EVIDENCE_FIELDS = listOf('evidence');
export const ALIAS_MERGE_TEXT_FIELDS = listOf('aliasMerge');
export const REFRESH_CHANGED_FIELDS = listOf('refreshChanged');
