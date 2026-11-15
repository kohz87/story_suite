// Rules the scan, editor and mutations apply to the dossier state: stamping a manual edit, spotting a lineage move, clearing dismissed groups.

import { storyDayAt } from '../src/transcript.js';
import { stampNpcChanges } from '../src/relationship-pass.js';
import { normalizeName } from '../core.js';
import { firstLineageDivergence, clearUserDismissedGroupsFor } from '../branch.js';
import { latestReplyIndex } from './chat-positions.js';

// The stamps for one of the reader's own edits: Delta's turn and the latest reply.
export function stampManualEdit(state, npc, before) {
    const reply = latestReplyIndex();
    return stampNpcChanges(npc, before, { turn: state.turn, message: reply >= 0 ? reply : null, storyDay: storyDayAt(reply >= 0 ? reply : undefined) });
}

// A change between two lineages other than the reply at `messageId` rewritten in place.
export function lineageMoved(previous, current, messageId) {
    const at = firstLineageDivergence(previous, current);
    if (at === -1) return false;
    if (!Number.isInteger(messageId) || at !== messageId || previous.length !== current.length) return true;
    return previous.slice(messageId + 1).some((entry, index) => entry !== current[messageId + 1 + index]);
}

export function clearUserDismissedSuppression(state, target) {
    if (!state || typeof state !== 'object') return state;
    const cleared = clearUserDismissedGroupsFor(state.userDismissedGroups, target, { modernByIdOnly: true });
    state.userDismissedGroups = cleared.groups;
    if (cleared.removedLabels.length) {
        const removed = new Set(cleared.removedLabels.map(normalizeName).filter(Boolean));
        state.dismissed = (Array.isArray(state.dismissed) ? state.dismissed : [])
            .filter(label => !removed.has(normalizeName(label)));
    }
    return state;
}
