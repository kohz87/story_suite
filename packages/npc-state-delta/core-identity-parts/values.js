/* NPC State Delta identity: clamping and normalizing numbers, booleans, gender and dossier-signal values. */
import { normalizeName } from '../core-text.js';

export function clamp(value, min = 0, max = 100) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
}

export function normalizeBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value !== 0;
    if (typeof value === 'string') {
        const text = value.trim().toLowerCase();
        if (['true', 'yes', 'y', '1', 'on'].includes(text)) return true;
        if (['false', 'no', 'n', '0', 'off', ''].includes(text)) return false;
    }
    return Boolean(fallback);
}

// Gender is male, female or blank (the dossier shows blank as "not stated"). The story's own word is read, short phrases included ("a young woman", "her brother"):
// a gendered noun decides (man, woman, brother, sister, queen, "Mr", ...); a pronoun (he, she, ...) decides only when no noun is there; "her brother" is male because the
// noun wins. Two nouns that disagree, a word that is neither, or a long sentence is not stated. A possessive (his, her, hers) decides only when it is the whole answer; a word that owns something ("king's") or a negation ("not male") states nothing.
const MALE_NOUNS = new Set(['male', 'man', 'boy', 'masculine', 'gentleman', 'guy', 'brother', 'son', 'father', 'dad', 'husband', 'uncle', 'nephew', 'grandfather', 'king', 'prince', 'lord', 'sir', 'mr', 'duke', 'count', 'emperor']);
const FEMALE_NOUNS = new Set(['female', 'woman', 'girl', 'feminine', 'lady', 'gal', 'sister', 'daughter', 'mother', 'mom', 'wife', 'aunt', 'niece', 'grandmother', 'queen', 'princess', 'madam', 'mrs', 'miss', 'ms', 'duchess', 'countess', 'empress']);
const MALE_PRONOUNS = new Set(['he', 'him', 'himself']);
const FEMALE_PRONOUNS = new Set(['she', 'herself']);
const NEGATIONS = new Set(['not', 'non', 'no', 'never', 'isn']);
export function normalizeGender(value) {
    // A word that owns something ("king's mistress", "queen's guard") does not state the person's own gender, and a negated one ("not male") states none.
    const words = normalizeName(String(value ?? '').replace(/[\p{L}]+['\u2019]s\b/giu, ' ')).split(/[^a-z]+/).filter(Boolean);
    if (!words.length || words.length > 3 || words.some(word => NEGATIONS.has(word))) return '';
    const kinds = (nouns, pronouns) => ({ noun: words.some(word => nouns.has(word)), pronoun: words.some(word => pronouns.has(word)) });
    const male = kinds(MALE_NOUNS, MALE_PRONOUNS);
    const female = kinds(FEMALE_NOUNS, FEMALE_PRONOUNS);
    if (male.noun || female.noun) return male.noun && female.noun ? '' : (male.noun ? 'male' : 'female');
    if (male.pronoun === female.pronoun) return words.length === 1 && words[0] === 'his' ? 'male' : (words.length === 1 && (words[0] === 'her' || words[0] === 'hers') ? 'female' : '');
    return male.pronoun ? 'male' : 'female';
}

export function normalizeDossierSignal(value) {
    const signal = String(value ?? '').trim().toLowerCase();
    return ['incidental', 'meaningful', 'persistent'].includes(signal) ? signal : 'incidental';
}
