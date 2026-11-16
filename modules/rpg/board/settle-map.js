// Turns a played board fight into what the port's settle records: the full result, and the command calls that write it.
// Pure: it reads the state the fight started from and the played copy; the calls are made by the core's settle, in this order.
import { applyGear, earnedLegend } from '../gear.js';
import { BOARD_CLEAR_FOES as CLEAR_FOES, BOARD_HURTS as HURTS, LV_VERSION } from '../names.js';
import { readSheet } from '../read.js';
import { hasLevels } from '../rules.js';
import { clearFoes } from './engine.js';
import { stagingWear } from './engine-parts/equipment.js';

/** The record a reader of `data.v2.result` expects (the shape the pre-port `rpg.resolve` board record had), from the engine's own result. */
export function fightResult(state, setup, base) {
    const { rules, gear } = setup, result = { v: 1, key: setup.id, pace: 'careful', rules: structuredClone(rules), flow: 2, fix: 3, practice: setup.practice,
        ...(hasLevels(rules) ? { lv: LV_VERSION } : {}), ...(gear ? { gear: structuredClone(gear) } : {}), checks: structuredClone(setup.approach ?? []), ...structuredClone(base),
        board: { id: setup.id, seed: setup.seed, offset: setup.offset, groups: structuredClone(setup.groups) } };
    if (gear && earnedLegend(result, applyGear(readSheet(state), gear), hasLevels(rules))) result.legend = 1;
    // (a fight opened under the foe-clear mark: once it has ended its groups leave the Foes block, whatever the outcome)
    if (setup.foesClear === 1 && result.stop !== 'open') {
        const cleared = clearFoes(structuredClone(state.domains.dataModules), readSheet(state).foes, setup.groups);
        if (cleared.length) result.cleared = cleared;
    }
    return result;
}

/** The calls a settled fight makes, in the order the pre-port commit wrote them: gear wear, bag items used, the foes' new bars, then ended groups cleared. */
export function fightChanges(state, setup, result) {
    const calls = [];
    if (setup.gear) stagingWear(structuredClone(state), setup.gear, { opening: result.opening, rounds: result.rounds, rules: setup.rules }, calls);
    for (const used of result.items ?? []) calls.push({ type: 'inventory.consume', payload: { stack: used.stack, qty: 1 } });
    if (result.hurts.length) calls.push({ type: HURTS, payload: { hurts: result.hurts.map(hurt => ({ module: hurt.module, field: hurt.field, to: hurt.to })) } });
    if (result.cleared?.length) {
        const foes = readSheet(state).foes.filter(foe => foe.filled && result.cleared.includes(foe.slot)).map(foe => ({ slot: foe.slot, module: foe.module, filled: true, ...(foe.local !== undefined ? { local: foe.local } : {}) }));
        calls.push({ type: CLEAR_FOES, payload: { groups: result.cleared, foes } });
    }
    return calls;
}
