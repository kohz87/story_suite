// Portrait prompt building: prompt-format normalization and buildNpcPortraitPrompts.
import { cleanText, normalizeName } from '../core-text.js';
import { normalizeGender } from '../core-identity.js';
import { derivePortraitContradictionNegatives, extractPortraitVisualAnchorTags, normalizePortraitAppearanceClause, portraitTagFallbackParts, splitPortraitAppearance, uniquePortraitParts } from '../core-portrait-visuals.js';
import { buildNaturalPortraitProse } from '../core-portrait-prose.js';
import { DEFAULT_PORTRAIT_STYLE_POSITIVE, DEFAULT_PORTRAIT_STYLE_NEGATIVE, DEFAULT_PORTRAIT_COMPOSITION } from './style-defaults.js';
import { PORTRAIT_STYLE_PROMPT_LIMIT, PORTRAIT_COMPOSITION_PROMPT_LIMIT, PORTRAIT_NPC_PROMPT_LIMIT, PORTRAIT_PROMPT_FORMATS } from './limits-formats.js';

export function normalizePortraitPromptFormat(value) {
    const mode = String(value ?? '').trim().toLowerCase();
    return PORTRAIT_PROMPT_FORMATS.includes(mode) ? mode : 'hybrid';
}
export function buildNpcPortraitPrompts(rawNpc = {}, options = {}) {
    const npc = rawNpc && typeof rawNpc === 'object' ? rawNpc : {};
    const format = normalizePortraitPromptFormat(options.format);
    const stylePositive = cleanText(options.stylePositive ?? DEFAULT_PORTRAIT_STYLE_POSITIVE, PORTRAIT_STYLE_PROMPT_LIMIT);
    const styleNegative = cleanText(options.styleNegative ?? DEFAULT_PORTRAIT_STYLE_NEGATIVE, PORTRAIT_STYLE_PROMPT_LIMIT);
    const composition = cleanText(options.composition ?? DEFAULT_PORTRAIT_COMPOSITION, PORTRAIT_COMPOSITION_PROMPT_LIMIT);
    const useMood = options.useMood !== false;
    const useLocation = options.useLocation === true;
    const extraPositive = cleanText(npc.portraitPromptPositive ?? npc.portrait_prompt_positive, PORTRAIT_NPC_PROMPT_LIMIT);
    const extraNegative = cleanText(npc.portraitPromptNegative ?? npc.portrait_prompt_negative, PORTRAIT_NPC_PROMPT_LIMIT);
    const replaceAutomatic = Boolean(npc.portraitPromptReplace ?? npc.portrait_prompt_replace);

    const visualAge = cleanText(npc.apparentAge, 80) || cleanText(npc.age, 80);
    const species = cleanText(npc.species ?? npc.race, 160);
    const gender = normalizeGender(npc.gender ?? npc.sex);
    const role = cleanText(npc.role, 240);
    const appearance = cleanText(npc.appearance, 1800);
    const mood = useMood ? cleanText(npc.mood, 240) : '';
    const location = useLocation ? cleanText(npc.location, 300) : '';
    const appearanceGroups = splitPortraitAppearance(appearance);
    const identity = uniquePortraitParts([
        species,
        gender,
        visualAge ? 'apparent age ' + visualAge : '',
    ]);
    const roleTag = normalizePortraitAppearanceClause(role);
    const moodTag = normalizePortraitAppearanceClause(mood);
    const locationTag = normalizePortraitAppearanceClause(location);

    let positive = '';
    if (replaceAutomatic && extraPositive) {
        positive = extraPositive;
    } else if (format === 'natural') {
        positive = buildNaturalPortraitProse({
            name: cleanText(npc.name, 120),
            gender,
            rawGender: cleanText(npc.gender ?? npc.sex, 40),
            species,
            visualAge,
            role,
            appearance: splitPortraitAppearance(appearance, true),
            mood,
            location,
            composition,
            extraPositive,
            stylePositive,
        });
    } else {
        const visualAnchors = format === 'tags' ? extractPortraitVisualAnchorTags(appearance) : [];
        const coreAppearance = format === 'tags'
            ? portraitTagFallbackParts(appearanceGroups.core)
            : appearanceGroups.core;
        const subjectParts = uniquePortraitParts([
            ...identity,
            ...visualAnchors,
            ...coreAppearance,
            roleTag,
            ...appearanceGroups.clothing,
            moodTag,
            locationTag,
            composition,
            extraPositive,
        ]);
        positive = [...subjectParts, stylePositive].filter(Boolean).join(format === 'tags' ? ', ' : '; ');
    }

    const configuredNegative = normalizeName([styleNegative, extraNegative].filter(Boolean).join(' '));
    const derivedNegative = derivePortraitContradictionNegatives(appearance, extraPositive, replaceAutomatic)
        .filter(tag => !configuredNegative.includes(normalizeName(tag)));
    const negative = [...derivedNegative, styleNegative, extraNegative].filter(Boolean).join(', ');
    return {
        positive: String(positive || '').replace(/\s+/g, ' ').trim(),
        negative: String(negative || '').replace(/\s+/g, ' ').trim(),
        format,
        replaceAutomatic,
    };
}
