// Gives a skill its practice for one use and says what was gained. Practice stays the keyed counter; a per-reply mark keeps `~ spend` and `~ train` (one mark between them) to one gain a skill a reply, and a roll for the skill in the reply wins over it; training sessions of 2 or more have a mark of their own that a roll does not take back.
import { LIMITS } from '../domain/shape.js';
import { PRACTICE_MAX, rankOf } from '../words/ranks.js';
import { practiceKey, practiceOf } from './practice.js';

/** The threat the reply is under so far: its own record's, else the latest earlier reply's, else null (none was named). */
export function threatHeard(slice, sid, record = null) {
    if (Number.isInteger(record?.threat)) return record.threat;
    const keys = Object.keys(slice.dice);
    const at = keys.indexOf(sid);
    const earlier = (at < 0 ? keys : keys.slice(0, at)).at(-1);
    return Number.isInteger(slice.dice[earlier]?.threat) ? slice.dice[earlier].threat : null;
}

/**
 * Adds `points` of practice to `skill` for a use `via` 'try', 'spend' or 'train'. A spend or train gains once per reply for a skill (later ones add 0), and a try takes back what
 * a spend of the same reply gave, so the roll's gain is all the reply teaches. → { gained: points added for this use, rankUp: the rank name reached or null }.
 */
export function addPractice(slice, sid, member, skill, via, points) {
    const key = practiceKey(skill.name);
    let marks = {};
    if (sid) {
        slice.spent ??= {};
        marks = slice.spent[sid] ??= {};
        const keys = Object.keys(slice.spent);
        for (const old of keys.slice(0, Math.max(0, keys.length - LIMITS.diceReplies))) delete slice.spent[old];
    }
    const before = practiceOf(member, skill);
    let earned = points;
    let back = 0;
    if (via === 'train' && points > 1) {
        // Training sessions are their own gain, one `~ train` line a skill a reply, that a roll of the same reply does not take back.
        const own = `train:${key}`;
        earned = marks[own] !== undefined ? 0 : Math.min(points, PRACTICE_MAX - before);
        if (sid && marks[own] === undefined) marks[own] = earned;
    } else if (via !== 'try') {
        if (marks[key] !== undefined) earned = 0;
        else if (sid) marks[key] = Math.min(PRACTICE_MAX, before + points) - before;
    } else if (sid) {
        back = marks[key] ?? 0;
        marks[key] = 0;
    }
    const total = Math.min(PRACTICE_MAX, Math.max(0, before - back) + earned);
    member.practice[key] = total;
    const after = rankOf(total);
    return { gained: earned, rankUp: after.index > rankOf(before).index ? after.name : null };
}
