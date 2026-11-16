// Records of one content kind from every enabled pack, and the merged craft table.

import { CONTENT_KINDS, DEFAULT_CRAFTS } from '../limits.js';
import { copy, shared } from './shared-copy.js';

/**
 * Records of one kind from every enabled pack, in pack order then file order.
 * `kind`: a content kind (items, creatures, shops, recipes, events, quests, races, talents,
 * skills, presets, places, routes, terms: `{ id, slug, pack, name?, levelName?, xpName?, tiers? }`, the
 * words a world uses for levels and XP, MODULES §F25; ranks: `{ id, pack, title?, levels?, reward?, xp? }`,
 * each pack's ladder lowest first, so a reader takes one pack's ranks; crafts: `{ id, slug, pack, title,
 * stats, stations, note? }`, see craftsOf for the merged table; meterPresets: `{ id, slug, pack, title,
 * meters, stages? }`, ready-made NPC meter sets; cast: `{ id, pack, packVersion, name, aliases, about, look, wears?, voice?, personality?, behaviour?, mannerisms?, withYou?, history?,
 * portrait?, birthday?, start: { place, goal, routine? }, drawnTo?, meters?, stages?, fields?, secrets?, canDieUnmet? }`, the hand-written people of cast.js, `id` their own
 * slug in the pack),
 * `currency` (one `{ pack, name, short }` per pack that suggests one), `layouts`,
 * `screens` (each with its `pack`), or `theme` (one `{ pack, tokens }` per pack that has a
 * theme). Unknown kinds give [].
 * `pack` narrows to one pack id.
 * The records are the packs' own, frozen (not copies): copy one before editing it.
 */
export function contentOf(packs, kind, { pack = null } = {}) {
    if (kind === 'currency') return shared(packs.filter(entry => entry.currency && (!pack || entry.id === pack)).map(entry => ({ pack: entry.id, ...entry.currency })));
    const chosen = pack ? packs.filter(entry => entry.id === pack) : packs;
    // The cast: each person with the version of the pack that gave them (a newer version changes who is new and who changed).
    if (kind === 'cast') return shared(chosen.flatMap(entry => (entry.content.cast ?? []).map(person => ({ ...person, packVersion: entry.version }))));
    if (CONTENT_KINDS.includes(kind)) return shared(chosen.flatMap(entry => entry.content[kind] ?? []));
    if (kind === 'layouts' || kind === 'screens') return shared(chosen.flatMap(entry => entry[kind]));
    if (kind === 'theme') return shared(chosen.filter(entry => Object.keys(entry.theme).length).map(entry => ({ pack: entry.id, tokens: entry.theme })));
    return [];
}

/**
 * The craft table crafting reads (MODULES §F102): the default crafts with the enabled packs' `crafts`
 * laid over them, as `[{ craft, title, stats, stations, note?, pack }]`. `craft` is the id recipes
 * write ('alchemy'); `pack` is null for a default. A pack's craft with a default's id replaces it in
 * place; a new id is added after the defaults, in pack order. When two packs declare the same craft,
 * the pack earlier in the list wins, as for items.
 */
export function craftsOf(packs) {
    const table = new Map(DEFAULT_CRAFTS.map(craft => [craft.craft, { ...copy(craft), pack: null }]));
    const taken = new Set();
    for (const pack of packs) {
        for (const craft of pack.content.crafts ?? []) {
            if (taken.has(craft.slug)) continue;
            taken.add(craft.slug);
            table.set(craft.slug, { craft: craft.slug, title: craft.title, stats: [...craft.stats], stations: [...craft.stations], ...(craft.note ? { note: craft.note } : {}), pack: pack.id });
        }
    }
    return [...table.values()];
}
