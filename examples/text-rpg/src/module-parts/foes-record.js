// The foes record the narrator sets up before a fight (`slice.foes`): groups keyed by id, each with how many were set up and how many stand, and the fights the groups make.
// `slice.foes = { groups: { <id>: { name, threat, count, left, fight } }, fights: { <fight>: { rolled: { <member>: [skill keys] }, taught: ['<member>:<skill key>'] } } }`, made on the first `+ foes`.

/** The group id a name stands for: its letters and digits, lower case, joined by `-` (at most 30 characters), or ''. */
export function groupId(name) {
    return String(name ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/g, '');
}

/** The record of a slice, made when there is none (an older slice has none). */
export function recordOfFoes(slice) {
    slice.foes ??= { groups: {}, fights: {} };
    return slice.foes;
}

/** The groups that still have foes standing: `[[id, group]]` in the order they were set up. */
export function standing(slice) {
    return Object.entries(slice?.foes?.groups ?? {}).filter(([, group]) => group.left > 0);
}

/** The latest fight: `{ id, groups: [[id, group]], open }` (`open`: some of its groups still stand), or null when none was set up. */
export function latestFight(slice) {
    const id = Object.keys(slice?.foes?.fights ?? {}).at(-1);
    if (!id) return null;
    const groups = Object.entries(slice.foes.groups).filter(([, group]) => group.fight === id);
    return { id, groups, open: groups.some(([, group]) => group.left > 0) };
}
