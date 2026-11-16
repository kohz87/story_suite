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

// Gender is male, female or blank (the dossier shows blank as "not stated"). The story's own word is read: male/man/boy/he/him/masculine, female/woman/girl/she/her/feminine
// (a short phrase such as "a young woman" counts); a word that is neither, or both, or a long sentence, is not stated.
const MALE_WORDS = new Set(['male', 'man', 'boy', 'he', 'him', 'his', 'masculine', 'gentleman', 'guy']);
const FEMALE_WORDS = new Set(['female', 'woman', 'girl', 'she', 'her', 'hers', 'feminine', 'lady', 'gal']);
export function normalizeGender(value) {
    const words = normalizeName(value).split(/[^a-z]+/).filter(Boolean);
    if (!words.length || words.length > 3) return '';
    const male = words.some(word => MALE_WORDS.has(word));
    const female = words.some(word => FEMALE_WORDS.has(word));
    if (male === female) return '';
    return male ? 'male' : 'female';
}

export function normalizeDossierSignal(value) {
    const signal = String(value ?? '').trim().toLowerCase();
    return ['incidental', 'meaningful', 'persistent'].includes(signal) ? signal : 'incidental';
}
