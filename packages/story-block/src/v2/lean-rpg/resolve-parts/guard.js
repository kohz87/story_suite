// The replay guard of `rpg.resolve`: the roll stands while the sheet numbers it used are what the prefix holds.
import { CHECK_STEP, FIGHT, FIX_VERSION, LV_VERSION, PRACTICE_STEP, RESOLVE, practiceOf } from '../names.js';
import { fightGuard } from '../fight.js';
import { boardGuard } from '../board/commit.js';
import { checkGuard, practiceGuard } from '../practice.js';
import { hasLevels } from '../rules.js';
import { readSheet } from '../read.js';
import { validatePlan } from '../plan.js';
import { openFoes } from '../open.js';
import { applyGear, gearMatches, gearValid } from '../gear.js';
import { carriedFrom } from '../ambush.js';
import { FLOW_VERSION } from '../resolve/dice.js';
import { isObject } from './shared-plain.js';
import { prepare, fieldMax } from './roll.js';
import { orderOf, rulesOfPayload, staleOf, levelsValid } from './payload.js';

/**
 * The replay guard (docs/v2/REPLAY.md): the roll stands while the sheet numbers it used are what the prefix holds. Pure:
 * the state before the block and what it recorded, nothing else.
 */
export function leanRpgGuard({ state, hash }, { guard, source, recorded }) {
    if (guard?.predicate?.board === 1) return boardGuard({ state, hash }, { guard, source, recorded });
    const bad = reason => ({ ok: false, reason });
    if (guard?.predicate?.kind === FIGHT) return fightGuard({ state, hash }, { guard, source, recorded });
    if (guard?.predicate?.kind === PRACTICE_STEP) return practiceGuard({ state, hash }, { guard, source, recorded });
    if (guard?.predicate?.kind === CHECK_STEP) return checkGuard({ state, hash }, { guard, source, recorded });
    try {
        const predicate = guard?.predicate;
        if (guard?.version !== 2 || guard.rulesHash !== null || !isObject(predicate) || predicate.kind !== RESOLVE) return bad('Malformed roll guard.');
        if (!isObject(recorded) || !validatePlan(recorded.plan).ok || hash(recorded.plan) !== predicate.plan || recorded.key !== predicate.key) return bad('The roll\'s plan was damaged.');
        if (recorded.start !== predicate.start || (recorded.start !== undefined && (typeof recorded.start !== 'string' || !recorded.start || recorded.start.length > 120))) return bad('The fight opening was damaged.');
        // The slots of stale groups the opening put down (precall.js) are hashed with the roll; a roll made before has none.
        if (JSON.stringify(recorded.stale ?? null) !== JSON.stringify(predicate.stale ?? null) || (recorded.stale !== undefined && staleOf(recorded.stale) === undefined)) return bad('The fight opening was damaged.');
        // The numbers are the ones recorded with the roll, not today's settings; damaged numbers are not guessed at.
        // A roll recorded before the numbers were kept has none: it was made with Standard's.
        const rules = rulesOfPayload(recorded.rules);
        // The level mark is hashed with the roll: the numbers carry a divisor exactly when the roll says `lv: 1`; a roll made before has neither.
        if (recorded.lv !== predicate.lv || (recorded.lv !== undefined && recorded.lv !== LV_VERSION) || hasLevels(rules) !== (recorded.lv === LV_VERSION)) return bad('The roll\'s level mark was damaged.');
        const kept = recorded.rules !== undefined || predicate.rules !== undefined;
        if (kept && (hash(recorded.rules ?? null) !== hash(rules) || hash(rules) !== predicate.rules)) return bad('The roll\'s numbers were damaged.');
        // The flow it stopped by is hashed with it; a roll of the earlier flow has none.
        const flow = recorded.flow === undefined && predicate.flow === undefined ? 1 : recorded.flow === FLOW_VERSION && predicate.flow === FLOW_VERSION ? FLOW_VERSION : null;
        if (flow === null) return bad('The roll\'s flow was damaged.');
        // The stage-65 rules mark (foe slots, spent-skill fallback) is hashed with the roll; a roll made before has none and keeps the earlier rules.
        if (recorded.fix !== predicate.fix || (recorded.fix !== undefined && ![2, FIX_VERSION].includes(recorded.fix))) return bad('The roll\'s rules mark was damaged.');
        // Practice by code is hashed with the roll that asked for it; a roll made before has none.
        if (recorded.practice !== predicate.practice || (recorded.practice !== undefined && practiceOf(recorded.practice) === null)) return bad('The roll\'s practice mark was damaged.');
        // The drop an earlier reply's ambush check gave is hashed with the roll that spent it.
        if (predicate.ambush !== undefined || recorded.ambush !== undefined) {
            if (carriedFrom(recorded.ambush) === null || hash(recorded.ambush) !== predicate.ambush) return bad('The roll\'s ambush was damaged.');
        }
        // The turn order a Standard roll was given (carried from the fight's earlier reply) is hashed with it.
        if (predicate.order !== undefined || recorded.order !== undefined) {
            if (orderOf(recorded.order) === null || hash(recorded.order) !== predicate.order) return bad('The roll\'s turn order was damaged.');
        }
        // The Levels rules are hashed with the roll that used them; the levels its opened foes were given (drawn from the reply's seed when it was rolled) are recorded and hashed too.
        // Gear (gear.js) is hashed with the roll that carried it: a record that has it must be one this version reads; a roll made before has none.
        if ((recorded.gear === undefined) !== (predicate.gear === undefined) || (recorded.gear !== undefined && (!gearValid(recorded.gear) || hash(recorded.gear) !== predicate.gear))) return bad('The roll\'s gear was damaged.');
        const gear = recorded.gear;
        // (what the roll was worked out from must still be what the state before it holds)
        if (gear && !gearMatches(state, gear, hash)) return bad('The gear before this roll changed; Re-read this reply.');
        const lv = recorded.lv === LV_VERSION;
        const levels = lv && recorded.levels !== undefined ? recorded.levels : null;
        if (levels !== null && (!levelsValid(levels) || hash(levels) !== predicate.levels)) return bad('The roll\'s foe levels were damaged.');
        if (levels === null && predicate.levels !== undefined) return bad('The roll\'s foe levels were damaged.');
        // A roll that opened a fight is asked again on the block with those foes put in, as it was rolled.
        const opening = Array.isArray(recorded.plan.open) && recorded.plan.open.length > 0;
        if (opening && lv && (!levels || levels.length !== recorded.plan.open.length)) return bad('The roll\'s foe levels were damaged.');
        const domain = opening ? structuredClone(state.domains?.dataModules) : state.domains?.dataModules;
        const opened = opening ? openFoes(domain, lv ? recorded.plan.open.map((entry, at) => ({ name: entry.name, count: entry.count, level: levels[at] })) : recorded.plan.open, { fix: recorded.fix ?? 1, stale: recorded.stale ?? [] }) : null;
        const witness = prepare(recorded.plan, applyGear(readSheet(opening ? { domains: { dataModules: domain } } : state), gear), rules, { maxOf: fieldMax(domain), flow, lv, fix: recorded.fix >= 2, then: recorded.fix >= 3 }).witness;
        if (opening) witness.opened = opened;
        if (hash({ source, predicate, witness }) !== guard.inputHash) return bad('The sheet before this roll changed; Re-read this reply.');
        return { ok: true };
    } catch { return bad('Damaged roll record.'); }
}
