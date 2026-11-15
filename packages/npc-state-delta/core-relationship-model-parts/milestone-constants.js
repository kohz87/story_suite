/* Milestone thresholds, requirements, minimum raw changes and the milestone limit. */
import { RELATIONSHIP_KEYS } from './profile-defaults.js';

export const RELATIONSHIP_MILESTONE_THRESHOLDS = Object.freeze([25, 50, 75, 90]);
export const RELATIONSHIP_MILESTONE_REQUIREMENTS = Object.freeze({
    25: 'meaningful',
    50: 'major',
    75: 'extreme',
    90: 'extreme',
});
export const RELATIONSHIP_MILESTONE_MIN_RAW = Object.freeze({
    25: 1,
    50: 3,
    75: 5,
    90: 8,
});
export const RELATIONSHIP_MILESTONE_LIMIT = RELATIONSHIP_KEYS.length * 2 * RELATIONSHIP_MILESTONE_THRESHOLDS.length;
