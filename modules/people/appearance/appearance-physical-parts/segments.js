/* Splitting a presentation into segments and reading which physical traits a segment addresses. A part of appearance-physical.js (same owner, moved without change). */
import { PHYSICAL_TRAITS, SIZE_ONLY } from './trait-patterns.js';
import { appearanceText, clean } from '../appearance-text.js';

export function presentationSegments(value) {
    return appearanceText(value)
        .split(/\s*;\s*|(?<=[.!?])\s+|\s*,\s*/)
        .map(part => clean(part.replace(/^(?:and|with)\s+/i, '').replace(/[.!?]+$/, ''), 400))
        .filter(Boolean);
}
export function physicalTraitKeys(segment) {
    const keys = PHYSICAL_TRAITS.filter(([, pattern]) => pattern.test(segment)).map(([key]) => key);
    return keys.length || !SIZE_ONLY.test(segment) ? keys : ['height'];
}
// A hair mention re-describes the hair only when it says what the hair is like (colour, length,
// texture); "tied up in a bun" or "falls over her eyes" is styling and keeps the stored hair.
export const HAIR_DESCRIPTOR = /\b(?:long|short|cropped|shaved|bald|buzzed|shoulder[- ]length|waist[- ]length|chin[- ]length|ankle[- ]length|trimmed|curly|curled|curls|wavy|straight|frizzy|thick|thin|fine|coarse|silver|silvery|white|black|brown|blonde?|golden|gold|red|auburn|ginger|copper|chestnut|grey|gray|greying|graying|pink|blue|green|purple|violet|teal|(?:dark|light)(?=[- ](?:brown|blonde?|red|grey|gray|auburn|haired|hair|silver|gold|golden|chestnut))|dark-haired|raven|ebony|platinum|ashen|honey|sandy|strawberry|dyed|streaked|highlighted|bleached|colou?red)\b/i;
export function addressedTraitKeys(piece) {
    const keys = physicalTraitKeys(piece);
    return keys.includes('hair') && !HAIR_DESCRIPTOR.test(piece) ? keys.filter(key => key !== 'hair') : keys;
}
