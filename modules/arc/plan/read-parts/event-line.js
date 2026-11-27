// Story Director v2, part **arc**: the planner's `EVENT:` line (switch story-director.world-events; ARCAUDIT §5 "the arc plan may emit EVENT:
// lines with cited causes"): `EVENT: Title — what happens | where: <place> | on: <date> | because: <cause>; <cause>`. Read only while the plan
// reader is given the world (`world`, the controller's world check, null while the switch is off: the label is then no plan label). Code has the
// last word: `where` must be a place the map knows; each cause must be a record the world holds (an Active or coming world event, a condition, a
// Journal entry, a tracked thread); a line with no such cause or no known place is left out. What is kept is a BEAT (the tracker's own kind, so
// nothing new reaches the accept command), its place the map's name and its words ending with the causes it cites. Pure.

import { lineKey } from '../../../world/changes.js';
import { DESC_POINTS, KEY_POINTS, flat, part } from '../shared.js';
import { finder } from './cite-match.js';

/** The most EVENT lines one plan keeps (each is also one of its beats). */
export const EVENT_CAP = 2;
const MAX_CAUSES = 3;
const SPLIT = /\s*[;,]\s*/;
const HELD = /^\u0000(\d+)$/;
// A typed apostrophe for a curly one, and "/" for the "|" the brief prints as "/" (one for one, so places in the text stay).
const plain = text => text.toLowerCase().replace(/[’‘]/g, "'").replace(/\|/g, '/');
// A piece is matched whole: a name's cut could fall inside a name the piece only begins with.
const PIECE_POINTS = 1000;

const WORD = /[\p{L}\p{N}]/u;
// Whole characters, never half of one: a letter outside the basic plane is two code units.
const firstOf = text => String.fromCodePoint(text.codePointAt(0) ?? 32);
const lastOf = text => [...text.slice(-2)].at(-1) ?? '';
/** Where `form` stands in `text` as words of its own (never from inside a longer word), else -1. */
function standing(text, form) {
    for (let at = text.indexOf(form); at >= 0; at = text.indexOf(form, at + 1)) {
        const end = at + form.length;
        if (!(WORD.test(firstOf(form)) && WORD.test(lastOf(text.slice(0, at)))) && !(WORD.test(lastOf(form)) && WORD.test(firstOf(text.slice(end))))) return at;
    }
    return -1;
}

/** The names asked for in `because:`. A known name with a comma or semicolon of its own (an event named by its summary) is taken whole. */
function asked(because, causes) {
    const held = [];
    let said = String(because ?? '').replace(/\u0000/g, '');
    // A cut two names share is no way to take either whole.
    const cut = causes.map(name => plain(flat(name, KEY_POINTS)));
    const forms = causes.flatMap((name, at) => [[name, name], ...(cut.indexOf(cut[at]) === cut.lastIndexOf(cut[at]) ? [[flat(name, KEY_POINTS), name]] : [])]).filter(([form]) => /[;,]/.test(form)).sort(([a], [b]) => b.length - a.length);
    for (const [form, name] of forms) {
        const at = standing(plain(said), plain(form));
        if (at < 0) continue;
        said = `${said.slice(0, at)};\u0000${held.push(name) - 1};${said.slice(at + form.length).replace(/^[^;,]*/, '')}`;
    }
    return said.split(SPLIT).map(text => (HELD.test(text.trim()) ? held[Number(HELD.exec(text.trim())[1])] : flat(text, PIECE_POINTS))).filter(Boolean);
}

/** `[[start, name]]`: a name with a comma or semicolon may be cited up to the first one, when no other known name starts that way. */
function starts(names) {
    return names.filter(name => /[;,]/.test(name)).flatMap(name => {
        const start = name.split(/[;,]/)[0];
        const id = lineKey(start);
        const sharing = names.filter(other => `${lineKey(other)} `.startsWith(`${id} `));
        return id && sharing.length === 1 ? [[start, name]] : [];
    });
}

/** The words a kept line ends with: the causes, each cut to a name's length, as many as leave the description room. */
function tailOf(causes) {
    const names = causes.map(name => part(name, KEY_POINTS));
    while (names.length > 1 && [...names.join('; ')].length > DESC_POINTS / 2) names.pop();
    return ` (because: ${names.join('; ')})`;
}

/**
 * `{ desc, place, causes }` for an EVENT line (`given`: its parts), or `{ refused: text }`. `world`: `{ place(name) → the map's name | null,
 * causes: [name] }`.
 */
export function readEventLine({ key, desc = '', given = {}, world }) {
    const where = part(given.where ?? given.place ?? '', KEY_POINTS);
    const place = where && typeof world?.place === 'function' ? world.place(where) : null;
    if (!place) return { refused: `"${key}" was left out: ${where ? `"${where}" is not a place the map knows` : 'it names no place (where:)'}.` };
    const records = Array.isArray(world?.causes) ? world.causes : [];
    const find = finder(records, starts(records));
    const named = asked(given.because, records);
    const causes = [...new Set(named.map(find).filter(Boolean))].slice(0, MAX_CAUSES);
    if (!causes.length) return { refused: `"${key}" was left out: it cites no cause the world records (because:)${named.length ? `; not found: ${named.slice(0, 3).map(text => flat(text, KEY_POINTS)).join('; ')}` : ''}.` };
    const tail = tailOf(causes);
    const room = Math.max(0, DESC_POINTS - [...tail].length);
    return { desc: `${flat(desc, room)}${tail}`.trim(), place, causes };
}
