// The result envelope of a v1 fight, pure: the fight record plus what the rest of the host reads from a settled fight, in the old words: `stop` ('open', 'won',
// 'lost' or 'fled'), `legend`, `items`, `hurts` and `cleared`, and `board` with a v1 marker. The marker lives INSIDE `board` (`board.v1`), so the result version
// (`v` of the receipt, resolve-parts/versions.js RESULT_VERSION) is not touched. The envelope has no `v` or `key` (the old board adds them at settle, board/commit.js):
// the C6 settle must add `v: 1` and `key`, or the readers that check `v` (resolve-parts/reads.js rollsOf) skip a v1 result.

const STOP = Object.freeze({ win: 'won', loss: 'lost', fled: 'fled', unfinished: 'open' });
const BARS = ['hp', 'mp', 'sp'];
// Each bar's row id is the old one (board/rules-parts/recover-pool.js, standard/roster.js): `c:<key>` for HP, `c:<key>:mana` and `c:<key>:stamina` for the pools.
const ID = { hp: key => `c:${key}`, mp: key => `c:${key}:mana`, sp: key => `c:${key}:stamina` };

/** The fight's net bar change per hero and bar, as the old `hurts` rows ({ id (as above), kind: 'char', name, module, field, from, to }); foes have no block field, so none. */
export function hurtsOf(record, modules = {}) {
    const net = new Map(), party = new Set((record?.party ?? []).map(hero => hero.id));
    for (const move of record?.moves ?? []) {
        if (!party.has(move.id) || !BARS.includes(move.bar)) continue;
        const key = `${move.id}\u0000${move.bar}`, seen = net.get(key);
        net.set(key, { id: ID[move.bar](move.id), kind: 'char', name: move.label, module: modules[move.id] ?? null, field: move.bar, from: seen?.from ?? move.from, to: move.to });
    }
    return [...net.values()].filter(row => row.from !== row.to);
}

/**
 * `envelopeOf(record, { id, groups, modules, items, legend, cleared })`: the record (not changed) with `stop`, `hurts`, `board: { id, offset, groups, v1: 1 }` (no seed: the dice are the port's, dice.js;
 * `offset` is where this segment started, the exchanges played before it: the record's `exchanges` less its `rounds`),
 * and `items`, `legend: 1` and `cleared` only when there are some. `groups` are the foe slots; `modules` maps a hero id to its Character block (for `hurts`).
 */
export function envelopeOf(record, { id, groups = [], modules = {}, items = [], legend = false, cleared = [] } = {}) {
    return {
        ...structuredClone(record), stop: STOP[record?.result] ?? 'open', ...(legend ? { legend: 1 } : {}), ...(items.length ? { items: structuredClone(items) } : {}),
        hurts: hurtsOf(record, modules), ...(cleared.length ? { cleared: [...cleared] } : {}), board: { id, offset: Math.max(0, (record?.exchanges ?? 0) - (record?.rounds?.length ?? 0)), groups: [...groups], v1: 1 },
    };
}
