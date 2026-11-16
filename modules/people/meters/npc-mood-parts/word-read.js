// Reading a scanner mood text into the axes it stands for: its words, their average and any numbers it gave.
import { hasOwn } from './shared-checks.js';
import { clampAxis } from './axes.js';
import { MOOD_LEXICON } from './lexicon.js';

const NEGATORS = new Set(['not', 'no', 'never', 'hardly', 'less', 'without', 'nor', 'neither', 'barely']);

/** The lexicon words of a text that are not negated: a word with a negator (not / no / never / no longer / hardly / less / ...n't) in the two words before it, in its own clause, does not count. */
export function plainMoodWords(text) {
    const out = [];
    for (const clause of (typeof text === 'string' ? text.toLowerCase() : '').split(/[,.;:!?()—–]+/)) {
        const tokens = clause.match(/[\p{L}'\u2019]+/gu) ?? [];
        tokens.forEach((word, at) => {
            if (!hasOwn(MOOD_LEXICON, word)) return;
            if (tokens.slice(Math.max(0, at - 2), at).some(before => NEGATORS.has(before) || before.endsWith("n't") || before.endsWith('n\u2019t'))) return;
            out.push(word);
        });
    }
    return out;
}

/**
 * The axes a mood text stands for (the fallback when the scanner gave no numbers): every known, not-negated word in it, averaged per axis and rounded half away from zero.
 * → { v, a, d, words: [the words found] }, or null when no word is known (the numbers are then left alone). Pure and fixed.
 */
export function moodFromWord(text) {
    const words = plainMoodWords(text);
    if (!words.length) return null;
    const mean = index => {
        const sum = words.reduce((total, word) => total + MOOD_LEXICON[word][index], 0) / words.length;
        return clampAxis(Math.sign(sum) * Math.round(Math.abs(sum)));
    };
    return { v: mean(0), a: mean(1), d: mean(2), words };
}

/** Three numbers the scanner gave with its mood word ({ moodV, moodA, moodD } or { v, a, d }): whole numbers, each clamped to -3..3; all three or none → { v, a, d } or null. */
export function moodNumbers(raw) {
    const pick = (...keys) => { const key = keys.find(name => raw?.[name] !== undefined && raw[name] !== null && raw[name] !== ''); const value = key === undefined ? null : raw[key]; const n = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN; return Number.isFinite(n) ? clampAxis(n) : null; };
    const [v, a, d] = [pick('moodV', 'v'), pick('moodA', 'a'), pick('moodD', 'd')];
    return v === null || a === null || d === null ? null : { v, a, d };
}
