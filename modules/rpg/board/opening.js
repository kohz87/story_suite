// The fight kind's opening: what a pre-check fight settles before its first exchange. The foes the pre-check found are put into free slots of the Foes block,
// the approach checks and an ambush are rolled, and the record has the shape the old opening roll (`rpg.resolve` with `plan.open`) had. Pure: it reads the
// state and the dice it is given; the Foes block is written by the `rpg.board.openFoes` call it names (and `rpg.board.hurts` for bars the checks moved).
import { BOARD_HURTS as HURTS, BOARD_OPEN_FOES as OPEN_FOES, LV_VERSION, LEVEL, practiceOf } from '../names.js';
import { cueOfResult } from '../cue.js';
import { readSheet } from '../read.js';
import { hasLevels, normalizeRules } from '../rules.js';
import { openFoes } from '../open.js';
import { averageLevel, partyLevels, settleOpen } from '../foes.js';
import { FLOW_VERSION } from '../resolve/dice.js';
import { RESULT_VERSION } from '../resolve-parts/versions.js';
import { fieldMax, prepare, rollPrepared } from '../resolve-parts/roll.js';
import { staleOf } from '../resolve-parts/payload.js';

const LANES = { act: 1, foe: 2, check: 3, init: 4, open: 5 };
const FIX = 3;

// The old roll's own dice: one stream per action, seeded from the opening's first draw (the lanes are the board's: act 1, foe 2, check 3, init 4, open 5).
const sourceOf = dice => Object.assign((kind, at) => dice(LANES[kind], at, 20), { positional: true });
// The first draw the level picks are made from (the old roll took one number from the reply's seed): three thousand-sided draws of the opening's own dice.
const baseOf = dice => [0, 1, 2].reduce((sum, at) => ((sum * 1000) + dice(0, at, 1000)() - 1) >>> 0, 0);
const sheetOf = domain => readSheet({ domains: { dataModules: domain } });

/** The setup of an opening from what the pre-check recorded (`{ groups, key, rules, anchor, practice, stale }`); an error string when it cannot open. */
export function openingSetup({ groups, key, rules, anchor, practice, stale }) {
    if (!Array.isArray(groups) || !groups.length || typeof key !== 'string' || !key) return { error: 'There are no foes to open.' };
    return { setup: { id: `${anchor}:opening`, opening: true, key, open: structuredClone(groups), rules: normalizeRules(rules), practice: practiceOf(practice), start: anchor, ...(staleOf(stale) ? { stale: staleOf(stale) } : {}) } };
}

/** What the opening settle reads, as the pre-check's roll did: the party's sheet and the Foes block (a plain value the guard hashes). */
export const openingWitness = state => ({ sheet: sheetOf(state.domains.dataModules) });

/** The kind's `opening(state, setup, dice)` → `{ result, changes, stop }`. */
export function openingOf(state, setup, dice) {
    // (the old opening always said `lv: 1`: a rule set with no divisor rolls with the default one)
    const lv = LV_VERSION, rules = hasLevels(setup.rules) ? setup.rules : { ...setup.rules, levelDivisor: LEVEL.divisor };
    const domain = structuredClone(state.domains.dataModules), source = sourceOf(dice), base = baseOf(dice);
    const entries = settleOpen(setup.open, averageLevel(partyLevels(sheetOf(domain))), base);
    const stale = setup.stale ?? [], opened = openFoes(domain, entries, { fix: FIX, stale });
    const standing = sheetOf(domain), noXp = standing.characters.length > 0 && standing.characters.every(character => character.scale === 2);
    const plan = { formula: 'standard', pace: 'normal', open: setup.open, acts: [], foes: [], checks: [] };
    const prepared = prepare(plan, standing, rules, { maxOf: fieldMax(domain), flow: FLOW_VERSION, lv: true, fix: true, then: true });
    const rolled = rollPrepared(plan, prepared, source, rules, { earlier: false, carried: null, drop: null, opened, fix: true, then: true, flow: FLOW_VERSION, noXp, wearOf: null });
    const result = { v: RESULT_VERSION, key: setup.key, pace: plan.pace, rules, flow: FLOW_VERSION, ...(noXp ? { noXp: true } : {}), fix: FIX, ...(setup.practice ? { practice: setup.practice } : {}), lv,
        stop: rolled.stop, checks: rolled.checks, rounds: rolled.rounds, refused: prepared.refused, summary: rolled.summary, ...(rolled.ambush ? { ambush: rolled.ambush } : {}), opened,
        order: rolled.order, quickStart: rolled.quickStart, opening: rolled.opening, idle: rolled.idle, hurts: rolled.hurts, ...(rolled.shape ? { shape: rolled.shape } : {}) };
    const changes = [{ type: OPEN_FOES, payload: { open: entries.map(entry => ({ name: entry.name, count: entry.count, ...(entry.level !== undefined ? { level: entry.level } : { class: entry.class ?? 1 }) })), fix: FIX, stale } }];
    if (result.hurts.length) changes.push({ type: HURTS, payload: { hurts: result.hurts.map(hurt => ({ module: hurt.module, field: hurt.field, to: hurt.to })) } });
    return { result, changes, stop: 'open' };
}

/** The opening's note: the roll's cue (the approach checks and the ambush), as the old opening roll told it. */
export const openingNote = result => [cueOfResult(result, result.shape)];
