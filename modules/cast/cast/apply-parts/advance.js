// Applies time-skip and day-change cast moves and deaths.

import { MAX_DOING, MAX_PLACE, cutPoints, cutWords, isAlive, isInt, isMet, isRecord, slotOf } from '../domain.js';
import { noop } from './shared.js';

const hoursText = minutes => {
    if (!isInt(minutes) || minutes <= 0) return '';
    const days = Math.round(minutes / 1440);
    if (minutes >= 1440 * 0.75) return `${Math.max(1, days)} day${Math.max(1, days) === 1 ? '' : 's'}`;
    const hours = Math.max(1, Math.round(minutes / 60));
    return `${hours} hour${hours === 1 ? '' : 's'}`;
};

/** Applies a `cast.advance` payload (`{ from, to, moves, died }`). Returns `{ moved, died, news }` (`news`: the met people's, for the note). */
export function applyAdvance(cast, payload, env) {
    const { rev = 0, touch = noop, note = null } = env;
    const to = isInt(payload.to) ? payload.to : null;
    const done = { moved: 0, died: 0, news: [] };
    for (const move of payload.moves ?? []) {
        const person = Object.hasOwn(cast.people, move.key) && isRecord(cast.people[move.key]) ? cast.people[move.key] : null;
        if (!person || !isAlive(person)) continue;
        touch(move.key);
        if (move.where) person.where = cutPoints(move.where, MAX_PLACE);
        if (move.doing) person.doing = cutWords(move.doing, MAX_DOING);
        person.since = to;
        // The last place the atlas had a road for (a move with no road keeps it; a move with one ends it). Old payloads have no `from`.
        if (move.where && isRecord(move.from)) person.known = [{ where: cutPoints(move.from.where, MAX_PLACE), since: isInt(move.from.since) ? move.from.since : null }];
        else if (move.where && person.known) person.known = null;
        if (isMet(person)) {
            // A slot, written whole (../slot.js): a later reply never changes inside what an earlier one wrote.
            person.heard = [{ on: to, text: cutWords(move.doing || move.where, MAX_DOING) }];
            done.news.push({ name: person.name, text: person.heard[0].text });
        }
        done.moved += 1;
    }
    for (const item of payload.died ?? []) {
        const person = Object.hasOwn(cast.people, item.key) && isRecord(cast.people[item.key]) ? cast.people[item.key] : null;
        if (!person || !isAlive(person) || isMet(person)) continue;
        touch(item.key);
        person.alive = false;
        person.doing = '';
        done.died += 1;
    }
    if (isInt(to)) cast.day = [{ at: to, rev, ...(isInt(slotOf(cast.day)?.first) ? { first: slotOf(cast.day).first } : {}) }];
    if (typeof note === 'function' && (done.moved > 0 || done.died > 0)) {
        const news = done.news.slice(0, 2).map(entry => ` ${entry.name}, met: ${entry.text}.`).join('');
        const span = hoursText(isInt(payload.from) && isInt(to) ? to - payload.from : 0);
        note({
            kind: 'moved', head: 'While time passed', tag: span || 'time passed',
            rest: `${done.moved + done.died} cast member${done.moved + done.died === 1 ? '' : 's'} moved on off-screen (one short line each, only where something changed). You have not met them, so who and where stays hidden.${news}`,
            line: 'The cast moved on',
        });
    }
    return done;
}
