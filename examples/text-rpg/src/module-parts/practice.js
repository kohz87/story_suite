// A member's skill practice: a map beside `skills`, keyed by the skill's name, so a replay writes it per key.

/** The key a skill's practice is kept under. */
export const practiceKey = name => String(name ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

/** The practice total a member holds for a skill (0 when none). */
export function practiceOf(member, skill) {
    const value = member?.practice?.[practiceKey(skill?.name)];
    return Number.isInteger(value) ? value : 0;
}
