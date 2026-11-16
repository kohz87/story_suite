// The fight board as an interaction kind (`story-block/fight`): play, settle, witness, actors, Auto and the next segment over today's engine; a setup marked `v1: 1` goes to board/v1-kind.js (the Combat Rules v1 engine).
// A step is one exchange. `toExchanges(steps)` hands the engine exactly the exchanges the pre-port board kept, so dice and results do not move.
import { PRACTICE, practiceOf } from '../names.js';
import { xpRateOf } from '../levels.js';
import { fold, readSheet } from '../read.js';
import { carriedFrom } from './members.js';
import { actorIdOf } from '../roster.js';
import { settledNote } from './note.js';
import { autoPicks } from './auto.js';
import { boardWitness, equipmentForBoard, playBoard } from './engine.js';
import { gearQuery } from './engine-parts/shared-gear.js';
import { fightChanges, fightResult } from './settle-map.js';
import { standing } from './plan.js';
import { hardFightFor } from './flags.js';
import { boardFlags } from './overrides.js';
import { BOARD_CLEAR_FOES as CLEAR_FOES, BOARD_HURTS as HURTS } from '../names.js';
import { FIGHT_STATIC } from './kind-static.js';
import { openingNote, openingOf, openingSetup, openingWitness } from './opening.js';
import { V1 } from './v1-kind.js';
import { openingV1 } from './v1-opening.js';
import { settledNoteV1 } from '../combat/note.js';

const KINDS = ['attack', 'skill', 'flee', 'item'];
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** One input of a step → the board's action object, field for field (`args` holds `who` and the rest; `choice` is the action's `kind`). */
export const toAction = input => ({ ...input.args, kind: input.choice });
/** A step's inputs → the board's `actions` for one exchange. */
export const toActions = step => step.inputs.map(toAction);
/** The steps → the engine's `exchanges`, as the pre-port board stored them. */
export const toExchanges = steps => steps.map(step => ({ actions: toActions(step) }));

// What the kind's pure functions read: the three domains the board's own commit read (a plain object, so the engine may clone it).
const real = state => ({ domains: { dataModules: state.domains.dataModules, inventory: state.domains.inventory, scene: state.domains.scene } });
const doubled = sheet => sheet.characters.length > 0 && sheet.characters.every(actor => actor.scale === 2);
const idOf = actor => actorIdOf(actor.module);

function openSetup(state, { anchor, seed, attempt = 0, args = {} }) {
    // A pre-check offer's opening (interaction/start.js): no foe stands yet, so the setup is the opening's own (board/opening.js).
    if (args.opening) { const made = openingSetup({ ...args.opening, anchor }); return V1.sheet(state) && made.setup ? { setup: { ...made.setup, v1: 1, ...(xpRateOf(args.opening.rate) === null ? {} : { rate: args.opening.rate }) } } : made; }
    if (V1.sheet(state)) return V1.open(state, { anchor, seed, attempt, args });
    const sheet = readSheet(real(state)), groups = sheet.foes.filter(foe => foe.filled && foe.hurt > 0).map(foe => foe.slot);
    if (!sheet.characters.some(actor => actor.alive !== false && actor.health !== 0) || !groups.length) return { error: 'There is no fight to open.' };
    const resumed = args.resumed ?? null, opened = Array.isArray(args.opened) && args.opened.length ? structuredClone(args.opened) : null;
    const hard = sheet.foes.some(foe => foe.filled) && hardFightFor(sheet);
    // (`bars: 2` and `soak: 1` only when every character has the doubled bars; the rest of the marks are the pre-port board's own)
    const setup = { id: `${anchor}:${attempt}`, groups, ...(resumed ? { resumed: true } : {}), seed, offset: 0, rules: structuredClone(args.rules),
        practice: practiceOf(args.practice) ?? PRACTICE.perUse, members: 1, aoe: 1, areaAll: 1, foesSix: 1, foesClear: 1, fightLen: 1, ...(hard ? { foesHard: 1 } : {}),
        ...(doubled(sheet) ? { bars: 2, soak: 1 } : {}), ...(resumed ? { carriedMembers: structuredClone(resumed) } : {}), ...(opened ? { opened } : {}), ...(Array.isArray(args.approach) ? { approach: structuredClone(args.approach) } : {}), ...(args.drop ? { drop: structuredClone(args.drop) } : {}),
        flags: boardFlags(real(state)), weapons: structuredClone(args.weapons ?? {}), ...(args.gear ? { gear: structuredClone(args.gear) } : {}) };
    const preview = playBoard(real(state), setup, []);
    return preview.error ? { error: preview.error } : { setup };
}

