/* NPC State Delta relationship evidence: normalizes the per-axis evidence text of a relationship change. */
import { cleanText } from '../core-text.js';
import { RELATIONSHIP_KEYS } from '../core-relationship-model.js';

export function normalizeRelationshipEvidence(value = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return Object.fromEntries(RELATIONSHIP_KEYS.map(key => [key, cleanText(source[key], 300)]));
}
