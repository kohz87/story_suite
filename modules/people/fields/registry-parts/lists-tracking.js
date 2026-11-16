// The derived field lists for change stamps and the v2 dossier query: changed-at, story-day and dossier fields.

import { listOf } from './derive.js';

export const CHANGE_TRACKED_FIELDS = listOf('tracked');
export const DAY_TRACKED_FIELDS = listOf('dayTracked');
export const DOSSIER_FIELDS = listOf('v2');