function play(state, setup, steps, dice) {
    if (V1.isV1(setup)) return V1.play(state, setup, steps, dice);
    const played = playBoard(real(state), setup, toExchanges(steps));
    if (played.error) return { error: played.error };
    return { view: { result: played.result }, result: fightResult(real(state), setup, played.result), stop: played.result.stop };
}

function settle(state, setup, steps, dice) {
    if (V1.isV1(setup)) return V1.settle(state, setup, steps, dice);
    const played = playBoard(real(state), setup, toExchanges(steps));
    if (played.error) throw new Error(played.error);
    const result = fightResult(real(state), setup, played.result);
    return { result, stop: result.stop, changes: fightChanges(real(state), setup, result) };
}

// The Auto button's pick for one actor: the board's own deterministic choice on the sheet the steps so far leave.
function auto(state, setup, steps, actorId) {
    if (V1.isV1(setup)) return V1.auto();
    const now = playBoard(real(state), setup, toExchanges(steps));
    if (now.error || now.result.stop !== 'open') throw new Error(now.error ?? 'The fight has ended.');
    const gear = setup.gear ? equipmentForBoard(now.state, setup.gear) : {};
    const picks = autoPicks({ state: now.state, setup: { ...setup, ...gear }, members: now.result.members, number: setup.offset + steps.length + 1 }, setup.rules);
    const mine = readSheet(now.state).characters.find(actor => idOf(actor) === actorId), pick = picks.find(item => mine && fold(item.who) === fold(mine.who));
    if (!pick) throw new Error('Auto found nothing to do.');
    const { kind, ...args } = pick;
    return { choice: kind, args };
}

// The next segment's setup: the offset moves on, the order and member bars carry, and what only the first segment used is dropped (the pre-port carry).
function next(setup, result, state) {
    if (V1.isV1(setup)) return V1.next(setup, result);
    const out = { ...structuredClone(setup), offset: setup.offset + result.rounds.length, order: structuredClone(result.order ?? []) };
    const carried = setup.members === 1 ? carriedFrom(result.members) : null;
    if (carried) out.carriedMembers = carried; else delete out.carriedMembers;
    for (const key of ['witness', 'opening', 'approach', 'drop', 'opened']) delete out[key];
    if (out.gear && state) Object.assign(out, equipmentForBoard(real(state), out.gear, gearQuery(real(state))));   // (the carry refreshes the load from the live inventory, as the pre-port carry did)
    return out;
}

const validate = (state, setup, steps, step) => (V1.isV1(setup) ? V1.validate(state, setup, steps, step) : step.inputs.every(input => plain(input.args) && typeof input.args.who === 'string' && KINDS.includes(input.choice)) ? null : 'Choose an action for each standing member.');

/** The kind definition the module registers as `story-block/fight`. */
export const fightKind = Object.freeze({
    ...FIGHT_STATIC, ready: () => true,
    actors: state => (V1.sheet(state) ? V1.actors(state) : readSheet(real(state)).characters.filter(standing).map(actor => ({ id: idOf(actor), name: actor.who, party: true }))),
    open: (state, context) => openSetup(state, context),
    opening: (state, setup, dice) => (V1.isV1(setup) ? openingV1(real(state), setup, dice) : openingOf(real(state), setup, dice)),
    witness: (state, setup, steps) => (V1.isV1(setup) && setup.opening !== true ? V1.witness(state, setup) : setup.opening === true ? openingWitness(real(state)) : { board: boardWitness(real(state), setup), ...usedItems(state, steps) }),
    validate, play, settle, auto, next,
    note: (result, setup, context) => (context?.opening ? openingNote(result) : V1.isV1(setup) ? settledNoteV1(result).split(' | ') : settledNote(result, setup).split(' | ')),
});

// The stacks a fight's item actions named (owner 14 Nov): what each holds and restores, so taking back the reply that gave the item makes the fight roll again.
// A fight with no item action adds nothing, so unrelated bag changes never take it back. `steps` is the replay guard's own argument; the stage-time check has none.
function usedItems(state, steps) {
    if (!Array.isArray(steps)) return {};
    const ids = [...new Set(steps.flatMap(step => (Array.isArray(step?.inputs) ? step.inputs : [])).filter(input => input?.choice === 'item' && plain(input.args)).map(input => String(input.args.stack)))].sort();
    if (!ids.length) return {};
    const inventory = state?.domains?.inventory;
    return { items: ids.map(id => {
        const stack = inventory?.stacks?.[id], def = stack ? inventory.defs?.[stack.def] : null;
        return { id, def: stack?.def ?? null, qty: stack?.qty ?? 0, owner: stack?.owner ?? null, name: def?.name ?? null, rarity: def?.rarity ?? null, tags: def?.tags ?? null };
    }) };
}
