// World events, open templates on the host: what the Director is told about one slot (spec §5): the template (name, summary, menu,
// writes_facts), the place, region and realm with the conditions active there, the non-protected figures nearby, and the lore: the digest's
// titles and the entries whose keys match the place. Hidden lore is never sent. Pure on `ws` and the query answers handed in.

import { conditionHolds } from '../../daily/holds-read.js';
import { placeOf } from '../../daily/cast-where.js';
import { resolveRef } from '../../daily/geo.js';

const DAY = 1440;
const MAX_FIGURES = 12;
const MAX_LORE_CHARS = 2400;
const MAX_TITLES = 40;

/** The conditions active at the slot's place, region and realm: ["name at ref: means"]. */
function conditionsAt(ws, slot, means) {
    const out = [];
    for (const ref of [slot.place, slot.region, slot.realm].filter(Boolean)) {
        for (const name of [...ws.declared.keys()].sort()) {
            if (ws.table[`${name}@${ref}`] && conditionHolds(ws, name, ref, ws.day * DAY)) out.push(`${name} at ${ref}${means.get(name) ? `: ${means.get(name)}` : ''}`);
        }
    }
    return out;
}

/** The slot's view for `slotBlock`. `def` is the template's definition, `rawName` its pack name. */
export function slotView(ws, def, slot, world) {
    const means = new Map((Array.isArray(world.conditions) ? world.conditions : []).map(row => [row.name, row.means]));
    const figures = def.open.menu.cast
        ? [...ws.people.values()].filter(person => person.kind === 'figure' && !person.protected && ws.cast[person.id]?.died === undefined)
            .filter(person => resolveRef(ws.geo, placeOf(ws, person.id))?.place?.region === slot.region)
            .slice(0, MAX_FIGURES).map(person => `${person.id} (${person.name}, at ${placeOf(ws, person.id)})`)
        : [];
    return { name: def.id, summary: def.summary, menu: def.open.menu, facts: def.open.facts, ...(def.open.arc ? { arc: def.open.arc } : {}), conditions: conditionsAt(ws, slot, means), figures };
}

/** The lore text for a batch: the digest's titles, then the matching entries for each slot, cut to a size. `ask(name, args)` is the view's query. */
export function loreText(ask, slots, world) {
    const norm = title => String(title ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    const hidden = new Set((Array.isArray(world.lore) ? world.lore : []).filter(entry => entry?.hidden === true).map(entry => norm(entry.title ?? entry.name)).filter(Boolean));
    const shown = title => !hidden.has(norm(title));
    let digest = null;
    try { digest = ask('director.loreDigest', {}); } catch { digest = null; }
    const titles = (Array.isArray(digest?.lines) ? digest.lines : []).map(line => line.title).filter(shown).slice(0, MAX_TITLES);
    const parts = titles.length ? [`Titles: ${titles.join('; ')}`] : [];
    const seen = new Set();
    for (const slot of slots) {
        let found = null;
        try { found = ask('director.loreFor', { place: slot.place, factions: [slot.region, slot.realm].filter(Boolean) }); } catch { found = null; }
        for (const entry of Array.isArray(found?.entries) ? found.entries : []) {
            if (shown(entry.title) && !seen.has(entry.title)) { seen.add(entry.title); parts.push(`${entry.title}: ${entry.text}`); }
        }
    }
    return parts.join('\n').slice(0, MAX_LORE_CHARS);
}
