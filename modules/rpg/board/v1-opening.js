// The opening of a pre-check fight on a Combat Rules v1 sheet: the foes the pre-check found are put into free slots of the v1 Foes block (each with its tier; no tier reads as standard).
// The old opening also rolled approach checks and an ambush on the old rules; v1 has neither (story checks are the v1 roll's, and the fight rolls its own initiative), so the record has none.
// Pure: it reads the state and the dice it is given; the block is written by the `rpg.board.openFoes` call it names.
import { BOARD_OPEN_FOES as OPEN_FOES } from '../names.js';
import { V1 } from '../combat/numbers.js';
import { readSheet } from '../read.js';
import { openFoes } from '../open.js';
import { averageLevel, partyLevels, settleOpen } from '../foes.js';
import { RESULT_VERSION } from '../rolls-read.js';

const FIX = 3;
// The first draw the level picks are made from: three thousand-sided draws of the opening's own dice (as the old opening took them).
const baseOf = dice => [0, 1, 2].reduce((sum, at) => ((sum * 1000) + dice(0, at, 1000)() - 1) >>> 0, 0);
const tierOf = tier => (typeof tier === 'string' && tier ? tier.toLowerCase() : V1.foe.defaultTier);

/** The kind's `opening(state, setup, dice)` → `{ result, changes, stop }` for a v1 setup. */
export function openingV1(state, setup, dice) {
    const domain = structuredClone(state.domains.dataModules), sheet = readSheet({ domains: { dataModules: domain } });
    const levels = settleOpen(setup.open, averageLevel(partyLevels(sheet)), baseOf(dice));
    const entries = levels.map((entry, at) => ({ ...entry, tier: tierOf(setup.open[at]?.tier) }));
    const stale = setup.stale ?? [], opened = openFoes(domain, entries, { fix: FIX, stale });
    const result = { v: RESULT_VERSION, key: setup.key, pace: 'normal', rules: structuredClone(setup.rules ?? {}), flow: 2, fix: FIX, ...(setup.practice ? { practice: setup.practice } : {}),
        stop: 'open', checks: [], rounds: [], refused: [], summary: { exchanges: 0, acts: [], refused: 0 }, opened, order: [], quickStart: [], opening: [], idle: [], hurts: [], v1: 1 };
    return { result, changes: [{ type: OPEN_FOES, payload: { open: entries.map(entry => ({ name: entry.name, count: entry.count, level: entry.level, tier: entry.tier })), fix: FIX, stale } }], stop: 'open' };
}
