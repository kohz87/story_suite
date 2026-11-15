/* NPC State Delta stamping the per-field change markers when a record changes. */
import { STORY_DAY_SCHEME, storyDateTextAt } from '../calendar.js';
import { stampMemories } from '../core-record-shared.js';
import { CHANGE_TRACKED_FIELDS, DAY_TRACKED_FIELDS } from '../src/fields/registry.js';
import { resolveNpcAppearance } from '../appearance.js';
import { normalizeFieldChanges, normalizeFieldChangeDays, normalizeFieldChangeMessages } from './field-change-normalize.js';

function trackedFieldValue(npc, field) {
    if (field === 'appearance') return resolveNpcAppearance(npc);
    if (field === 'relationship') {
        const rel = npc?.relationship || {};
        return ['trust', 'affection', 'desire', 'tension'].map(axis => Math.round(Number(rel[axis]) || 0));
    }
    return npc?.[field] ?? '';
}

export function stampFieldChanges(before, after, turn, storyDay = null, message = null) {
    const changes = normalizeFieldChanges(after?.fieldChanges ?? before?.fieldChanges);
    const days = normalizeFieldChangeDays(after?.fieldChangeDays ?? before?.fieldChangeDays);
    const messages = normalizeFieldChangeMessages(after?.fieldChangeMessages ?? before?.fieldChangeMessages);
    const memoryStamps = stampMemories(before, after, message, storyDateTextAt);
    const withExtras = next => {
        const out = Object.keys(days).length ? { ...next, fieldChangeDays: days } : next;
        if (memoryStamps) out.memoryStamps = memoryStamps;
        else delete out.memoryStamps;
        if (Object.keys(messages).length) out.fieldChangeMessages = messages;
        else delete out.fieldChangeMessages;
        return out;
    };
    if (!before || !Number.isInteger(turn) || turn < 0) return withExtras({ ...after, fieldChanges: changes });
    for (const field of CHANGE_TRACKED_FIELDS) {
        if (JSON.stringify(trackedFieldValue(before, field)) !== JSON.stringify(trackedFieldValue(after, field))) {
            changes[field] = turn;
            if (Number.isInteger(message) && message >= 0) messages[field] = message;
            else delete messages[field];
            if (Number.isInteger(storyDay) && DAY_TRACKED_FIELDS.includes(field)) {
                days[field] = storyDay;
                days.scheme = STORY_DAY_SCHEME;
            }
        }
    }
    return withExtras({ ...after, fieldChanges: changes });
}

// (cleanup step 9) The same per-field "changed at" stamps for writers outside the merge: the
// focused relationship pass and the reader's own edits (dossier editor, appearance forms, life
// state). `message` is the reply index the change belongs to; `storyDay` the World State day, if any.
export function stampChangedFields(before, after, { turn, storyDay = null, message = null } = {}) {
    return stampFieldChanges(before, after, Math.trunc(Number(turn)), storyDay, message);
}
