// Appearance text typing: clause normalization and the split of appearance into core traits and clothing.
import { cleanText } from '../../core/core-text.js';
import { uniquePortraitParts } from './shared-parts.js';

const PORTRAIT_CLOTHING_TERMS = /\b(?:dress|gown|tunic|shirt|blouse|vest|coat|cloak|jacket|robe|skirt|trousers|pants|shorts|boots?|shoes?|stockings?|gloves?|hat|hood|uniform|armou?r|badge|ribbons?|necklace|earrings?|belt|scarf|sweater|wool|leather|silk|linen|cotton|sleeves?|collar)\b/i;
const PORTRAIT_ANATOMY_TERMS = /\b(?:woman|man|girl|boy|person|face|skin|hair|eyes?|ears?|brows?|lashes?|nose|lips?|mouth|cheeks?|jaw|chin|build|figure|bust|chest|shoulders?|arms?|hands?|legs?|feet|horns?|wings?|tails?|feathers?|plumage|scales?|talons?|claws?|beak|fins?|gills?|antlers?)\b/i;
export function normalizePortraitAppearanceClause(value, clothing = false, keepArticle = false) {
    let text = cleanText(value, 1800)
        .replace(/^(?:appearance|current appearance)\s*:\s*/i, '')
        .replace(/^[,;:\s]+|[,;:\s]+$/g, '')
        .trim();
    if (clothing) {
        text = text
            .replace(/^(?:wears?|wearing|dressed in|clad in)\s+/i, '')
            .replace(/^(?:outfit|clothing)\s*:\s*/i, '')
            .trim();
        if (!keepArticle) text = text.replace(/^(?:a|an|the)\s+/i, '').trim();
    }
    return text;
}

export function splitPortraitAppearance(value, keepArticle = false) {
    const source = cleanText(value, 1800).replace(/\r/g, '');
    if (!source) return { core: [], clothing: [] };
    const core = [];
    const clothing = [];
    const clauses = source.split(/[;\n]+|\.(?:\s+|$)/).map(item => item.trim()).filter(Boolean);
    for (const clause of clauses) {
        const clothingLead = /^(?:wears?|wearing|dressed in|clad in|outfit\s*:|clothing\s*:)/i.test(clause);
        const hasClothing = PORTRAIT_CLOTHING_TERMS.test(clause);
        const hasAnatomy = PORTRAIT_ANATOMY_TERMS.test(clause);
        const clothingOnly = clothingLead || (hasClothing && !hasAnatomy);
        const normalized = normalizePortraitAppearanceClause(clause, clothingOnly, keepArticle);
        if (!normalized) continue;
        (clothingOnly ? clothing : core).push(normalized);
    }
    return {
        core: uniquePortraitParts(core),
        clothing: uniquePortraitParts(clothing),
    };
}
