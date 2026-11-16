/* NPC State Delta injection: the optional continuity fields (appearance, memories, species, age, location) of a card. */
import { DURABLE_PROFILE_LIMITS } from '../core-relationship.js';
import { cleanList, cleanText, normalizeName } from '../core-text.js';
import { IMPORTANT_MEMORY_LIMIT } from '../core-record.js';
import { normalizeGender } from '../core-identity.js';

const INJECTED_APPEARANCE_LABEL = 'APPEARANCE (authoritative; species cannot override the form): ';
const INJECTED_PHYSICAL_LABEL = 'PHYSICAL FEATURES (authoritative): ';
const INJECTED_FORM_ANATOMY_LABEL = 'FORM ANATOMY (authoritative; World State gives the outfit): ';

// Appearance is optional continuity, but when the whole current appearance does not fit the
// remaining budget its enduring physical features still should, so the roleplay model is not left
// to invent anatomy. Variants are tried in order; the last may be cut at a clause boundary.
// With the scene deferred, an NPC without a selected form keeps only its enduring physical
// features; a selected form's appearance is its whole anatomy, so it stays with World State
// named as the outfit's source.
function injectionAppearanceVariants(npc, sceneDeferred = false) {
    const appearance = cleanText(npc.appearance, 1200);
    if (!appearance) return [];
    const physical = !npc.currentForm && !npc.currentFormUnknown ? cleanText(npc.overallAppearance, 800) : '';
    if (sceneDeferred) {
        if (npc.currentForm || npc.currentFormUnknown) return [`${INJECTED_FORM_ANATOMY_LABEL}${appearance}`];
        return physical ? [`${INJECTED_PHYSICAL_LABEL}${physical}`] : [];
    }
    const variants = [`${INJECTED_APPEARANCE_LABEL}${appearance}`];
    if (physical && normalizeName(physical) !== normalizeName(appearance)) variants.push(`${INJECTED_PHYSICAL_LABEL}${physical}`);
    return variants;
}

export function injectionOptionalFields(npc, includeAppearance = false, sceneDeferred = false) {
    const importantMemories = cleanList(npc.memories, IMPORTANT_MEMORY_LIMIT, DURABLE_PROFILE_LIMITS.memory);
    const appearanceVariants = includeAppearance ? injectionAppearanceVariants(npc, sceneDeferred) : [];
    return [
        appearanceVariants.length && appearanceVariants,
        includeAppearance && !npc.appearance && (npc.currentForm || npc.currentFormUnknown) && 'Current visible appearance is not established; do not infer anatomy from species or another form.',
        importantMemories.length && `memories: ${importantMemories.join(' | ')}`,
        npc.species && `species: ${npc.species}`,
        npc.gender && `gender: ${normalizeGender(npc.gender)}`,
        npc.age && `age: ${npc.age}`,
        npc.apparentAge && `apparent age: ${npc.apparentAge}`,
        npc.location && `location: ${npc.location}`,
        npc.homeBase && `home base: ${npc.homeBase}`,
        npc.background && `background: ${cleanText(npc.background, 320)}`,
    ].filter(Boolean);
}
