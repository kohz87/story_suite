// The stat purchases of a member, in the order they were made, and which of them the level pays for.

/** `[{ id, stat, n, seq }]` oldest first (a malformed entry is skipped). */
export function purchasesOf(member) {
    const bought = member?.bought && typeof member.bought === 'object' ? member.bought : {};
    return Object.entries(bought)
        .filter(([, item]) => item && Number.isInteger(item.n) && item.n > 0 && Number.isInteger(item.seq))
        .map(([id, item]) => ({ id, stat: item.stat, n: item.n, seq: item.seq }))
        .sort((a, b) => a.seq - b.seq);
}

/** The purchases `earned` points pay for: each one in order whose points still fit (one that does not fit is skipped, so a later, smaller one can count); the rest wait for the level to return. */
export function countedPurchases(member, earned) {
    const counted = [];
    let left = Math.max(0, earned);
    for (const item of purchasesOf(member)) {
        if (item.n > left) continue;
        left -= item.n;
        counted.push(item);
    }
    return counted;
}
