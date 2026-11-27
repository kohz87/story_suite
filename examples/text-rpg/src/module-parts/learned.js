// The learn order of a member's skills: which were learned after creation, and the number the next one takes.

/** The order number for a skill learned now: one past the latest learned (creation skills have none). */
export function nextLearned(member) {
    return (member?.skills ?? []).reduce((top, skill) => (Number.isInteger(skill.learned) ? Math.max(top, skill.learned) : top), -1) + 1;
}
