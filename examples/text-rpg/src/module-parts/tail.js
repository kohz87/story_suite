// The tail: the capability line per member, then the dice note with the reply's dice and floor. Empty while Text RPG is not active.
import { diceNote } from '../dice/note.js';
import { DOMAIN } from '../domain/shape.js';
import { active } from './active.js';
import { bonusRows } from './bonus.js';
import { minutesOf } from './conditions.js';
import { capabilityLine } from './capability.js';
import { gearOf } from './gear.js';

/** `context.tail(view)`: `{ lines, optional }`. */
export function tailOf(view) {
    if (!active(view)) return { lines: [], optional: [] };
    const members = Object.values(view.state?.domains?.[DOMAIN]?.members ?? {}).filter(member => !member.fallen).sort((a, b) => Number(b.pc) - Number(a.pc));
    if (!members.length) return { lines: [], optional: [] };
    const now = minutesOf(view.state);
    const gear = new Map(members.map(member => [member.id, gearOf(view.query, member)]));
    const lines = members.map(member => capabilityLine(member, gear.get(member.id), now));
    let record = null;
    try { record = view.query('textRpg.dice'); } catch { record = null; }
    const note = record ? diceNote({ list: record.list, floor: record.floor, rows: bonusRows(members, member => gear.get(member.id).cap) }) : '';
    return { lines: note ? [...lines, note] : lines, optional: [] };
}
