// Normalizes the reader's per-area source-of-truth choices.
import { SOURCE_OF_TRUTH_CHOICES, SUITE_AREAS } from './identity.js';
export function normalizeSourceOfTruth(raw = {}) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return Object.fromEntries(SUITE_AREAS.map(area => [area, SOURCE_OF_TRUTH_CHOICES.includes(source[area]) ? source[area] : 'auto']));
}
