// The derived lists a branch revert and a terminal death use: revert list fields, revert groups and frozen fields.

import { listOf, pairsOf } from './derive.js';

export const NPC_REVERT_LIST_FIELDS = listOf('revertList');
export const TERMINAL_FROZEN_FIELDS = listOf('terminalFrozen');
export const NPC_REVERT_GROUPS = Object.freeze(pairsOf('revertGroup').map(([, keys]) => Object.freeze([...keys])));
