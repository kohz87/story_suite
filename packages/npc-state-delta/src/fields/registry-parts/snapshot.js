// The inline card's copy of an NPC, from the registry's snapshot fields.

import { pairsOf } from './derive.js';

export const SNAPSHOT_FIELDS = Object.freeze(pairsOf('snapshot').map(([key, how]) => Object.freeze([key, how])));

// The inline card's copy of an NPC: the registry's snapshot fields, in its order (SNAPSHOT_FIELDS).
const SNAPSHOT_COPY = Object.freeze({
    raw: value => value,
    text: value => value || '',
    list: value => [...(value || [])],
    bool: value => Boolean(value),
    lifeState: value => value || 'unknown',
    nullable: value => value || null,
    messageId: value => (Number.isInteger(value) ? value : null),
    shallow: value => ({ ...(value || {}) }),
    relationshipChange: value => structuredClone(value || { impact: 'none', delta: { trust: 0, affection: 0, desire: 0, tension: 0 }, reason: '', sourceMessageId: null }),
    now: value => value || Date.now(),
    count: value => Number(value || 0),
});
export function snapshotNpc(npc) {
    return Object.fromEntries(SNAPSHOT_FIELDS.map(([key, how]) => [key, SNAPSHOT_COPY[how](npc[key])]));
}
