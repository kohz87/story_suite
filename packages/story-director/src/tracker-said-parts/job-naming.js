// Matching job names, bulk job references, and choice statements in reader text.

import { keyWords } from '../tracker-words.js';
import { NOT_BEFORE, escapeRegExp, normalizeQuotes, sentencesOf } from './shared-text.js';

// Words of a job's name too general to say which job is meant.
const GENERIC_WORDS = new Set(['quest', 'job', 'jobs', 'contract', 'bounty', 'task', 'work', 'mission', 'favour', 'favor', 'side', 'main']);

// (0.9.32) Every job in question at once: "all three contracts", "both jobs", "all of them".
const COUNT_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6 };
const JOB_NOUNS = '(?:contracts?|jobs?|quests?|bount(?:y|ies)|tasks?|postings?|notices?|offers?|commissions?|requests?|errands?)';
const ALL_JOBS = new RegExp(`\\b(?:(?:all|both|every|each)(?:\\s+(?:of\\s+)?(?:the|these|those))?(?:\\s+(\\d+|two|three|four|five|six))?\\s+${JOB_NOUNS}|(?:all|both)(?:\\s+(\\d+|two|three|four|five|six))?\\s+of\\s+(?:them|those|these)|them\\s+(?:all|both))\\b`, 'i');

/** How many jobs "all of them" means in `said`: { count } (null: as many as are in question), or null when it says none. */
export function allJobsIn(said) {
    for (const sentence of sentencesOf(said)) {
        const match = ALL_JOBS.exec(sentence);
        if (!match) continue;
        const word = String(match[1] ?? match[2] ?? '').toLowerCase();
        const count = /^\d+$/.test(word) ? Number(word) : COUNT_WORDS[word] ?? (/\bboth\b/i.test(match[0]) ? 2 : null);
        return { count };
    }
    return null;
}

export function namesJob(sentence, record) {
    const words = keyWords(record.key).filter(word => word.length >= 3 && !GENERIC_WORDS.has(word));
    // (0.9.19) A name the story gave the job (an alias) names it too: "the fold wolf contract".
    const names = [record.key, String(record.fields?.giver ?? '').trim(), ...words, ...(record.aliases ?? [])].filter(name => name.length >= 3);
    // A name as written, or with a plural ending: wolf/wolves, bounty/bounties, rat/rats.
    const pattern = name => {
        const body = escapeRegExp(normalizeQuotes(name)).replace(/\s+/g, '\\s+');
        if (/f$/i.test(name)) return `${body.slice(0, -1)}(?:f|ves)`;
        if (/y$/i.test(name)) return `${body.slice(0, -1)}(?:y|ies)`;
        return `${body}(?:s|es)?`;
    };
    return names.some(name => new RegExp(`(?<![\\p{L}\\p{N}])${pattern(name)}(?![\\p{L}\\p{N}])`, 'iu').test(normalizeQuotes(sentence)));
}

/**
 * Whether `said` (the reader's message) makes a choice about `record` with `words`: a sentence
 * with one of them, not negated, naming the job, or any such sentence when `alone` (it is the
 * only job in question).
 */
export function saidAbout(said, record, words, { alone = false, among = false } = {}) {
    return sentencesOf(said).some(sentence => {
        const match = words.exec(sentence);
        if (!match || NOT_BEFORE.test(sentence.slice(0, match.index))) return false;
        // (0.9.32) `among`: the job is one of those "all of them" in the same sentence means.
        return alone || namesJob(sentence, record) || (among && ALL_JOBS.test(sentence));
    });
}
