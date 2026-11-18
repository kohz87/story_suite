// The Studio's parts: which pack keys each screen shows, in nav order, and which part a checker problem's path belongs to.
//
// One table for the whole Studio (nav, phone list, counts, Problems grouping, Go to). Format 3 kinds and the world-pack kinds of
// spec v0.14.11 are both listed; a pack shows only the parts it has, plus Overview and Problems. Pack format 4's world/game split
// comes in here as data.

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// `keys`: content kinds (under `content`); `top`: top-level pack fields. Each key is shown as its own section of the part.
export const PARTS = Object.freeze([
    { id: 'overview', name: 'Overview', group: 'Pack', icon: '◎', desc: 'Name, version and what it needs', top: ['id', 'format', 'version', 'name', 'author', 'description', 'requires'], keys: [], always: true },
    { id: 'lore', name: 'Lore', group: 'World', icon: '✎', desc: 'Entries, keys, hidden and protected', keys: ['lore'] },
    { id: 'cast', name: 'Cast', group: 'World', icon: '♥', desc: 'People NPC State starts from', keys: ['cast'] },
    { id: 'map', name: 'Places & routes', group: 'World', icon: '◍', desc: 'Places, routes, regions, realms', keys: ['places', 'routes', 'regions', 'realms', 'placeKinds', 'routeKinds', 'markets'] },
    { id: 'conditions', name: 'Conditions', group: 'World', icon: '◐', desc: 'World states and the starting world', keys: ['conditions', 'start'] },
    { id: 'events', name: 'Events', group: 'World', icon: '✦', desc: 'World events and legacy dated events', keys: ['worldEvents', 'events'] },
    { id: 'templates', name: 'Templates', group: 'World', icon: '❖', desc: 'Kinds of small happening', keys: ['templates'] },
    { id: 'powers', name: 'Powers & scores', group: 'World', icon: '⚖', desc: 'Factions, rulers and world meters', keys: ['powers', 'scores'] },
    { id: 'items', name: 'Items & foes', group: 'World', icon: '▣', desc: 'Named items and the bestiary', keys: ['items', 'foes'] },
    { id: 'other', name: 'Other', group: 'Pack', icon: '⚙', desc: 'Settings-side fields, as written', top: ['currency', 'economy', 'calendar', 'weather', 'ripples', 'start', 'layouts', 'screens', 'theme'], keys: [], rest: true },
    { id: 'problems', name: 'Problems', group: 'Check', icon: '⚠', desc: 'What the pack checker says', keys: [], always: true },
]);

const BY_KEY = new Map(PARTS.flatMap(part => part.keys.map(key => [key, part.id])));
const BY_TOP = new Map(PARTS.flatMap(part => (part.top ?? []).map(key => [key, part.id])));

/** The content kinds a pack holds that no part names (they show under Other). */
function restKinds(content) {
    return isObject(content) ? Object.keys(content).filter(key => !BY_KEY.has(key)) : [];
}

/**
 * The parts to show for a parsed pack (`doc`, or null): `[{ ...part, sections: [{ key, label, value, count }], count }]`.
 * A part with nothing in the pack is left out unless it is `always` shown.
 */
export function partsOf(doc) {
    const content = isObject(doc?.content) ? doc.content : {};
    const out = [];
    for (const part of PARTS) {
        const sections = [];
        for (const key of part.keys) if (content[key] !== undefined) sections.push({ key, where: 'content', value: content[key] });
        if (part.rest) for (const key of restKinds(content)) sections.push({ key, where: 'content', value: content[key] });
        if (part.id === 'other') for (const key of part.top) if (doc?.[key] !== undefined) sections.push({ key, where: 'top', value: doc[key] });
        const counted = sections.map(section => ({ ...section, count: Array.isArray(section.value) ? section.value.length : (isObject(section.value) ? Object.keys(section.value).length : 1) }));
        if (!counted.length && !part.always) continue;
        out.push({ ...part, sections: counted, count: counted.reduce((sum, section) => sum + section.count, 0) });
    }
    return out;
}

/**
 * The part a checker path belongs to, and the record in it: `content.cast[3].secrets[1]` → `{ part: 'cast', rec: 'cast.3' }`,
 * `requires.storyBlock` → `{ part: 'overview', rec: null }`. Paths the table does not know go to Overview (top) or Other (content).
 */
export function partOfPath(path) {
    const text = String(path ?? '');
    const kind = /^content\.([A-Za-z]+)(?:\[(\d+)\])?/.exec(text);
    if (kind) return { part: BY_KEY.get(kind[1]) ?? 'other', rec: kind[2] !== undefined ? `${kind[1]}.${kind[2]}` : null };
    const top = /^([A-Za-z]+)/.exec(text);
    if (top && BY_TOP.has(top[1])) return { part: BY_TOP.get(top[1]), rec: null };
    return { part: top && top[1] !== 'content' ? 'other' : 'overview', rec: null };
}
