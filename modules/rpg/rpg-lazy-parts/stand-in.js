// The RPG part's stand-in: the same commands, cards, queries, hooks, settings and guard, handed to the real part once the library is there.

import { CORE_FEATURE } from '../../../core/features.js';
import { AUTO_CAP, AUTO_CAP_SETTING, BOARD_SKILL, BOARD_SKILL_CARRY, CHECKS_SETTING, CHECK_STEP, DICE, FIGHT, FOES_TOUCH_QUERY, LEAN_RPG_FEATURE, LEVEL, LEVEL_CAP_SETTING, NOROLL, PRACTICE, PRACTICE_SETTING, PRACTICE_STEP, PRECHECK_LIMIT_MS, PRECHECK_SETTING, RESOLVE, ROLLS, ROLLS_SETTING, USE_ITEM } from '../names.js';
import { noRoll } from '../noroll.js';
import { RANK_QUERY, SETTINGS_SCHEMA, XP_RATE, XP_RATE_SETTING, rankQuery } from '../levels.js';
import { levelsQuery, rosterQueries } from '../roster.js';
import { rpgLib } from './library.js';

// The names join.js and index.js give these (a test holds them equal to the real part's keys).
const JOIN_NO = 'rpg.joinNo';
const JOINS_QUERY = 'rpg.joins';
const ROLLS_QUERY = 'rpg.rolls';

/**
 * The RPG part's stand-in: the same shape as createLeanRpgPart (lean-rpg/index.js), registered at once. Until the library is
 * there it answers as the part answers with the feature off (nothing to do); a stored roll is never replayed through it, because
 * the loader brings the library in before a chat that holds one is read.
 */
export function createLazyRpgPart(deps = {}) {
    let real = null;
    const part = () => {
        if (!real) { const lib = rpgLib(); if (lib) real = lib.createLeanRpgPart(deps); }
        return real;
    };
    const waiting = ctx => ctx.fail('FAILED', 'The RPG is still loading. Try again in a moment.');
    const run = (name, fallback) => (...args) => { const made = part(); return made ? made.commands[name](...args) : fallback(...args); };
    return {
        commands: {
            [BOARD_SKILL]: Object.assign(run(BOARD_SKILL, ctx => waiting(ctx)), { feature: CORE_FEATURE.fightBoard }),
            // (no feature: a rename carries the reader's explicit flags even with the board off)
            [BOARD_SKILL_CARRY]: run(BOARD_SKILL_CARRY, ctx => waiting(ctx)),
            // (a consumable's effect, owner 14 Nov: the inventory's Use on… and the story's used line; only while the RPG is on)
            [USE_ITEM]: Object.assign(run(USE_ITEM, ctx => waiting(ctx)), { feature: LEAN_RPG_FEATURE }),
            [RESOLVE]: Object.assign(run(RESOLVE, ctx => waiting(ctx)), { prelude: true, internal: true }),
            // (a tiny record with no state, answered at once, the library or not: a stored note replays whatever is loaded)
            [NOROLL]: Object.assign((ctx, payload) => noRoll(ctx, payload), { prelude: true, internal: true }),
            // (the story-check dice are asked for by the loaded part's hook only; a chat that holds them loads the library first: GUARD_KINDS)
            [DICE]: Object.assign(run(DICE, ctx => waiting(ctx)), { prelude: true, internal: true }),
            [CHECK_STEP]: Object.assign(run(CHECK_STEP, ctx => waiting(ctx)), { internal: true }),
            [FIGHT]: Object.assign(run(FIGHT, ctx => waiting(ctx)), { internal: true }),
            [PRACTICE_STEP]: Object.assign(run(PRACTICE_STEP, ctx => waiting(ctx)), { internal: true }),
            // "No" on a companion's card (join.js JOIN_NO): the reader's answer, only while the feature is on.
            [JOIN_NO]: Object.assign(run(JOIN_NO, ctx => waiting(ctx)), { feature: LEAN_RPG_FEATURE }),
        },
        cards: { 'rpg-join': { feature: LEAN_RPG_FEATURE, for: (...args) => part()?.cards['rpg-join'].for(...args) ?? null } },
        queries: {
            // (whom the inventory's Use on… offers for each consumable; none while the library is not loaded)
            'items.useOn': Object.assign((...args) => part()?.queries['items.useOn'](...args) ?? {}, { feature: LEAN_RPG_FEATURE, fallback: true }),
            [JOINS_QUERY]: Object.assign((...args) => part()?.queries[JOINS_QUERY](...args) ?? [], { feature: LEAN_RPG_FEATURE }),
            [ROLLS_QUERY]: Object.assign((...args) => part()?.queries[ROLLS_QUERY](...args) ?? null, { feature: LEAN_RPG_FEATURE }),
            // (the latest reply that touched the Foes block; -1 while the library is not loaded: no foe was ever set by a reply)
            [FOES_TOUCH_QUERY]: Object.assign((...args) => part()?.queries[FOES_TOUCH_QUERY](...args) ?? -1, { feature: LEAN_RPG_FEATURE }),
            // (the ranks are a pure read of the packs: answered at once, the library or not)
            [RANK_QUERY]: Object.assign(rankQuery, { feature: LEAN_RPG_FEATURE }),
            // (the roster is a pure read of the Character blocks: answered at once too, roster.js)
            ...rosterQueries({ persona: deps?.persona, on: deps?.rosterOn }),
            'party.levels': Object.assign(levelsQuery, { feature: LEAN_RPG_FEATURE }),
        },
        hooks: {
            canGenerate: Object.assign((view, info) => part()?.hooks.canGenerate(view, info), { feature: LEAN_RPG_FEATURE }),
            beforeGenerate: Object.defineProperty((view, info) => part()?.hooks.beforeGenerate(view, info), 'timeoutMs', { enumerable: true, get: () => (deps?.timeoutMs ?? PRECHECK_LIMIT_MS) + 2000 }),
            afterCapture: (view, info) => part()?.hooks.afterCapture(view, info),
            afterReceive: (view, info) => { part()?.hooks.afterReceive(view, info); },
        },
        settings: { defaults: { [ROLLS_SETTING]: ROLLS[0], [PRACTICE_SETTING]: PRACTICE.perUse, [XP_RATE_SETTING]: XP_RATE.default, [LEVEL_CAP_SETTING]: LEVEL.max, [AUTO_CAP_SETTING]: AUTO_CAP.default, [PRECHECK_SETTING]: true, [CHECKS_SETTING]: true }, schema: SETTINGS_SCHEMA },
        guard: (view, info) => { const made = part(); return made ? made.guard(view, info) : { ok: false, reason: 'The RPG is not loaded.' }; },
    };
}
