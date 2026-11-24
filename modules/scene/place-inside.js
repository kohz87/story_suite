// A spot in town stays in town: a new place the story names while the party is in a settlement, with no travel, is filed inside that settlement
// ("Bluewatch Village / River-Gate Storehouse", as a "Town / Spot" line writes it) and is never a settlement itself. A "~ place River-Gate Storehouse
// | kind: settlement" is a storehouse in the village, not a second village that leaves the party's people elsewhere (owner, 22 Nov). Pure: from the
// scene's place, the map, the packs and the reply's earlier receipts, so a swipe, a Re-read or a reload files it the same way. Only a reply
// marked `placeInside` (every new reply); an older reply keeps the place as it wrote it.

import { foldKey } from '../../core/text.js';
import { MAX_NAME } from './constants.js';
import { knownPlace } from './place-known.js';
import { isSettlementKind } from './settlement-kind.js';

// What a spot in town is: a place the line may give a kind of (anything else, a wild, a dungeon or a road, is not a spot in town). Plainly in town
// (filed inside with no tie) or ambiguous (a shrine, a tower, a camp may stand in the wilds near the town: filed inside only with a tie).
const IN_TOWN = new Set(['building', 'room', 'yard', 'shop', 'inn', 'tavern', 'house', 'hall', 'office', 'storehouse', 'warehouse', 'cellar', 'stable', 'smithy', 'market', 'square', 'street', 'lane', 'barracks', 'district', 'ward', 'quarter']);
const AMBIGUOUS = new Set(['shrine', 'tower', 'garden', 'dock', 'gate', 'temple', 'mill', 'farm', 'camp', 'ruin', 'ruins']);
const words = kind => String(kind ?? '').toLowerCase().split(/[\s/,;|-]+/).filter(Boolean);
const kindIn = (kind, ...sets) => words(kind).length > 0 && words(kind).every(word => sets.some(set => set.has(word)));
const isSpotKind = kind => kindIn(kind, IN_TOWN, AMBIGUOUS);
// The first word of a name that tells one town from another ("Bluewatch" of "Bluewatch Village"); '' when it is only a common word.
const COMMON = new Set(['the', 'old', 'new', 'port', 'fort', 'saint', 'north', 'south', 'east', 'west', 'upper', 'lower', 'great', 'little', 'high', 'low', 'mount', 'black', 'silver', 'stone', 'iron', 'white', 'green', 'red', 'river', 'lake']);
export function distinctWord(name) {
    const word = foldKey(name).split(/[\s-]+/)[0] ?? '';
    return word.length >= 4 && !COMMON.has(word) ? word : '';
}
// Whether `name` starts with `town`'s own name word ("Bluewatch River-Gate Storehouse" and "Bluewatch Village"), as a whole word.
export function sharesWord(name, town) {
    const word = distinctWord(town);
    const text = foldKey(name);
    return Boolean(word) && text.startsWith(word) && (text.length === word.length || /[\s-]/.test(text[word.length]));
}
// A time jump of this many minutes in the reply is a journey.
const JOURNEY_MINUTES = 240;
const JOURNEY_LINES = new Set(['capture.route', 'capture.trip']);

// The settlement the party stands in: "Town / Spot"'s town, the place itself when it is one, else the settlement its region names. Its name, or ''.
function townOf(ctx, from) {
    const settlement = name => {
        const place = knownPlace(ctx, name);
        return place && isSettlementKind(place.kind) ? place.name || name : '';
    };
    const parts = String(from.name).split(' / ');
    if (parts.length > 1) return settlement(parts[0].trim());
    const here = knownPlace(ctx, from.name);
    if (isSettlementKind(from.kind || here?.kind)) return here?.name || from.name;
    return from.region ? settlement(from.region) : '';
}

// Whether the story travelled before this line: a trip under way, or this reply's own route or trip line or a time jump of hours.
function travelled(ctx) {
    let trip = null;
    try { trip = ctx.query('atlas.trip'); } catch { trip = null; }
    if (trip?.on && ['road', 'planned'].includes(trip.phase)) return true;
    let list = [];
    try { list = typeof ctx.receipts === 'function' ? ctx.receipts() ?? [] : []; } catch { list = []; }
    const at = ctx.carrier?.index;
    return list.some(({ index, receipt }) => index === at && (JOURNEY_LINES.has(receipt?.type)
        || (receipt?.type === 'capture.time' && Number(receipt.data?.minutes) - Number(receipt.data?.from) >= JOURNEY_MINUTES)));
}

/**
 * Where a new place the line names belongs: `{ name: 'Town / Spot', kind, town, replaced }` (`replaced`: the settlement kind the line gave, now the
 * spot's), or null to leave the line as written (a known place, a "Town / Spot" or a region that is another place, a kind that is no spot, no
 * settlement here, or a journey). `from`: the scene's place `{ name, kind, region }`; `given`: the line's `{ name, kind, region }` (null for a label left out).
 */
export function filedInside(ctx, from, given) {
    const { name, kind, region } = given;
    if (!name || name.includes('/') || (kind && !isSettlementKind(kind) && !isSpotKind(kind))) return null;
    // The spot the scene is at, written again by its own part ("River-Gate Storehouse" at "Bluewatch Village / River-Gate Storehouse"), is that place.
    const tail = String(from.name).split(' / ').slice(1).join(' / ');
    if (tail && foldKey(tail) === foldKey(name)) return { name: from.name, kind: kind && !isSettlementKind(kind) ? kind : from.kind || 'building', town: String(from.name).split(' / ')[0].trim(), replaced: Boolean(kind && isSettlementKind(kind)) };
    if (knownPlace(ctx, name) || foldKey(name) === foldKey(from.name)) return null;
    const town = townOf(ctx, from);
    if (!town || foldKey(town) === foldKey(name) || `${town} / ${name}`.length > MAX_NAME) return null;
    // A name that starts with another settlement's own name ("Bluewatch docks" while in Harrow) is a place of that settlement.
    const lead = knownPlace(ctx, name.split(/[\s-]+/)[0]);
    if (lead && isSettlementKind(lead.kind) && foldKey(lead.name) !== foldKey(town) && !sharesWord(name, town)) return null;
    // Only a plain in-town kind (building, inn, yard…) needs no tie; an ambiguous spot kind (shrine, tower…), a settlement kind or none needs one to this town:
    // its name word, or the town as the line's region.
    if (!(kind && kindIn(kind, IN_TOWN)) && !sharesWord(name, town) && foldKey(region) !== foldKey(town)) return null;
    // A region of the line that is neither the party's nor the town's puts the place somewhere else.
    if (region && ![from.region, town, knownPlace(ctx, town)?.region].some(own => own && foldKey(own) === foldKey(region))) return null;
    if (travelled(ctx)) return null;
    return { name: `${town} / ${name}`, kind: kind && !isSettlementKind(kind) ? kind : 'building', town, replaced: Boolean(kind && isSettlementKind(kind)) };
}
