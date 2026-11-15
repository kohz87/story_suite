// Story Director v2, world: the Here view, the scene's place, who is present, their stance and their thought.

import { lineKey } from '../../../changes.js';
import { parseLocation } from '../../../places.js';
import { queryOf, tryQuery } from './query.js';
import { isRecord, text, cut } from './shared-text.js';

// Story Block's own limit on its "Most chatter lines per reply" setting (CHATTER_LIMIT, MODULES §F115). `chatter.head`
// already holds only as many lines as the reader's setting allowed (3 unless set), so this is only a safety bound:
// it must not be lower than the setting, or the last people's cards lose their thought.
const MAX_THOUGHTS = 10;
// A thought on the World tab is cut to this many code points: the same as Story Block's CHATTER_CHARS (extras.js).
const THOUGHT_CHARS = 240;

/** The stance a chip shows for one NPC from NPC State Delta's meters: its ladder rank, else its disposition, else a stage. */
function stanceOf(entry) {
    if (!isRecord(entry)) return '';
    if (text(entry.rank)) return cut(entry.rank, 40);
    if (text(entry.disposition)) return cut(entry.disposition, 40);
    const stages = isRecord(entry.stages) ? Object.values(entry.stages).map(text).filter(Boolean) : [];
    return stages.length ? cut(stages[0], 40) : '';
}

/**
 * `director.world.here` → `{ place: { name, line, region, kind } | null, moved, weather, present: [name], people: [{ name,
 * stance, dossier, key, thought }], chatter: [{ key, name, text }], nsd, hasPeople }`. `present` is Story
 * Block's scene list (NPC State Delta reads it to know who is here); `people` adds, when NPC State Delta
 * answers (`npc.known`), each one's stance and whether they have a dossier. Without it the names stand
 * alone (`nsd: false`, no stance). `moved`: the newest reply moved the scene here (Story Block's
 * `scene.moved`). `weather`: the day's weather (Story Block's `scene.weather`: the story's `~ weather` or the
 * rule's own), '' while there is none or the weather is off. `chatter`: the newest reply's Inner chatter
 * (Story Block's `chatter.head`; empty while it is off), one thought per thinker (their last line), each
 * under `key`: the dossier's name when NPC State Delta knows the name or alias (`npc.dossier`, as the chatter
 * strip links a dossier), else the name, folded (lineKey); a person's `thought` is the one under their key
 * (MODULES §F119).
 */
export function hereView(state, _args, tools) {
    const query = queryOf(tools);
    const atlas = tryQuery(query, 'atlas.here', {}, null);
    const scenePlace = tryQuery(query, 'scene.place', {}, null) ?? state?.domains?.scene?.place ?? null;
    const name = text(atlas?.name) || text(scenePlace?.name);
    // `line`: "Town · Spot", the map's own place line (`atlas.here`, else `atlas.line` on the scene's name); with no atlas, the scene's "Town | Spot" split.
    const sceneName = text(scenePlace?.name);
    let line = text(atlas?.line) || (sceneName ? text(tryQuery(query, 'atlas.line', { name: sceneName }, '')) : '');
    if (!line) {
        const where = parseLocation(sceneName);
        line = where.name && where.spot ? `${where.name} · ${where.spot}` : name;
    }
    const place = name ? { name: cut(name, 80), line: cut(line, 120), region: cut(text(atlas?.region) || text(scenePlace?.region), 80), kind: cut(text(atlas?.kind) || text(scenePlace?.kind), 40) } : null;
    const moved = Boolean(place) && tryQuery(query, 'scene.moved', {}, false) === true;
    // Story Block's Scene tab shows the weather and World replaces that tab, so Here must too (MODULES §F119/§F122).
    const weather = cut(text(tryQuery(query, 'scene.weather', {}, null)?.text), 80);
    const listed = tryQuery(query, 'scene.present', {}, null) ?? state?.domains?.scene?.present ?? [];
    const present = [];
    const seen = new Set();
    for (const entry of Array.isArray(listed) ? listed : []) {
        const who = cut(entry, 80);
        const key = lineKey(who);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        present.push(who);
    }
    const known = tryQuery(query, 'npc.known', {}, null);
    const nsd = Array.isArray(known);
    // One dossier lookup per name: the dossier (or null) and the key the name goes by.
    const dossiers = new Map();
    const dossierOf = who => {
        if (!nsd) return null;
        if (!dossiers.has(who)) dossiers.set(who, tryQuery(query, 'npc.dossier', { name: who }, null));
        return dossiers.get(who);
    };
    const keyOf = who => lineKey(text(dossierOf(who)?.name) || who);
    const thoughts = new Map();
    const lines = tryQuery(query, 'chatter.head', {}, null);
    for (const item of Array.isArray(lines) ? lines.slice(0, MAX_THOUGHTS) : []) {
        const who = cut(item?.name, 40);
        const thought = cut(item?.text, THOUGHT_CHARS);
        const key = who ? keyOf(who) : '';
        if (!key || !thought) continue;
        thoughts.delete(key);
        thoughts.set(key, { key, name: who, text: thought });
    }
    const people = present.map(who => {
        const key = keyOf(who);
        const thought = thoughts.get(key)?.text ?? '';
        if (!nsd) return { name: who, stance: '', dossier: false, key, thought };
        const dossier = Boolean(dossierOf(who));
        return { name: who, stance: dossier ? stanceOf(tryQuery(query, 'npc.meters', { name: who }, null)) : '', dossier, key, thought };
    });
    return { place, moved, weather, present, people, chatter: [...thoughts.values()], nsd, hasPeople: people.length > 0 };
}
