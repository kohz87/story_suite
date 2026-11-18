// Story Director v2, atlas part: where a trip sets out from when the scene's place is not on a road (LF4-3, LF4B2).
// The narrator's own place ("Frontier Road south of Bluewatch") has no route, so the trip starts from the pack place its name
// stands for: the name itself, its town part ("Auvoth / Guild Grand Hall") or the place it names ("… south of Bluewatch",
// "X (Y)"), read against the pack's places alone. It never reads the atlas's visits, saved parents or the scene's region: those
// come from system steps (beforeGenerate's `atlas.visit`) that an edited Re-read keeps from the old text, so the same lines told
// again would set out from somewhere else. The pack and the story's own route lines are all it reads.

import { parseLocation } from '../places.js';
import { initialAtlas, keyOf } from './domain.js';
import { parentOf } from './parent.js';
import { packPlace, worldOf } from './world.js';

// A road the narrator names inside a region ("Bluewatch Reach / Frontier Road"): the one pack place in that region that a pack road of that kind
// ("frontier road") joins, or null when there are none or several. Read from the name, the pack's roads and places alone (LF4-3 rest).
function roadStart(pack, name, regions) {
    const cut = String(name ?? '').match(/^(.+?)\s*\/\s*(.+)$/);
    if (!cut) return null;
    const head = keyOf(cut[1]);
    const row = (Array.isArray(regions) ? regions : []).find(item => [item?.id, item?.name, ...(Array.isArray(item?.aliases) ? item.aliases : [])].some(word => typeof word === 'string' && keyOf(word) === head));
    if (!row || typeof row.id !== 'string') return null;
    const road = keyOf(cut[2].replace(/^the\s+/i, ''));
    const ends = new Map();
    for (const route of pack?.routes ?? []) {
        if (!route.kind || keyOf(route.kind) !== road) continue;
        for (const end of [packPlace(pack, route.from), packPlace(pack, route.to)]) if (end && keyOf(end.region) === keyOf(row.id)) ends.set(end.key, end);
    }
    return ends.size === 1 ? [...ends.values()][0] : null;
}

const joined = (world, id) => world.routes.some(route => route.from === id || route.to === id);

// The pack place a name stands for by its words alone, or null.
function packFor(pack, name, regions) {
    const packs = worldOf(initialAtlas(), pack);
    const inPack = place => (place && packPlace(pack, place.name) ? place : null);
    const raw = String(name ?? '').trim();
    const own = inPack(packs.find(raw) ?? packs.find(raw.replace(/^the\s+/i, '')));
    if (own) return own;
    const town = parseLocation(raw).name.trim();
    return (town && keyOf(town) !== keyOf(raw) ? inPack(packs.find(town)) : null) ?? inPack(parentOf(raw, packs)?.parent ?? null) ?? roadStart(pack, raw, regions);
}

/** `startNode(world, pack, name)` → the world place a trip from `name` starts at: the place itself when a road joins it, else the pack place its name stands for (`regions`: the packs' regions, for a road named inside one) when a road joins that, else the place (or null). */
export function startNode(world, pack, name, regions = []) {
    const own = world.find(name);
    if (own && joined(world, own.id)) return own;
    const stands = packFor(pack, name, regions);
    const node = stands ? world.find(stands.name) : null;
    if (node && joined(world, node.id)) return node;
    return own ?? null;
}
