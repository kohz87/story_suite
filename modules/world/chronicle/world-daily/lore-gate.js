// World events (switch story-director.world-events; spec §7): whether a hidden lore entry is open, read from stored state only. An entry
// is open when a reply already opened it (the ledger anchor `opened:lore/<key>`, written by lore-open.js after that reply) or when its
// gate holds now against the anchors the world has recorded (`fired:`, `fact:`, `learned:`, …) and the scene's place. Pure.
// `place:<id>` holds at that pack place (its id, name or an alias) or a spot under it ("Highmark Capital / Crown Keep / Throne Room").
// `stage`, `meter` and `quote:` terms are not read in a lore gate (false), so such a term never opens an entry by mistake.

export const OPENED = 'opened:lore/';
const JOIN = /\s+(?:and|or)\s+(?=(?:fired|ended|set|cleared|lapsed|died|departed|fact|learned|place|quote):|stage\b|meter\b)/g;
const slug = text => String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
const list = value => (Array.isArray(value) ? value : []);

/** The entry's key in `opened:lore/<key>`: its `id`, else its title slugged. */
export const loreKey = entry => (typeof entry?.id === 'string' && entry.id.trim() ? entry.id.trim() : slug(entry?.title));

// Whether the scene's place text is pack place `id` or a spot under it (each " / " prefix of the scene's name is tried).
function atPlace(id, scene, places) {
    const place = list(places).find(item => item?.id === id);
    const whole = new Set([id, place?.name].map(slug).filter(Boolean));
    const parts = String(scene ?? '').split('/').map(part => part.trim()).filter(Boolean);
    const prefixes = parts.map((_, at) => slug(parts.slice(0, at + 1).join(' / ')));
    if (prefixes.some(text => whole.has(text))) return true;
    return list(place?.aliases).some(alias => slug(alias) && slug(alias) === slug(scene));
}

/** Whether `gate` holds: `known` = { anchors: Set of anchor keys, place: the scene's place text, places: the pack's places }. `and` binds tighter than `or`. */
export function loreGateHolds(gate, known = {}) {
    if (typeof gate !== 'string' || !gate.trim()) return false;
    const text = gate.trim();
    const bounds = [...text.matchAll(JOIN)].map(match => match[0].trim());
    const groups = [[]];
    text.split(JOIN).forEach((term, at) => {
        groups.at(-1).push(term.trim());
        if (bounds[at] === 'or') groups.push([]);
    });
    const anchors = known.anchors instanceof Set ? known.anchors : new Set();
    const holds = term => (term.startsWith('place:') ? atPlace(term.slice(6).trim(), known.place, known.places)
        : /^(?:stage|meter)\b|^quote:/.test(term) ? false : anchors.has(term));
    return groups.some(group => group.length > 0 && group.every(holds));
}

/** The hidden entries of `lore` that are open, in the pack's order: opened by a reply (`opened:lore/<key>` in `known.anchors`) or their gate holds now. */
export function openLore(lore, known = {}) {
    const anchors = known.anchors instanceof Set ? known.anchors : new Set();
    return list(lore).filter(entry => entry?.hidden === true && (anchors.has(`${OPENED}${loreKey(entry)}`) || loreGateHolds(entry.gate, known)));
}
