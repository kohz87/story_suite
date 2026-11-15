/* NPC State Delta small record scalars: the portrait seed bound and normalizer and the life-state certainty normalizer. */
export const PORTRAIT_SEED_MAX = Number.MAX_SAFE_INTEGER;

export function normalizePortraitSeed(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const seed = Number(value);
    return Number.isSafeInteger(seed) && seed >= 0 && seed <= PORTRAIT_SEED_MAX ? seed : null;
}

export function normalizeLifeStateCertainty(value) {
    const certainty = String(value ?? '').trim().toLowerCase();
    return ['explicit', 'inferred'].includes(certainty) ? certainty : '';
}
