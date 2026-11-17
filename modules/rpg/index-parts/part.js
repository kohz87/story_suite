// The lean RPG part: its default settings, the joins query name and createLeanRpgPart, the part merged into Story Block's core module.
import { stChat } from '../../assist/st-adapter.js';
import { AUTO_CAP, AUTO_CAP_SETTING, BOARD_SKILL, CHECKS_SETTING, CHECK_STEP, DICE, FIGHT, LEAN_RPG_FEATURE, LEVEL, LEVEL_CAP_SETTING, PRACTICE, PRACTICE_SETTING, PRACTICE_STEP, PRECHECK_LIMIT_MS, PRECHECK_SETTING, ROLLS_QUERY } from '../names.js';
import { fightHook, fightXp } from '../fight.js';
import { RANK_QUERY, SETTINGS_SCHEMA, XP_RATE, XP_RATE_SETTING, rankQuery } from '../levels.js';
import { checkStep, checksHook, practiceHook, practiceStep } from '../practice.js';
import { diceRecord } from '../checks/dice.js';
import { JOIN_NO, joinCard, joinOffers, partyOf } from '../join.js';
import { fold } from '../read.js';
import { createPrecall } from '../precall.js';
import { FOES_TOUCH_QUERY } from '../names.js';
import { lastFoeTouch } from '../board/offers.js';
import { leanRpgGuard } from '../guard.js';
import { rollsOf } from '../rolls-read.js';
import { skipOf } from '../start.js';
import { levelsQuery, rosterQueries } from '../roster.js';
import { createBoardPart } from '../board/overrides.js';

/** The part's settings (Story Block's own bucket). */
export const DEFAULT_SETTINGS = Object.freeze({ [PRACTICE_SETTING]: PRACTICE.perUse, [XP_RATE_SETTING]: XP_RATE.default, [LEVEL_CAP_SETTING]: LEVEL.max, [AUTO_CAP_SETTING]: AUTO_CAP.default, [PRECHECK_SETTING]: true, [CHECKS_SETTING]: true });

/** The offers a reply's `+ party` lines made under Ask (the card under the reply reads them): `rpg.joins { index? }` → [{ name, soul, best }] on the head reply (or the reply `index`). */
export const JOINS_QUERY = 'rpg.joins';

/**
 * The part merged into Story Block's core module (domains/index.js). `deps` (all optional):
 *   chat() → SillyTavern's chat array                           (default: st-adapter)
 *   metadata() → the chat's metadata object, for the board's session and start notes   (default: none)
 *   moduleId = 'story-block' (whose settings it reads)
 *   rosterOn() → whether the RPG and Gear in fights are both on (the roster is answered only then, or when asked for `recorded`)
 *   persona() → the reader's name, for `party.pc` (default: none, the first block)
 *   callModel(prompt, { maxTokens, profile, helper, timeoutMs }) → text, onPlanning(working), timeoutMs, timer: the foe pre-check's one Assist call (none: no pre-check)
 * → { commands, queries, hooks, settings: { defaults }, guard }; `guard` is the replay guard for the RPG's own blocks
 * (domains/index.js routes the guards of that predicate to it).
 */
