// Finding members and skills by name, and how many skill slots a level has.

const keyOf = text => String(text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

/** The member a name (or id) stands for in a domain slice, or null; one who has not fallen is preferred, so a new character may take a fallen one's name. */
export function memberNamed(slice, who) {
    const key = keyOf(who);
    if (!key) return null;
    const named = Object.values(slice?.members ?? {}).filter(m => keyOf(m.name) === key || m.id === key);
    return named.find(m => !m.fallen) ?? named[0] ?? null;
}

/** The index of the skill called `name` on a member, or -1. */
export function skillIndex(member, name) {
    const key = keyOf(name);
    return (member?.skills ?? []).findIndex(skill => keyOf(skill.name) === key);
}

/** The skills a character of this level may hold: 5, and one more every tenth level, 8 at the most (from level 30). */
export function skillSlots(level) {
    return Math.min(8, 5 + Math.floor((Number.isInteger(level) ? level : 1) / 10));
}

/** The members who play (not fallen, not companions), the reader's character first. */
export function players(slice) {
    return Object.values(slice?.members ?? {}).filter(m => !m.fallen && !m.companion).sort((a, b) => Number(b.pc) - Number(a.pc));
}
