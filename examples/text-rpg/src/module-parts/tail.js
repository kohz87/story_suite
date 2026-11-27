// The tail: the dice note (reply's dice, tone-shifted numbers, floor) first so a tight budget never cuts it, then the capability line per member. Empty while Text RPG is not active.
import { diceNote } from '../dice/note.js';
import { DIFFICULTIES } from '../rules/difficulty.js';
import { DOMAIN } from '../domain/shape.js';
import { active } from './active.js';
import { bonusRows } from './bonus.js';
import { minutesOf } from './conditions.js';
import { capabilityLine } from './capability.js';
import { floorWhy } from './floor-why.js';
import { matchupOf } from './matchup.js';
import { MATCHUP_RULE } from './static-text.js';
import { gearOf } from './gear.js';
import { namedText } from './listed.js';
import { toneStep } from './settings.js';

/** `context.tail(view)`: `{ lines, optional }`. */
export function tailOf(view) {
    if (!active(view)) return { lines: [], optional: [] };
    const members = Object.values(view.state?.domains?.[DOMAIN]?.members ?? {}).filter(member => !member.fallen).sort((a, b) => Number(b.pc) - Number(a.pc));
    if (!members.length) return { lines: [], optional: [] };
    const now = minutesOf(view.state);
    const gear = new Map(members.map(member => [member.id, gearOf(view.query, member)]));
    const text = namedText(view);
    const lines = members.map(member => capabilityLine(member, gear.get(member.id), now, text));
    let record = null;
    try { record = view.query('textRpg.dice'); } catch { record = null; }
    // Each word keeps its place and carries the number the tone moves it to: what `? try` uses (kinds/try.js).
    const step = toneStep(view);
    const last = DIFFICULTIES.length - 1;
    const difficulties = DIFFICULTIES.map(({ word }, at) => ({ word, dc: DIFFICULTIES[Math.min(last, Math.max(0, at + step))].dc }));
    // What raised the floor: the reader's live conditions, as the hook that offered the dice counted them (hooks.js).
    const why = record?.floor > 0 ? floorWhy(members[0], { now }) : [];
    const note = record ? diceNote({ list: record.list, floor: record.floor, why, difficulties, rows: bonusRows(members, text) }) : '';
    const matchup = matchupOf(view.state?.domains?.[DOMAIN], member => gear.get(member.id)?.cap ?? {}, now);
    const told = matchup ? [`Matchup: ${matchup.band} (${matchup.why}). ${MATCHUP_RULE}`] : [];
    return { lines: [...(note ? [note] : []), ...told, ...lines], optional: [] };
}
