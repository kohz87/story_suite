// Reading the open chat's positions: the latest reply and message, whether a mark still stands, and a message's lineage key.

import { chatLineage, lineageCheckpointKey } from '../branch.js';
import { chatContext } from './replay-reads.js';

// The chat message index of the latest assistant reply (the greeting is 0), or -1: the number Story
// Block shows as "reply #N" and the dossiers show for changes recorded since 1.2.3.
export function latestReplyIndex() {
    const chat = chatContext().chat || [];
    for (let i = chat.length - 1; i >= 0; i -= 1) {
        if (chat[i] && !chat[i].is_system && !chat[i].is_user) return i;
    }
    return -1;
}

// Whether the message a chatHeadMark was taken at is still there: the same object at the same place with the same swipe (a reply taken back by a
// swipe, a delete or another chat is not). The reply a held host command was meant for (src/adapter/queries.js), unlike chatHeadUnchanged it stays
// true when later replies come.
export function markStands(mark) {
    const chat = chatContext().chat || [];
    const message = mark ? chat[(mark.length ?? 0) - 1] ?? null : null;
    return Boolean(mark) && message === mark.message && (Number.isInteger(message?.swipe_id) ? message.swipe_id : null) === mark.swipe;
}

export function latestMessageId(preferAssistant = false) {
    const chat = chatContext().chat || [];
    if (preferAssistant) {
        for (let i = chat.length - 1; i >= 0; i -= 1) {
            if (chat[i] && !chat[i].is_system && !chat[i].is_user) return i;
        }
    }
    for (let i = chat.length - 1; i >= 0; i -= 1) {
        if (chat[i] && !chat[i].is_system) return i;
    }
    return -1;
}


export function currentLineageKeyForMessage(messageId) {
    const lineage = chatLineage(chatContext().chat || []);
    return lineageCheckpointKey(lineage, messageId);
}
