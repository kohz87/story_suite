// The one-time move of saved relationship caps and impact criteria to the 1.14 defaults.
import { DEFAULT_RELATIONSHIP_CAPS, LEGACY_RELATIONSHIP_CAPS, normalizeRelationshipCaps } from '../../core/core-relationship-model.js';
import { DEFAULT_IMPACT_CRITERIA, LEGACY_IMPACT_CRITERIA } from '../../core/core-prompts-criteria.js';

// 1.14 moved the default points per event from 1 / 2 / 5 / 10 to 1 / 2 / 3 / 6, and the default impact-tier criteria with them. A
// saved copy of the old defaults is moved once; anything else is the reader's own and is kept, as is a later deliberate
// 1 / 2 / 5 / 10 (the marker `relationshipPacingMigrated`, set by getSettings after the first look). → { caps, impactCriteria }.
export function pacingDefaults(settings) {
    const first = settings?.relationshipPacingMigrated !== true;
    const caps = normalizeRelationshipCaps(settings?.relationshipCaps);
    const saved = typeof settings?.relationshipImpactCriteria === 'string' ? settings.relationshipImpactCriteria : DEFAULT_IMPACT_CRITERIA;
    return {
        caps: first && JSON.stringify(caps) === JSON.stringify(LEGACY_RELATIONSHIP_CAPS) ? { ...DEFAULT_RELATIONSHIP_CAPS } : caps,
        impactCriteria: first && saved === LEGACY_IMPACT_CRITERIA ? DEFAULT_IMPACT_CRITERIA : saved,
    };
}
