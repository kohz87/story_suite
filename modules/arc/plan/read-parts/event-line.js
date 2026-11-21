// Story Director v2, part **arc**: the planner's `EVENT:` line (switch story-director.world-events; ARCAUDIT §5 "the arc plan may emit EVENT:
// lines with cited causes"): `EVENT: Title — what happens | where: <place> | on: <date> | because: <cause>; <cause>`. Read only while the plan
// reader is given the world (`world`, the controller's world check, null while the switch is off: the label is then no plan label). Code has the
// last word: `where` must be a place the map knows; each cause must be a record the world holds (an Active or coming world event, a condition, a
// Journal entry, a tracked thread); a line with no such cause or no known place is left out. What is kept is a BEAT (the tracker's own kind, so
// nothing new reaches the accept command), its place the map's name and its words ending with the causes it cites. Pure.

import { lineKey } from '../../../world/changes.js';
import { DESC_POINTS, KEY_POINTS, flat, part } from '../shared.js';

/** The most EVENT lines one plan keeps (each is also one of its beats). */
export const EVENT_CAP = 2;
const MAX_CAUSES = 3;
const SPLIT = /\s*[;,]\s*/;

/**
 * `{ desc, place, causes }` for an EVENT line (`given`: its parts), or `{ refused: text }`. `world`: `{ place(name) → the map's name | null,
 * causes: [name] }`.
 */
export function readEventLine({ key, desc = '', given = {}, world }) {
    const where = part(given.where ?? given.place ?? '', KEY_POINTS);
    const place = where && typeof world?.place === 'function' ? world.place(where) : null;
    if (!place) return { refused: `"${key}" was left out: ${where ? `"${where}" is not a place the map knows` : 'it names no place (where:)'}.` };
    const known = new Map((Array.isArray(world?.causes) ? world.causes : []).map(name => [lineKey(name), name]).filter(([id]) => id));
    const asked = String(given.because ?? '').split(SPLIT).map(text => flat(text, KEY_POINTS)).filter(Boolean);
    const causes = [...new Set(asked.map(text => known.get(lineKey(text))).filter(Boolean))].slice(0, MAX_CAUSES);
    if (!causes.length) return { refused: `"${key}" was left out: it cites no cause the world records (because:)${asked.length ? `; not found: ${asked.slice(0, 3).join('; ')}` : ''}.` };
    const tail = ` (because: ${causes.join('; ')})`;
    const room = Math.max(0, DESC_POINTS - [...tail].length);
    return { desc: `${flat(desc, room)}${tail}`.trim(), place, causes };
}
