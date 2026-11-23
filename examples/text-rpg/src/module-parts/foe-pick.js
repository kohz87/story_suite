// Picking among foes: the party level a kind is rated against, and the group a `? try` is made against.
import { standing, groupId } from './foes-record.js';
import { levelOf, woundsOf } from './standing.js';

/** The party's level: the highest among the members not fallen or Down (1 when none is left). */
export function partyLevel(slice) {
    const able = Object.values(slice?.members ?? {}).filter(member => !member.fallen && woundsOf(member) < 5);
    return Math.max(1, ...able.map(levelOf));
}

/** The group a try is made against: the one `against` names, else the strongest standing (the first of equals); `{ group, missed }`, group null with none standing, `missed` when the name matched none. */
export function foeFor(slice, against, now = null) {
    const groups = standing(slice, now).map(([, group]) => group);
    const named = against ? groups.find(group => groupId(group.name) === groupId(against)) : null;
    const strongest = groups.reduce((top, group) => (!top || group.threat > top.threat ? group : top), null);
    return { group: named ?? strongest, missed: Boolean(against) && !named && groups.length > 0 };
}
