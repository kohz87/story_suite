// The job: the one-line-per-entry digest of the lore, with a revision that changes when any source text changes.

import { hashJson } from '../../world/hash.js';

export const LINE_CHARS = 100;
export const DIGEST_KEYS = 4;

const firstSentence = text => {
    const flat = String(text).replace(/\s+/g, ' ').trim();
    const stop = /[.!?](\s|$)/.exec(flat);
    const sentence = stop && stop.index + 1 >= 20 ? flat.slice(0, stop.index + 1) : flat;
    return sentence.length > LINE_CHARS ? `${sentence.slice(0, LINE_CHARS - 1).trimEnd()}…` : sentence;
};

/** `{ lines: [{ title, keys (the first DIGEST_KEYS), line, protected? }], rev }` for entries from `loreEntries`; `rev` is a hash of every entry's title, keys, text and flag. */
export function buildDigest(entries) {
    const list = Array.isArray(entries) ? entries : [];
    return {
        lines: list.map(entry => ({
            title: entry.title, keys: entry.keys.slice(0, DIGEST_KEYS), line: firstSentence(entry.text), ...(entry.protected ? { protected: true } : {}),
        })),
        rev: hashJson(list.map(({ title, keys, text, protected: sealed }) => [title, keys, text, sealed])).slice(0, 12),
    };
}
