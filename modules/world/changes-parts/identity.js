// Story Director: key identity normalization and kind lookup/inference.
import { KINDS, KIND_ALIASES, QUEST_TYPE_WORDS } from './kinds.js';
import { stripMarkdown } from './shared-text.js';

// lineKey answers per string (the same key is looked at many times per reply); bounded, cleared whole when full.
const LINE_KEYS = new Map();
const LINE_KEYS_MAX = 4096;

/** Identity of a key: lowercase, markdown and punctuation squashed, single spaces. */
export function lineKey(key) {
    if (typeof key !== 'string') return lineKeyOf(key);
    let out = LINE_KEYS.get(key);
    if (out === undefined) {
        out = lineKeyOf(key);
        if (LINE_KEYS.size >= LINE_KEYS_MAX) LINE_KEYS.clear();
        LINE_KEYS.set(key, out);
    }
    return out;
}

function lineKeyOf(key) {
    return stripMarkdown(key)
        .normalize('NFKC')
        .toLowerCase()
        // Dropped rather than spaced, so `Hollin's` and `Hollins` are the same record.
        .replace(/['’‘`]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

/** The kind a word names (`hook`, or an alias such as `thread`), or null. */
export function kindOf(word) {
    const lower = String(word ?? '').trim().toLowerCase();
    if (KINDS.includes(lower)) return lower;
    return Object.hasOwn(KIND_ALIASES, lower) ? KIND_ALIASES[lower] : null;
}

// A quest only with who it is for, what it pays or a quest type (0.9.3); a goal, step or
// difficulty alone is an open thread, a hook.
export function inferKind(fields) {
    const type = String(fields.type ?? '').trim().toLowerCase();
    if (fields.giver || fields.reward || type === 'quest' || type === 'quests' || Object.hasOwn(QUEST_TYPE_WORDS, type)) return 'quest';
    if (fields.goal || fields.step || fields.difficulty) return 'hook';
    if (fields.leg || fields.now) return 'agenda';
    if (fields.due) return 'clock';
    // Foes with nothing else to say what the record is: a planned fight is a beat.
    if (fields.encounter) return 'beat';
    return 'event';
}
