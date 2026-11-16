// Story Director v2, part **cast**: reading enabled pack cast entries and matching pack places.

import { hashJson } from '../../../world/hash.js';
import { MAX_ALIASES, MAX_NAME, MAX_PEOPLE, MAX_PLACE, cutPoints, isRecord, keyOf, personKey } from '../domain.js';
import { shortName } from './pack-names.js';
import { ask } from './query.js';

const SLUG = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

/**
 * One listed entry as the world reads it, or null when it is not one: `{ key, pack, id, name, aliases, ver, place, goal, routine,
 * drawnTo, canDieUnmet, calling, about, raw }` (text cut and flattened; `raw` the entry as listed, for the narrator's cue and other modules, never stored).
 */
export function readEntry(raw) {
    if (!isRecord(raw)) return null;
    const pack = typeof raw.pack === 'string' ? raw.pack.trim() : '';
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    const name = cutPoints(raw.name, MAX_NAME);
    if (!SLUG.test(pack) || !SLUG.test(id) || !keyOf(name)) return null;
    const start = isRecord(raw.start) ? raw.start : {};
    const aliases = [];
    for (const alias of Array.isArray(raw.aliases) ? raw.aliases : []) {
        const clean = cutPoints(alias, MAX_NAME);
        if (keyOf(clean) && keyOf(clean) !== keyOf(name) && !aliases.some(other => keyOf(other) === keyOf(clean))) aliases.push(clean);
        if (aliases.length >= MAX_ALIASES) break;
    }
    return {
        key: personKey(pack, id), pack, id, name, aliases,
        ver: cutPoints(raw.packVersion, MAX_NAME),
        place: cutPoints(start.place, MAX_PLACE),
        goal: cutPoints(start.goal, 160),
        routine: cutPoints(start.routine, 160),
        drawnTo: (Array.isArray(raw.drawnTo) ? raw.drawnTo : []).map(phrase => cutPoints(phrase, 80)).filter(Boolean).slice(0, 6),
        canDieUnmet: raw.canDieUnmet === true,
        // What the reader can seek a person by (sought.js): their calling and who they are, never read by anyone but the planner and the rumor.
        calling: cutPoints(isRecord(raw.fields) ? raw.fields.Calling : '', 100),
        about: cutPoints(raw.about, 400),
        // What the entry says, not which version of the pack it came in: a bump with nothing changed is no change.
        sig: (({ pack: _pack, packVersion: _version, ...own }) => hashJson(own).slice(0, 12))(raw),
        raw,
    };
}

// ---- the pack's places ------------------------------------------------------------------------------------------------------------

const placeKey = value => keyOf(String(value ?? '').replace(/\s*\/\s*/g, ' / '));

/**
 * The pack's places as a matcher: `{ any, match(text) }`. A cast member's `start.place` is written as a place's name, its slug or one of
 * its aliases (any case); `match` gives the place's own name, or null when none fits. `any`: the packs list places at all (when they do
 * not, nothing can be said against a place as written).
 */
export function placeMatcher(query) {
    const list = ask(query, 'packs.content', { kind: 'places' }, null);
    const byKey = new Map();
    for (const place of Array.isArray(list) ? list : []) {
        if (!isRecord(place) || typeof place.name !== 'string') continue;
        const name = cutPoints(place.name, MAX_PLACE);
        const slug = typeof place.id === 'string' ? place.id.slice(place.id.lastIndexOf('/') + 1) : typeof place.slug === 'string' ? place.slug : '';
        for (const word of [name, slug, ...(Array.isArray(place.aliases) ? place.aliases : [])]) {
            const key = placeKey(word);
            if (key && !byKey.has(key)) byKey.set(key, name);
        }
    }
    return { any: byKey.size > 0, match: text => byKey.get(placeKey(text)) ?? null };
}

/**
 * The cast the enabled packs list: `{ listed, entries, byKey, packs }`. `listed`: whether the packs could be asked at all (a missing
 * or throwing query is no answer: nobody is dropped on silence). `entries`: in the packs' order, a key once. `packs`: the enabled
 * packs, `{ id: { name, version } }` (from the entries, and `packs.list` when it answers); `enabled`: their ids (a disabled pack is
 * not in it, so its people are kept as they are, hidden, until it is enabled again).
 */
export function castOf(query) {
    const out = { listed: false, entries: [], byKey: new Map(), packs: {}, enabled: new Set(), places: { any: false, match: () => null } };
    const list = ask(query, 'packs.content', { kind: 'cast' }, null);
    if (!Array.isArray(list)) return out;
    out.listed = true;
    for (const raw of list) {
        const entry = readEntry(raw);
        if (!entry || out.byKey.has(entry.key) || out.entries.length >= MAX_PEOPLE) continue;
        out.entries.push(entry);
        out.byKey.set(entry.key, entry);
        out.packs[entry.pack] ??= { name: entry.pack, version: entry.ver };
        out.enabled.add(entry.pack);
    }
    // Where each person starts, as the pack's place (by name, slug or alias). A place the pack does not have leaves them unplaced ('') until the
    // planner places them; with no places to check against it stays as written.
    const places = placeMatcher(query);
    out.places = places;
    for (const entry of out.entries) entry.place = places.any ? places.match(entry.place) ?? '' : entry.place;
    const installed = ask(query, 'packs.list', {}, null);
    for (const pack of Array.isArray(installed) ? installed : []) {
        if (!isRecord(pack) || typeof pack.id !== 'string') continue;
        if (pack.enabled === false) continue;
        const name = shortName(cutPoints(pack.name, MAX_NAME));
        // The version the entries were listed at wins (they are the pack's own); the pack list's fills in where they give none.
        out.packs[pack.id] = { name: name || pack.id, version: out.packs[pack.id]?.version || cutPoints(pack.version, MAX_NAME) };
        out.enabled.add(pack.id);
    }
    return out;
}
