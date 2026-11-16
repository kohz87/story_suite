// Spots custom fields that duplicate another extension's game stats and warns about them.
import { areaOwner } from './deferral.js';
// Words that name game numbers kept by a stats owner (RPG Battle), matched as whole words.
const STAT_FIELD_WORDS = new Set([
    'level', 'lv', 'lvl', 'hp', 'mp', 'sp', 'xp', 'exp', 'experience', 'health', 'mana', 'stamina',
    'str', 'vit', 'agi', 'dex', 'int', 'luk', 'cha', 'wis', 'con', 'atk', 'def',
    'strength', 'vitality', 'agility', 'dexterity', 'intelligence', 'luck', 'charisma', 'wisdom', 'constitution',
    'attack', 'defense', 'defence', 'class', 'rank', 'stats', 'skill', 'skills',
]);

/** The custom field names that look like game stats (Level, HP, Class…), in their given order. */
export function statLikeFieldNames(names = []) {
    return (Array.isArray(names) ? names : [])
        .map(name => String(name ?? '').trim())
        .filter(name => (name.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []).some(word => STAT_FIELD_WORDS.has(word)));
}

/** The warning shown under Custom fields when another extension owns 'stats', or ''. */
export function statsOverlapWarning(names = [], choices = {}, suite = null) {
    const owner = areaOwner('stats', choices, suite);
    const overlap = owner ? statLikeFieldNames(names) : [];
    if (!overlap.length) return '';
    return `${owner.name} keeps game stats. ${overlap.join(', ')} may duplicate or contradict it; consider removing ${overlap.length === 1 ? 'that field' : 'those fields'} here.`;
}
