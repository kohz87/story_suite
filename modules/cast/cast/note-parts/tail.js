// Story Director v2, part **cast**: assembling and pinning the cast's tail lines for the narrator.

import { castOn } from '../settings.js';
import { isAlive, isInt, isRecord, slotOf, tables } from '../domain.js';
import { castOf, samePlace } from '../entries.js';
import { rumorText } from '../sought.js';
import { cueOf, meetingFresh } from './cue.js';

/**
 * The cast's lines for the reply being written (`at`: the chat's length), from `slice` (the state, or the copy a hook has just changed):
 * the cue of who comes into the scene, and the rumor of a person sought who is elsewhere. Pure.
 */
export function cueLines(slice, cast, at) {
    const meeting = slotOf(slice?.meeting);
    const { people } = tables(slice);
    const lines = [];
    // A sought person who is elsewhere: people here know of them, said with no name (only in the reply it was decided for).
    for (const key of Object.keys(people).sort()) {
        const person = people[key];
        const rumor = isRecord(person) ? slotOf(person.rumored) : null;
        if (!rumor || isRecord(person.met) || !isAlive(person) || !meetingFresh(rumor, at) || lines.length >= 1) continue;
        const text = rumorText(cast.byKey.get(key), { where: rumor.where, home: samePlace(rumor.where, cast.byKey.get(key)?.place) });
        if (text) lines.push(`[Cast] ${text}`);
    }
    if (!meeting || !meetingFresh(slice.meeting, at)) return lines;
    for (const key of meeting.keys.slice(0, 2)) {
        const person = isRecord(people[key]) ? people[key] : null;
        if (!person || !isRecord(person.met)) continue;
        lines.push(`[Cast] ${cueOf(person, cast.byKey.get(key))}`);
    }
    return lines;
}

/** The cast's lines as the hook hands them to Story Block: pinned (`keep`), so a tail over its budget never drops them. */
export const pinned = lines => lines.map(text => ({ text, keep: true }));

/** `tail(view)` → `{ lines, optional }`: the lines for the reply from the state (the module's own tail is empty: see hooks.js, the lines are pinned cues). */
export function tail(view) {
    if (!castOn(view)) return { lines: [], optional: [] };
    const at = isInt(view?.chat?.length) ? view.chat.length : null;
    const cast = castOf(typeof view?.query === 'function' ? (name, args) => view.query(name, args) : null);
    return { lines: cueLines(view?.state?.domains?.cast, cast, at), optional: [] };
}
