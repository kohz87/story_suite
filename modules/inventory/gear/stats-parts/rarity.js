// Reads the rarity a `rarity:` or `quality:` label names, from its five words and their synonyms.

import { words } from './shared-words.js';

// The five rarity words and their usual synonyms (a `rarity:` or `quality:` label).
const RARITY_WORD = Object.freeze({
    common: 'common', crude: 'common', poor: 'common', shoddy: 'common', plain: 'common', ordinary: 'common', simple: 'common', basic: 'common',
    uncommon: 'uncommon', fine: 'uncommon', good: 'uncommon', sturdy: 'uncommon', decent: 'uncommon', quality: 'uncommon',
    rare: 'rare', superior: 'rare', excellent: 'rare', masterwork: 'rare', exceptional: 'rare', exquisite: 'rare',
    epic: 'epic', heroic: 'epic', magnificent: 'epic', mythic: 'epic',
    legendary: 'legendary', fabled: 'legendary', artifact: 'legendary', divine: 'legendary',
});

/** The rarity a label's words name, or null (the first word that is one). */
export function gearRarityOf(value) {
    for (const word of words(value)) if (Object.hasOwn(RARITY_WORD, word)) return RARITY_WORD[word];
    return null;
}
