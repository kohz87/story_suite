// The job: the full text of the lore entries whose keys match the places, factions and people of a scene, within a size cap.

export const CAP_CHARS = 4000;

const norm = value => String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const hasWords = (hay, needle) => needle !== '' && ` ${hay} `.includes(` ${needle} `);
const asList = value => (Array.isArray(value) ? value : value ? [value] : []).map(norm).filter(Boolean);

/** A term matches an entry when it equals, or contains or is contained in (whole words), the entry's title or one of its keys. */
const matches = (entry, term) => [entry.title, ...entry.keys].some(label => {
    const key = norm(label);
    return key !== '' && (key === term || hasWords(term, key) || hasWords(key, term));
});

/**
 * `{ entries: [{ title, text, protected }], text, truncated }`: the entries matching the scene (`place`, `factions`, `people`), the place's first,
 * each once, their full text in the order found until `cap` characters are used (the last one that does not fit is cut at a word and
 * `truncated` is true). `text` is the entries joined as "Title: text" paragraphs; the empty scene matches nothing.
 */
export function loreFor(entries, { place, factions, people } = {}, cap = CAP_CHARS) {
    const terms = [...asList(place), ...asList(factions), ...asList(people)];
    const picked = [];
    for (const term of terms) {
        for (const entry of Array.isArray(entries) ? entries : []) if (!picked.includes(entry) && matches(entry, term)) picked.push(entry);
    }
    const out = [];
    let used = 0;
    let truncated = false;
    for (const entry of picked) {
        const room = cap - used - entry.title.length - 3;
        if (room <= 0) { truncated = true; break; }
        const whole = entry.text.length <= room;
        const body = whole ? entry.text : `${entry.text.slice(0, room).replace(/\s+\S*$/, '').trimEnd()}…`;
        out.push({ title: entry.title, text: body, protected: entry.protected });
        used += entry.title.length + body.length + 3;
        if (!whole) { truncated = true; break; }
    }
    return { entries: out, text: out.map(entry => `${entry.title}: ${entry.text}`).join('\n\n'), truncated };
}
