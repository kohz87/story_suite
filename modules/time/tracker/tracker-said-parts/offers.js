// Finding which open offers are in question and which ones a reader's message chooses.

import { ACCEPT_WORDS, REFUSE_WORDS } from './choice-words.js';
import { isOffer } from './job-state.js';
import { allJobsIn, saidAbout } from './job-naming.js';

/**
 * The offers "all of them" means: the ones shown most lately before reply `message` (a
 * count given: that many, newest first). [record]
 */
export function offersInQuestion(records, message, count = null) {
    const last = record => Math.max(...[record.seen, record.changed, record.created].map(at => (Number.isInteger(at?.message) && at.message < message ? at.message : -1)));
    const offers = (records ?? []).filter(isOffer).map(record => ({ record, at: last(record) })).filter(entry => entry.at >= 0).sort((a, b) => b.at - a.at);
    if (!offers.length) return [];
    if (count) return offers.slice(0, count).map(entry => entry.record);
    return offers.filter(entry => entry.at === offers[0].at).map(entry => entry.record);
}

/** The offers `text` (the reader's message) takes on, or turns down: [key], in tracker order. */
export function offersChosenIn(tracker, text, choice = 'accept') {
    const offers = (tracker?.records ?? []).filter(isOffer);
    const words = choice === 'refuse' ? REFUSE_WORDS : ACCEPT_WORDS;
    const all = allJobsIn(text);
    const among = new Set(all ? offersInQuestion(offers, Number.POSITIVE_INFINITY, all.count).map(record => record.id) : []);
    return offers.filter(record => saidAbout(text, record, words, { alone: offers.length === 1, among: among.has(record.id) })).map(record => record.key);
}
