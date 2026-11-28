// Which foes an `+ xp` line with no `group:` counts down first: those the reply's own `? try ... against:` lines named, then those standing before the reply, then those it declared.
// Only for a reply with the core rule mark `xpAimedFirst`. A reply with no mark keeps the plain lowest-threat order and writes none of the rule's records (`aimed`, `born`).

/** True when the reply being read is under the rule. */
export function aimedFirst(ctx) {
    return ctx.carrier?.rules?.includes('xpAimedFirst') === true;
}

/** `groups` (`[[id, group]]`) in the order they are counted down: the three steps for the reply `sid`, lowest threat first within each. */
export function countingOrder(slice, sid, groups) {
    const aimed = slice.dice?.[sid]?.aimed ?? [];
    const step = ([id, group]) => (aimed.includes(id) ? 0 : group.born === sid ? 2 : 1);
    return [...groups].sort((a, b) => step(a) - step(b) || a[1].threat - b[1].threat);
}