export function createLeanRpgPart({ chat = stChat, metadata = () => null, moduleId = 'story-block', persona = () => '', rosterOn, callModel, onPlanning, timeoutMs, timer } = {}) {
    const precall = createPrecall({ chat, metadata, moduleId, skip: skipOf(metadata), callModel, onPlanning, timeoutMs, timer });
    const board = createBoardPart({ persona, metadata });
    // (the reader's own character is the one named like the persona: a full party's card never offers to bench them)
    const isMe = name => { let who = ''; try { who = String(persona() ?? '').replace(/\s+/g, ' ').trim(); } catch { who = ''; } return Boolean(who) && fold(name) === fold(who); };
    return {
        commands: {
            ...board.commands,
            // A reply's three story-check dice (checks/dice.js): a prelude, drawn from the receipt's seed, so a swipe rolls anew and a Re-read keeps them. Not tied to the feature either.
            [DICE]: Object.assign((ctx, payload) => diceRecord(ctx, payload), { prelude: true, internal: true }),
            // The results of a reply's story checks, a step after its lines (practice.js). Not tied to the feature either: a Re-read keeps it.
            [CHECK_STEP]: Object.assign((ctx, payload) => checkStep(ctx, payload), { internal: true }),
            // XP for a won fight, a step after the reply's lines (fight.js). Not tied to the feature either: a Re-read keeps it.
            [FIGHT]: Object.assign((ctx, payload) => fightXp(ctx, payload), { internal: true }),
            // Practice for the skills a reply's rolls used, a step after the reply's lines (practice.js). Not tied to the feature either.
            [PRACTICE_STEP]: Object.assign((ctx, payload) => practiceStep(ctx, payload), { internal: true }),
            // "No" on a companion's card (join.js): the reader's answer, kept in the reply's own receipt like the offer it answers.
            [JOIN_NO]: Object.assign((ctx, payload) => {
                if (ctx.cause !== 'ui') ctx.fail('REFUSED', 'Only the reader answers a companion\'s card.');
                const name = typeof payload?.name === 'string' ? payload.name.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
                if (!name) ctx.fail('INVALID', 'Which companion?');
                return { summary: `No to ${name} joining the party.`, narrate: false, data: { join: { op: 'no', name } } };
            }, { feature: LEAN_RPG_FEATURE }),
        },
        // The card under the head reply for a companion who may join (join.js): read from the reply's own receipts, so it goes with the reply.
        cards: { 'rpg-join': { feature: LEAN_RPG_FEATURE, for: (state, _message, ctx) => joinCard(ctx?.query?.(JOINS_QUERY, Number.isInteger(ctx?.index) ? { index: ctx.index } : {}) ?? [], state, isMe) } },
        queries: {
            ...board.queries,
            [JOINS_QUERY]: Object.assign((state, args, tools) => joinOffers(tools?.receipts?.() ?? [], Number.isInteger(args?.index) ? args.index : tools?.reply?.index, partyOf(state)), { feature: LEAN_RPG_FEATURE }),
            // The rank a level falls in, by the story's pack (levels.js): { level } → { name } | null.
            [RANK_QUERY]: Object.assign(rankQuery, { feature: LEAN_RPG_FEATURE }),
            // The chat index of the latest reply that touched the Foes block, -1 when none (board/offers.js lastFoeTouch): the stale-foes rule reads it.
            [FOES_TOUCH_QUERY]: Object.assign((_state, _args, tools) => lastFoeTouch(tools?.receipts?.() ?? []), { feature: LEAN_RPG_FEATURE }),
            [ROLLS_QUERY]: Object.assign((_state, args, tools) => rollsOf(tools?.receipts?.() ?? [], Number.isInteger(args?.index) ? args.index : tools?.reply?.index), { feature: LEAN_RPG_FEATURE }),
            // The party's members and the reader's own Character, from the Character blocks (roster.js; fallbacks: a module that answers them itself is asked instead).
            ...rosterQueries({ persona, on: rosterOn }),
            // Every member's sheet level, those who left too (roster.js): for a module that shows or checks levels.
            'party.levels': Object.assign(levelsQuery, { feature: LEAN_RPG_FEATURE }) },
        hooks: {
            canGenerate: Object.assign((view, info) => precall.canGenerate(view, info), { feature: LEAN_RPG_FEATURE }),
            // The foe pre-check may call the model once (PRECHECK_LIMIT_MS, or `timeoutMs`): the hook may take that long and a little more.
            beforeGenerate: Object.defineProperty((view, info) => view?.feature?.(LEAN_RPG_FEATURE) === true ? precall.beforeGenerate(view, info) : null, 'timeoutMs', { enumerable: true, get: () => (timeoutMs ?? PRECHECK_LIMIT_MS) + 2000 }),
            afterCapture: (view, info) => {
                precall.afterCapture(view);
                // The fight's XP, then the rolled skills' practice: two steps after the reply's lines.
                const commands = [fightHook(view, info), practiceHook(view, info), checksHook(view, info)].flatMap(out => out?.commands ?? []);
                return commands.length ? { commands } : undefined;
            },
            // Every reply, whatever else answers afterCapture and with or without change lines: the one-time "send without the RPG" flag goes.
            afterReceive: view => { precall.afterCapture(view); },
        },
        settings: { defaults: { ...DEFAULT_SETTINGS }, schema: SETTINGS_SCHEMA },
        guard: leanRpgGuard,
    };
}
