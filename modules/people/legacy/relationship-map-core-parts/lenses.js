/* The relationship map lenses, its settings defaults and the value a lens reads from a relationship. */
import { score } from './shared-values.js';

export const MAP_LENSES = Object.freeze([
    Object.freeze({ key: 'warmth', label: 'Warmth', negative: 'cold · hostile' }),
    Object.freeze({ key: 'trust', label: 'Trust', negative: 'distrust' }),
    Object.freeze({ key: 'affection', label: 'Affection', negative: 'dislike' }),
    Object.freeze({ key: 'desire', label: 'Desire', negative: 'aversion' }),
    Object.freeze({ key: 'tension', label: 'Tension', negative: 'at ease' }),
]);
const LENS_KEYS = MAP_LENSES.map(lens => lens.key);

export const RELATIONSHIP_MAP_DEFAULTS = Object.freeze({ enabled: true, defaultLens: 'warmth' });

export function normalizeRelationshipMapSettings(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
        enabled: typeof source.enabled === 'boolean' ? source.enabled : RELATIONSHIP_MAP_DEFAULTS.enabled,
        defaultLens: LENS_KEYS.includes(source.defaultLens) ? source.defaultLens : RELATIONSHIP_MAP_DEFAULTS.defaultLens,
    };
}

export function lensValue(relationship = {}, lens = 'warmth') {
    const rel = relationship && typeof relationship === 'object' ? relationship : {};
    if (lens === 'warmth') return Math.round((score(rel.trust) + score(rel.affection)) / 2);
    return score(rel[LENS_KEYS.includes(lens) ? lens : 'trust']);
}
