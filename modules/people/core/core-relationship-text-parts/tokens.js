/* Durable concept tokens: stopwords, aliases and the refinement tokenizer. */
import { normalizeName } from '../core-text.js';

const DURABLE_REFINEMENT_STOPWORDS = new Set([
    'and', 'the', 'with', 'that', 'this', 'their', 'they', 'them', 'when', 'while', 'from', 'into', 'over', 'under',
    'very', 'more', 'less', 'than', 'then', 'but', 'for', 'her', 'his', 'its', 'she', 'him', 'who', 'has', 'have', 'had',
    'uses', 'use', 'often', 'usually', 'still', 'also', 'only', 'toward', 'towards', 'around', 'becomes', 'become', 'being',
    'a', 'an', 'of', 'to', 'in', 'on', 'at', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'by', 'or', 'it', 'he',
]);

const DURABLE_CONCEPT_ALIASES = Object.freeze({
    telepathy: 'telepath', telepathic: 'telepath', telepathically: 'telepath',
    connection: 'link', connections: 'link', connected: 'link', channel: 'link', channels: 'link', linked: 'link',
    thoughts: 'mind', thought: 'mind', minds: 'mind', mental: 'mind',
    siblings: 'sibling', sisters: 'sister', brothers: 'brother',
    courteous: 'courtesy', courteously: 'courtesy', politeness: 'polite', politely: 'polite',
    humorous: 'humor', humorously: 'humor', dryly: 'dry',
    kindness: 'kind', kindhearted: 'kind', compassionate: 'compassion', compassion: 'compassion',
    reserved: 'reserve', restraint: 'restrain', restrained: 'restrain',
    gentleness: 'gentle', gently: 'gentle', motherly: 'maternal',
    speaks: 'speak', speaking: 'speak', spoken: 'speak', says: 'say', saying: 'say',
    gestures: 'gesture', gesturing: 'gesture', movements: 'movement',
    bonded: 'bond', bonding: 'bond', bonds: 'bond',
});

function durableConceptToken(token) {
    let word = String(token || '').toLowerCase();
    if (!word) return '';
    if (DURABLE_CONCEPT_ALIASES[word]) return DURABLE_CONCEPT_ALIASES[word];
    if (word.length > 5 && word.endsWith('ies')) word = `${word.slice(0, -3)}y`;
    else if (word.length > 6 && word.endsWith('ing')) word = word.slice(0, -3);
    else if (word.length > 5 && word.endsWith('ed')) word = word.slice(0, -2);
    else if (word.length > 4 && word.endsWith('es')) word = word.slice(0, -2);
    else if (word.length > 4 && word.endsWith('s')) word = word.slice(0, -1);
    return DURABLE_CONCEPT_ALIASES[word] || word;
}

export function durableRefinementTokens(value) {
    return normalizeName(value).split(/\s+/)
        .filter(token => (token.length >= 2 || /^\d+$/.test(token)) && !DURABLE_REFINEMENT_STOPWORDS.has(token))
        .map(durableConceptToken)
        .filter(token => (token.length >= 2 || /^\d+$/.test(token)) && !DURABLE_REFINEMENT_STOPWORDS.has(token));
}
