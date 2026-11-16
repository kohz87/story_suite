/* Durable profile limits, the default relationship, its four keys and the default progress. */
import { SOCIAL_KEY_RELATIONSHIP_MAX_CHARS } from '../social.js';

export const DURABLE_PROFILE_LIMITS = Object.freeze({
    personality: 320,
    speech: 280,
    appearance: 800,
    background: 420,
    relationshipSummary: 320,
    mannerism: 160,
    behaviorProfile: 180,
    keyRelationship: SOCIAL_KEY_RELATIONSHIP_MAX_CHARS,
    memory: 400,
    evidence: 160,
});

export const DEFAULT_RELATIONSHIP = Object.freeze({
    trust: 0,
    affection: 0,
    desire: 0,
    tension: 0,
});

export const RELATIONSHIP_KEYS = Object.freeze(['trust', 'affection', 'desire', 'tension']);

export const DEFAULT_RELATIONSHIP_PROGRESS = Object.freeze({
    trust: 0,
    affection: 0,
    desire: 0,
    tension: 0,
});
