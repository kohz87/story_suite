// Rewriting every stored lineage key from one lineage to another across the persisted structures.
import { lineageCheckpointKeys } from './lineage-keys.js';

// Rewrites every stored lineage key from one lineage to another, in every persisted structure that
// carries one, so checkpoints, the rollback journal and inline cards keep matching the chat.
export function remapLineageKeys(state, fromLineage, toLineage) {
    const fromKeys = lineageCheckpointKeys(fromLineage);
    const toKeys = lineageCheckpointKeys(toLineage);
    const map = new Map();
    fromKeys.forEach((key, index) => { if (toKeys[index]) map.set(key, toKeys[index]); });
    const remap = value => (map.has(value) ? map.get(value) : value);
    for (const item of Array.isArray(state.checkpoints) ? state.checkpoints : []) {
        item.lineageKey = remap(item.lineageKey);
        item.parentLineageKey = remap(item.parentLineageKey);
        if (Number.isInteger(item.messageId) && toLineage[item.messageId] && map.has(fromKeys[item.messageId])) item.fingerprint = toLineage[item.messageId];
    }
    for (const entry of Array.isArray(state.rollbackJournal) ? state.rollbackJournal : []) {
        entry.lineageKey = remap(entry.lineageKey);
        entry.parentLineageKey = remap(entry.parentLineageKey);
    }
    if (state.rollbackHead && typeof state.rollbackHead === 'object') state.rollbackHead.lineageKey = remap(state.rollbackHead.lineageKey);
    // Reply-owned capture inputs (the one-pass block a reply carried) follow their reply to its new key.
    for (const entry of Array.isArray(state.captureJournal) ? state.captureJournal : []) if (entry) entry.key = remap(entry.key);
    for (const card of Array.isArray(state.inlineCards) ? state.inlineCards : []) {
        card.lineageKey = remap(card.lineageKey);
        if (Number.isInteger(card.messageId) && toLineage[card.messageId] && map.has(fromKeys[card.messageId])) card.fingerprint = toLineage[card.messageId];
    }
    state.lineage = toLineage;
    return state;
}
