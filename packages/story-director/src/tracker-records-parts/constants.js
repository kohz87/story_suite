// Shared constants and label-key predicate for tracker record ops.

import { kindOf } from '../changes.js';

export const SUPERSEDED = /supersed|replac|merged/i;
// A step that has not started is not the story moving a job on.
export const NOT_STARTED = /^\s*(?:0\s*(?:\/|of)\s*\d+|0|none|not (?:yet )?started|pending|unstarted)\b/i;
// (0.9.14) Keys that only label a line, a block or a kind ("! Encounter — the wolves attack",
// "~ Quest — …"): they name no record, so a line under one is skipped quietly instead of being
// a warning, and the next note never asks the model to add them.
const LABEL_KEYS = new Set(['encounter', 'encounters', 'fight', 'combat', 'battle', 'scene', 'director', 'world state', 'note', 'notes', 'summary', 'status', 'update', 'updates', 'change', 'changes', 'event', 'events', 'record', 'records']);
export const isLabelKey = id => LABEL_KEYS.has(id) || Boolean(kindOf(id));
// (0.9.19) The other names a record was reached by, newest kept: enough for a model's drift.
export const MAX_ALIASES = 8;
