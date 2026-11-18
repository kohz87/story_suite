/* NPC State's relationship map setting (Settings › People › Map): its defaults and the normalizer every read goes through.
   The five lens keys are the ones the view's Map offers; any other stored value falls back to the default. */
const LENS_KEYS = Object.freeze(['warmth', 'trust', 'affection', 'desire', 'tension']);

const RELATIONSHIP_MAP_DEFAULTS = Object.freeze({ enabled: true, defaultLens: 'warmth' });

export function normalizeRelationshipMapSettings(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
        enabled: typeof source.enabled === 'boolean' ? source.enabled : RELATIONSHIP_MAP_DEFAULTS.enabled,
        defaultLens: LENS_KEYS.includes(source.defaultLens) ? source.defaultLens : RELATIONSHIP_MAP_DEFAULTS.defaultLens,
    };
}
