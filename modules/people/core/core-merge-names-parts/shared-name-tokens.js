// Shared name-title tokens and the title-aware token helpers used by name matching and identity-conflict checks.
import { normalizeName } from '../core-text.js';

// Titles and forms of address never identify one person on their own ("Lady", "Captain", "Capt.").
export const NAME_TITLE_TOKENS = new Set([
    'lady', 'lord', 'sir', 'dame', 'madam', 'madame', 'mister', 'miss', 'mistress', 'master', 'captain',
    'commander', 'general', 'lieutenant', 'sergeant', 'major', 'colonel', 'admiral', 'doctor', 'professor',
    'father', 'mother', 'brother', 'sister', 'elder', 'king', 'queen', 'prince', 'princess', 'duke', 'duchess',
    'count', 'countess', 'baron', 'baroness', 'lady-in-waiting', 'saint', 'young', 'old', 'little', 'big',
    'capt', 'lt', 'sgt', 'cpl', 'col', 'gen', 'adm', 'cmdr', 'dr', 'mr', 'mrs', 'ms', 'mx', 'prof', 'rev', 'st', 'sr', 'jr',
    'of', 'the', 'von', 'van', 'de', 'del', 'della', 'der', 'den', 'du', 'la', 'le', 'al', 'bin', 'ibn',
]);
// Names that are also everyday words ("I will go"): matched only when written with a capital.
export const bareTokens = label => normalizeName(label).split(/\s+/).filter(token => token && !NAME_TITLE_TOKENS.has(token));
export const titled = label => normalizeName(label).split(/\s+/).some(token => NAME_TITLE_TOKENS.has(token));
