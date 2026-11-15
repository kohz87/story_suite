// The two checks code makes on a safety-net line: a time needs a clock time, and a place must not be a known place under an invented name.

import { clip, fold } from './shared-text.js';
import { knownPlace, sides, whole } from './places.js';
import { NAME_CHARS } from './near.js';

// Words that say what kind of place it is, not which: two names sharing only these are two places.
const GENERIC = new Set(['the', 'of', 'and', 'at', 'in', 'on', 'to', 'for', 'old', 'new', 'north', 'south', 'east', 'west', 'upper', 'lower',
    'great', 'little', 'high', 'low', 'village', 'town', 'city', 'road', 'street', 'lane', 'inn', 'tavern', 'house', 'hall', 'gate', 'bridge',
    'market', 'square', 'camp', 'fort', 'tower', 'keep', 'temple', 'church', 'shop', 'store', 'guild', 'office', 'branch', 'room', 'yard',
    'district', 'quarter', 'forest', 'river', 'lake', 'hill', 'hills', 'mountain', 'pass', 'path', 'trail', 'farm', 'mill', 'harbor', 'harbour']);
const tokens = text => fold(text).split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= 3);
const words = text => tokens(text).filter(word => !GENERIC.has(word));

// A clock time written with digits: 9:30, 09:30 am, 9 pm, 21:05.
// (9.30 am too, and the two words that name one exact time: noon and midnight.)
const CLOCK = /(?<![\p{L}\d:.])(?:(?:[01]?\d|2[0-3])[:.][0-5]\d|(?:1[0-2]|0?[1-9])\s?[ap]\.?m\.?|noon|midnight)(?![\p{L}\d])/iu;
// A stretch of time moving the clock on: +2h, 30 minutes, an hour, half an hour.
const STRETCH = /^\+?\s*(?:\d+(?:\.\d+)?|an?|half(?:\s+an?)?|one)\s*(?:minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w)\b/i;

/** Whether `text` holds a clock time (9:30 am, 21:05, 9 pm). */
export const hasClockTime = text => CLOCK.test(String(text ?? ''));

/**
 * Why `line` (parsed: { op, kind, name, text }) may not run as a safety-net line, or '': a `time` line that sets the time of
 * day needs a clock time ("midday", "mid-morning" are not times; "+2h" moves it on and needs none); a `place` line whose name is
 * not one the map answers to but is made only of words one of the map's places has (apart from words like "village" and "guild")
 * is the same place under an invented name.
 * `places` (mapPlaces) may be empty: then only the time is checked. `here`: the scene's place name, always a known name.
 */
export function whereWhy(line, { places = [], here = '' } = {}) {
    const kind = String(line?.kind ?? '').toLowerCase();
    if (kind === 'time' && ['~', '!', '+'].includes(line?.op)) {
        const said = [line?.name, line?.text].filter(part => typeof part === 'string' && part.trim()).join(' ').trim();
        if (STRETCH.test(said) || hasClockTime(said)) return '';
        return `"${clip(said, 60) || 'time'}" has no clock time; write a time like "~ time Goldwane 12, 9:30 am" or "! time +2h" ("midday" and "mid-morning" are not times)`;
    }
    if (kind === 'place' && places.length) {
        const name = String(line?.name ?? '').replace(/\s+/g, ' ').trim();
        if (!name || fold(name) === fold(here) || knownPlace(places, name)) return '';
        // The same place under another name: every distinctive word of the name is one the map's place has too ("Bluewatch Guild
        // Branch" for "Bluewatch Village / Guild Office"). A name with a word of its own ("Auvoth Docks" beside "Auvoth") is a new place.
        const mine = words(name);
        if (mine.length) {
            // (the one that shares the most of the name's words, even the plain ones, and then the shortest name)
            const theirs = place => new Set([place.name, ...place.aliases].flatMap(tokens));
            const shares = place => { const set = theirs(place); return tokens(name).filter(word => set.has(word)).length; };
            // Not when it shares only one word with it and says more ("Silver Lake" beside "Silver Mine" is another place; "Bluewatch"
            // alone is still "Bluewatch Village"), nor when it holds the
            // place's whole name or a side of it and says more ("Silver Mine Road", "Kestrel Pass Outpost": a spot at or by it).
            const phrase = text => ` ${tokens(text).join(' ')} `;
            const holds = place => [...sides(place), ...whole(place)].some(side => tokens(side).length && phrase(name).includes(phrase(side)));
            const found = places.filter(place => { const set = new Set([place.name, ...place.aliases].flatMap(words)); return mine.every(word => set.has(word)); })
                .filter(place => { const set = theirs(place); return (shares(place) >= 2 || tokens(name).every(word => set.has(word))) && !holds(place); })
                .sort((a, b) => (shares(b) - shares(a)) || (a.name.length - b.name.length))[0];
            if (found) return `"${clip(name, 60)}" is not a place name on the map; the map calls this place "${clip(found.name, NAME_CHARS)}"`;
        }
    }
    return '';
}
