// Story Director v2, chronicle part: parses line tags and groups or trims a day's lines by Journal category.

import { cut, flat } from '../days/shared.js';
import { CATEGORIES, classify } from './classify.js';
import { isRecord, list } from './shared.js';

/** A stored line's kind tag `"<type|-> [thread]"` as `{ type, thread }`. */
export function parseTag(tag) {
    const [type = '', thread = ''] = String(tag ?? '').split(' ');
    return { type: type === '-' ? '' : type, thread };
}

/**
 * A day's lines by category (only those with lines, bookkeeping left out): `{ met, relationships, events, party, items, standing, fame, guild, reputation, news }`.
 * Takes a digest-like `{ happened, tags, met, npcs, world, cats }`: a short day's (`brief`) own `cats` are returned as they are; else the happened
 * lines are sorted by their tag's receipt type (an older day has no tags: by the shape of the text), the met names, the NPC stage lines
 * (relationships) and the world lines (news) go to theirs.
 */
export function bucketDay(day) {
    const out = {};
    const add = (cat, line) => {
        const text = flat(line);
        if (text) (out[cat] ??= []).push(text);
    };
    if (day?.brief === true && isRecord(day?.cats)) return Object.fromEntries(Object.entries(day.cats).filter(([cat, lines]) => CATEGORIES.includes(cat) && Array.isArray(lines)).map(([cat, lines]) => [cat, lines.map(flat).filter(Boolean)]));
    list(day?.met).forEach(name => add('met', name));
    list(day?.happened).forEach((line, index) => {
        const cat = classify({ type: parseTag(day?.tags?.[index]).type, text: line });
        if (cat !== 'bookkeeping' && cat !== 'places') add(cat === 'met' ? 'events' : cat, line);
    });
    list(day?.npcs).forEach(line => add('relationships', line));
    list(day?.world).forEach(line => add('news', line));
    return out;
}

const CATS_CHARS = 900;
const CATS_LINE = 80;
const CATS_PER_KIND = 40;
/** `cats` cut to about a kilobyte for a short day: each line to CATS_LINE characters, lines dropped from the end past CATS_CHARS in all. */
export function trimCats(cats) {
    const out = {};
    let used = 0;
    for (const cat of CATEGORIES) {
        for (const line of (cats?.[cat] ?? []).slice(0, CATS_PER_KIND)) {
            const text = cut(line, CATS_LINE);
            if (used + text.length > CATS_CHARS) return out;
            (out[cat] ??= []).push(text);
            used += text.length;
        }
    }
    return out;
}
