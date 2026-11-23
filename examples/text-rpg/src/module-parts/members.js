// Finding members and skills by name, and how many skill slots a level has.
import { LIMITS } from '../domain/shape.js';

const keyOf = text => String(text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

/** The member a name (or id) stands for in a domain slice, or null. */
export function memberNamed(slice, who) {
    const key = keyOf(who);
    if (!key) return null;
    return Object.values(slice?.members ?? {}).find(m => keyOf(m.name) === key || m.id === key) ?? null;
}

/** The index of the skill called `name` on a member, or -1. */
export function skillIndex(member, name) {
    const key = keyOf(name);
    return (member?.skills ?? []).findIndex(skill => keyOf(skill.name) === key);
}

/** The skills a character of this level may hold: 5, and one more every third level, up to the record's limit. */
export function skillSlots(level) {
    return Math.min(LIMITS.skills, 5 + Math.floor((Number.isInteger(level) ? level : 1) / 3));
}

/** The members who play (not fallen, not companions), the reader's character first. */
export function players(slice) {
    return Object.values(slice?.members ?? {}).filter(m => !m.fallen && !m.companion).sort((a, b) => Number(b.pc) - Number(a.pc));
}
