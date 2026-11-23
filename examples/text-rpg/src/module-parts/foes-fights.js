// What a fight keeps beside its groups: the skills each member rolled in it, and which lessons it has taught. Small, and trimmed as fights pass.
import { practiceKey } from './practice.js';
import { latestFight } from './foes-record.js';

const GROUPS_KEPT = 24;
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
