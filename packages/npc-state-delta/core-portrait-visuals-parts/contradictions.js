// Hair-colour contradiction detection and the automatic negative tags derived from explicit appearance text.
import { uniquePortraitParts } from './shared-parts.js';

const PORTRAIT_NON_HAIR_TRAIT_TERMS = /\b(?:eyes?|skin|ears?|face|brows?|lashes?|dress|gown|tunic|shirt|blouse|vest|coat|cloak|jacket|robe|skirt|trousers|pants|boots?|shoes?|ribbons?|badge|horns?|wings?|tails?|feathers?|scales?)\b/i;
const PORTRAIT_HAIR_COLOR_TAGS = Object.freeze({
    black: 'black hair',
    brown: 'brown hair',
    red: 'red hair',
    blonde: 'blonde hair',
    gold: 'golden hair',
    white: 'white hair',
    silver: 'silver hair',
    gray: 'gray hair',
    blue: 'blue hair',
    purple: 'purple hair',
    pink: 'pink hair',
    green: 'green hair',
    orange: 'orange hair',
});
const PORTRAIT_HAIR_COLOR_RULES = Object.freeze([
    { key: 'red', pattern: /\b(?:red|ginger|auburn|crimson)\b/i, contradictions: ['white', 'silver', 'blonde', 'blue', 'purple'] },
    { key: 'black', pattern: /\bblack\b/i, contradictions: ['white', 'silver', 'blonde', 'red', 'blue'] },
    { key: 'brown', pattern: /\b(?:brown|brunette)\b/i, contradictions: ['white', 'silver', 'blonde', 'red', 'blue'] },
    { key: 'blonde', pattern: /\b(?:blond|blonde|yellow)\b/i, contradictions: ['black', 'brown', 'red', 'blue', 'purple'] },
    { key: 'gold', pattern: /\b(?:gold|golden)\b/i, contradictions: ['white', 'silver', 'gray', 'black', 'brown'] },
    { key: 'white', pattern: /\b(?:white|ivory|snow-white|platinum)\b/i, contradictions: ['blonde', 'gold', 'black', 'brown', 'red'] },
    { key: 'silver', pattern: /\b(?:silver|silvery|metallic-white)\b/i, contradictions: ['blonde', 'gold', 'brown', 'red', 'blue'] },
    { key: 'gray', pattern: /\b(?:gray|grey)\b/i, contradictions: ['blonde', 'gold', 'black', 'brown', 'red'] },
    { key: 'blue', pattern: /\b(?:blue|cobalt|azure|indigo)\b/i, contradictions: ['white', 'silver', 'blonde', 'red', 'purple'] },
    { key: 'purple', pattern: /\b(?:purple|violet)\b/i, contradictions: ['white', 'silver', 'blonde', 'blue', 'red'] },
    { key: 'pink', pattern: /\bpink\b/i, contradictions: ['white', 'silver', 'blonde', 'red', 'purple'] },
    { key: 'green', pattern: /\b(?:green|emerald)\b/i, contradictions: ['white', 'silver', 'blonde', 'blue', 'red'] },
    { key: 'orange', pattern: /\borange\b/i, contradictions: ['white', 'silver', 'blonde', 'red', 'purple'] },
]);
const PORTRAIT_NEGATED_FEATURE_RULES = Object.freeze([
    { tag: 'wings', pattern: /\bwings?\b/i },
    { tag: 'horns', pattern: /\bhorns?\b/i },
    { tag: 'tail', pattern: /\btails?\b/i },
    { tag: 'feathers', pattern: /\bfeathers?\b/i },
    { tag: 'plumage', pattern: /\bplumage\b/i },
    { tag: 'talons', pattern: /\btalons?\b/i },
    { tag: 'claws', pattern: /\bclaws?\b/i },
    { tag: 'animal ears', pattern: /\b(?:animal|beast|avian|feathered)\s+ears?\b/i },
]);
function addHairColorsFromContext(context, found) {
    for (const rule of PORTRAIT_HAIR_COLOR_RULES) {
        const matcher = new RegExp(rule.pattern.source, 'ig');
        let match = null;
        while ((match = matcher.exec(context))) {
            const between = context.slice(match.index + match[0].length);
            if (!PORTRAIT_NON_HAIR_TRAIT_TERMS.test(between)) found.add(rule.key);
            if (!match[0].length) matcher.lastIndex += 1;
        }
    }
}

function explicitHairColorKeys(value) {
    const source = String(value || '');
    const found = new Set();
    const hair = /\bhairs?\b/gi;
    let match = null;
    while ((match = hair.exec(source))) {
        const before = source.slice(0, match.index);
        const boundary = Math.max(before.lastIndexOf(','), before.lastIndexOf(';'), before.lastIndexOf('.'), before.lastIndexOf('\n'));
        addHairColorsFromContext(before.slice(boundary + 1).slice(-120), found);

        const after = source.slice(match.index + match[0].length, match.index + match[0].length + 96);
        const connector = after.match(/^\s*(?:(?:is|was|looks?|appears?|colored|coloured|color(?:ed)?|colour(?:ed)?)\s*[:=-]?\s*|[:=-]\s*)([^,;.\n]{1,48})/i);
        if (connector) addHairColorsFromContext(connector[1], found);
        if (!match[0].length) hair.lastIndex += 1;
    }
    return found;
}

function explicitNegatedFeatureTags(value) {
    const source = String(value || '');
    const tags = [];
    for (const rule of PORTRAIT_NEGATED_FEATURE_RULES) {
        const afterNo = new RegExp('\\b(?:no|without|lacks?|lacking)\\b[^,;.\\n]{0,48}' + rule.pattern.source, 'i');
        const notVisible = new RegExp(rule.pattern.source + '[^,;.\\n]{0,32}\\b(?:(?:is|are)\\s+)?(?:not visible|absent|not present)\\b', 'i');
        if (afterNo.test(source) || notVisible.test(source)) tags.push(rule.tag);
    }
    return tags;
}

export function derivePortraitContradictionNegatives(appearance, extraPositive, replaceAutomatic = false) {
    if (replaceAutomatic) return [];
    const subjectText = [appearance, extraPositive].filter(Boolean).join('; ');
    const explicitColors = explicitHairColorKeys(subjectText);
    const colorNegatives = [];
    const seenColorKeys = new Set();
    for (const key of explicitColors) {
        const rule = PORTRAIT_HAIR_COLOR_RULES.find(item => item.key === key);
        for (const contradiction of rule?.contradictions || []) {
            if (explicitColors.has(contradiction) || seenColorKeys.has(contradiction)) continue;
            const tag = PORTRAIT_HAIR_COLOR_TAGS[contradiction];
            if (!tag) continue;
            seenColorKeys.add(contradiction);
            colorNegatives.push(tag);
            if (colorNegatives.length >= 8) break;
        }
        if (colorNegatives.length >= 8) break;
    }
    return uniquePortraitParts([
        ...colorNegatives,
        ...explicitNegatedFeatureTags(subjectText),
    ]);
}
