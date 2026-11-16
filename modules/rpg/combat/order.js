// Combat Rules v1 initiative: order each side by its rolled total, then by AGI, with the party winning a tie between
// the sides. One call settles a fight's order; the caller keeps the returned lists for every exchange.

const number = value => (Number.isFinite(Number(value)) ? Number(value) : 0);
const idOf = entry => String(entry?.id ?? entry?.label ?? entry?.name ?? '');

function ordered(entries) {
    return [...entries]
        .sort((a, b) => number(b.total) - number(a.total) || number(b.agi) - number(a.agi))
        .map(idOf);
}

/**
 * Initiative for one fight. `party` and `foes` are [{ id, total, agi }]; a foe needs no AGI. Returns
 * { party, foes, first }: each side's ids in acting order, and 'party' or 'foes' for the side that acts first. An equal
 * best total goes to the party; within a side, an equal total goes to the higher AGI and then to the given order.
 */
export function initiative(party = [], foes = []) {
    const ours = ordered(party), theirs = ordered(foes);
    const ourBest = party.length ? Math.max(...party.map(entry => number(entry.total))) : -Infinity;
    const theirBest = foes.length ? Math.max(...foes.map(entry => number(entry.total))) : -Infinity;
    const first = foes.length === 0 || (party.length > 0 && ourBest >= theirBest) ? 'party' : 'foes';
    return { party: ours, foes: theirs, first };
}
