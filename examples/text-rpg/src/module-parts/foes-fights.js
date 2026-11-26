// What a fight keeps beside its groups: the skills each member rolled in it, and which lessons it has taught. Small, and trimmed as fights pass. Also whether a fight is still on (for `~ rest`) or just closed (for a second wave).
import { practiceKey } from './practice.js';
import { latestFight, standing } from './foes-record.js';
import { diceBefore } from './dice-source.js';

const GROUPS_KEPT = 24;
const JOIN_MINUTES = 60;
const FIGHTS_KEPT = 8;

/** Keeps the record small: the oldest closed groups and the oldest fights (with their groups) go. */
export function trimFoes(record) {
    const fights = Object.keys(record.fights);
    for (const old of fights.slice(0, Math.max(0, fights.length - FIGHTS_KEPT))) {
        delete record.fights[old];
        for (const [id, group] of Object.entries(record.groups)) if (group.fight === old) delete record.groups[id];
    }
    const closed = Object.keys(record.groups).filter(id => record.groups[id].left <= 0);
    for (const id of closed.slice(0, Math.max(0, Object.keys(record.groups).length - GROUPS_KEPT))) delete record.groups[id];
}

/** Notes that `member` rolled `skill` in the fight standing now (nothing when no fight stands): only a skill rolled in a fight can be taught by it. */
export function noteRolled(slice, member, skill) {
    const fight = latestFight(slice);
    if (!fight?.open || !skill) return;
    const rolled = slice.foes.fights[fight.id].rolled[member.id] ??= [];
    const key = practiceKey(skill.name);
    if (!rolled.includes(key) && rolled.length < 40) rolled.push(key);
}

// Did this receipt set up, reinforce or hit group `id`, or roll against it by name?
const touched = (receipt, id) => (receipt?.type === 'capture.foes' ? receipt.data?.group === id : ['capture.xp', 'capture.try'].includes(receipt?.type) && receipt.data?.touched?.includes(id) === true);

/**
 * The standing groups whose fight is still on, so no one rests: touched (set up, reinforced or hit; or rolled against by name, which counts from the next reply on) in this reply (`sid`) or the one before it, or in a reply that began
 * within 60 story minutes of `now`. Older leftovers are not in the list; they still stand for everything else. `index` is this reply's place, `entries` the stored
 * `{ index, receipt }` list: not `group.at` or `slice.dice`, which know only the replies that rolled. The reply before holds the dice step this one was offered.
 */
export function blockingFoes(slice, { sid = null, index = null, entries = [], now = null } = {}) {
    const before = entries.filter(entry => Number.isInteger(entry?.index) && entry.index < index);
    const previous = Math.max(-1, ...before.map(entry => entry.index));
    return standing(slice, now).filter(([id, group]) => {
        if (typeof sid === 'string' && group.sid === sid) return true;
        const at = before.findLast(entry => touched(entry.receipt, id))?.index;
        if (at === undefined) return false;
        if (at === previous) return true;
        const began = diceBefore(at, entries)?.clock;
        return Number.isInteger(now) && Number.isInteger(began) && now - began <= JOIN_MINUTES;
    });
}

/**
 * The battle a new `+ foes` belongs to: the fight still standing; or one that closed within 60 story minutes (with no clock: in the reply just before this one), so a
 * second wave joins the same battle (its XP cap and its lessons); else null (a new battle).
 */
export function joinable(slice, sid, now = null) {
    const fight = latestFight(slice, now);
    if (!fight) return null;
    if (fight.open) return fight.id;
    const ats = fight.groups.map(([, group]) => group.at).filter(Number.isInteger);
    if (Number.isInteger(now) && ats.length) return now - Math.max(...ats) <= JOIN_MINUTES ? fight.id : null;
    const replies = Object.keys(slice.dice ?? {});
    const at = Math.max(-1, ...fight.groups.map(([, group]) => replies.indexOf(group.sid)));
    return at >= 0 && (replies[at] === sid || replies[at + 1] === sid) ? fight.id : null;
}
