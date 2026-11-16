// Builds a saved character file from a character and words its text and file name.

import { STATS } from '../names.js';
import { SKILL_FIELDS_MAX } from '../../../core/runtime/skill-slots.js';
import { classOfLevel, levelOfClass } from '../formula.js';
import { CHAR_FILE, CHAR_VERSION, FILE_LIMITS } from './limits.js';
import { whole } from './shared-reading.js';

/**
 * A saved character file, as the plain object that is written. `character`: { soul, points, stats, skills: [{ name, about, stat?, uses, rank }] };
 * `items` (omit to leave the inventory out): [{ name, qty, note?, kind?, rarity? }]; `money` (omit to leave the purse out): whole base units.
 */
export function buildCharacterFile({ level, soul, points, stats, skills = [], items = null, money = null }) {
    // (`level` 1..99 is the character's level; `soul` stays in the file, the Soul Class the level stands for, for a build that still reads the class.)
    const shown = Number.isSafeInteger(level) ? level : levelOfClass(soul);
    const file = {
        [CHAR_FILE]: CHAR_VERSION, level: shown, soul: Number.isSafeInteger(soul) ? soul : classOfLevel(shown), points,
        stats: Object.fromEntries(STATS.map(stat => [stat, stats[stat]])),
        skills: skills.slice(0, SKILL_FIELDS_MAX).map(skill => ({ name: skill.name, about: skill.about, ...(STATS.includes(skill.stat) ? { stat: skill.stat } : {}), uses: skill.uses, rank: skill.rank, ...(skill.type === 'utility' ? { type: 'utility' } : {}) })),
    };
    if (Array.isArray(items)) {
        file.items = items.map(item => ({ name: item.name, qty: item.qty, ...(item.note ? { note: item.note } : {}),
            ...(item.kind ? { kind: item.kind } : {}), ...(item.rarity ? { rarity: item.rarity } : {}),
            ...(item.slot ? { slot: item.slot } : {}), ...(item.stats ? { stats: item.stats } : {}),
            ...(whole(item.carry, 1, FILE_LIMITS.carry) ? { carry: item.carry } : {}) }));
    }
    if (Number.isSafeInteger(money)) file.money = money;
    return file;
}

/** The text written to the file. */
export const fileText = file => `${JSON.stringify(file, null, 2)}\n`;

/** "wessel.character.json" for a name (letters and digits only; "character" when the name leaves none). */
export function fileNameOf(name) {
    const slug = [...String(name ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')].slice(0, 40).join('').replace(/-+$/, '');
    return `${slug || 'character'}.character.json`;
}
