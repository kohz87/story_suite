// Story Director v2, part **cast**: the narrator's line of the world's own people at the scene's place (LA-2).
//
// A format 4 world cast entry (a `figure` or a `companion`) not yet met who is at the scene's place, or at its parent place, is named to the
// narrator with their role, look, manner and voice, so a scene that needs a watch-captain uses the world's own (Edda Rorke) instead of inventing a
// double, and someone the narration brings in speaks as their entry says from the first line (owner, 20 Nov: a shy healer came in brisk). Only the
// public face is told (name, role, look, the start of their personality and voice): never a secret, a history or anything gated. The line is prompt-only (never a receipt, card or
// toast), and the narration uses a name only after someone in the story says it. Someone this reply's meeting brings in is named by the meeting's
// cue (cue.js), and anyone met is known to the story, so only the unmet are here. Pure: the line is read from the state and the packs each reply,
// so a swipe, a rewind or a reload sends the same line.

import { isMet } from '../domain.js';
import { faceOf } from './face.js';
import { isPersona } from '../../../time/tracker/initiative.js';
import { movable } from '../world-parts/movable.js';
import { isSettlementKind } from '../../../scene/settlement-kind.js';

/** At most this many people on the line (each one's face is cut to size in face.js). */
export const HERE_MAX = 4;
/** Of them, at most this many at the scene's very place are told what they wear too (face.js `full`); everyone gets their whole look. */
export const HERE_FULL = 2;
const KINDS = new Set(['figure', 'companion']);

// One instruction, worded for any persona name (no verb agrees with {{user}}); the list follows it.
const HEAD = '[People here] The world\'s own people at this place or nearby, not necessarily in the scene. When the story needs someone of their role, use that person by this name rather than making up someone new; the narration uses a name only after someone in the story says it:';

// The settlement the party is in (owner, 21 Nov: "if it's a village, limit it to the village, town to town, city to city"; a district, a ward or a
// guild office is a spot inside one, not one itself; the kinds are scene/place-inside.js isSettlementKind): the place itself or the nearest place it sits in (the atlas's parents, or the "Town / Spot" a name writes
// first) that is a village, town or city; else, for a spot that is not one itself, the region the story saved it under when that region is one
// ("~ place South Granary | region: Bluewatch Village"); else none (a road, the wilds, a place with no settlement above it).
function settlementOf(here, party) {
    const chain = [here, ...here.up];
    // The nearest settlement, except a story-made "settlement" tied to a pack's village (entries.js `locator` `tie`): that village is the settlement.
    const towns = chain.filter(spot => isSettlementKind(spot.kind));
    const found = (towns[0]?.tie && towns.find(spot => spot.key === towns[0].tie)) || towns[0];
    if (found) return found.key;
    if (!party.region) return null;
    const region = party.locate(party.region);
    return region?.key && region.key !== here.key && isSettlementKind(region.kind) ? region.key : null;
}

// 0: at the scene's place itself; 1: at the settlement it is in (or, outside any settlement, its parent: the atlas's saved parent, else the
// "Town / Spot" a name writes first, else the town of the party's place line); 2: anywhere else inside that settlement; null: anywhere else.
function rankOf(where, party) {
    if (!where) return null;
    if (typeof party.locate === 'function' && !party.old) {
        const here = party.locate(party.place);
        const there = party.locate(where);
        if (!here?.key || !there?.key) return null;
        if (there.key === here.key) return 0;
        const town = settlementOf(here, party);
        if (town) return there.key === town ? 1 : there.up.some(up => up.key === town) ? 2 : null;
        const parent = here.up[0]?.key ?? (party.town ? party.locate(party.town)?.key : null);
        return parent && there.key === parent ? 1 : null;
    }
    const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
    if (same(where, party.place)) return 0;
    const town = String(party.place).includes('/') ? String(party.place).split('/')[0] : party.town || party.region;
    if (!town) return null;
    if (same(where, town)) return 1;
    return String(where).includes('/') && same(String(where).split('/')[0], town) ? 2 : null;
}

/**
 * The line for the reply being written, or '' for nobody. `frame`: `{ cast, party, present, pinned }` (hooks-parts/frame.js); `slice`: the cast
 * state as this reply's steps left it (a meeting made for this reply has marked its people met); `persona`: the player's name.
 */
export function hereLine(slice, frame, { persona = '' } = {}) {
    if (!frame?.cast?.entries?.length || !frame.party?.place) return '';
    const order = new Map(frame.cast.entries.map((entry, index) => [entry.key, index]));
    // The scene's place first, then its parent, each in the pack's order; then cut to the cap.
    const people = movable(slice, frame.cast, { present: frame.present ?? new Set(), pinned: frame.pinned ?? new Set() })
        .filter(item => KINDS.has(item.entry.raw?.kind) && !isMet(item.person))
        .filter(item => !isPersona({ key: item.key, name: item.person?.name, names: item.person?.aliases }, persona))
        .map(item => ({ ...item, rank: rankOf(item.person.where, frame.party) }))
        .filter(item => item.rank !== null)
        .sort((a, b) => a.rank - b.rank || order.get(a.key) - order.get(b.key))
        .slice(0, HERE_MAX);
    if (!people.length) return '';
    let full = 0;
    const said = people.map(({ entry, rank }) => faceOf(entry, { full: rank === 0 && full++ < HERE_FULL }));
    return `${HEAD} ${said.join('; ')}.`;
}
