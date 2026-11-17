// The fight kind on the Combat Rules v1 engine (combat/*): what the kind's `open`, `play`, `settle`, `auto`, `next`, `witness` and `validate` do for a fight whose stored setup carries the v1 mark.
// A setup without the mark is a fight made before this engine (the pre-C6 port's own) and is played by board/interaction.js on the old engine, exactly as before.
// Dice are the port's own (`dice(seed, offset)`, the fourth argument of `play` and `settle`): never stored, so a swipe, a Re-read, a rewind and a reload draw the same numbers.
// A fight across replies carries its start (`start`: the exchanges played, the fixed order and the foe rotation) and its foes' bars (`carried`) in the next setup, because a v1 foe has no block field of its own.
import { PRACTICE, practiceOf } from '../names.js';
import { xpRateOf } from '../levels.js';
import { fold, readSheet } from '../read.js';
import { actorIdOf } from '../roster.js';
import { fightInputOf, witnessOf } from '../combat/input.js';
import { playBoard } from '../combat/play.js';
import { fightChangesV1, fightResultV1 } from './v1-settle.js';
import { gearQuery } from './gear-query.js';
import { gearSoakRecord } from '../gear.js';
import { dice as portDice } from '../../../core/interaction/dice.js';

const KINDS = ['auto', 'attack', 'skill', 'area', 'normal', 'heal', 'flee'];
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const real = state => ({ domains: { dataModules: state.domains.dataModules, inventory: state.domains.inventory, scene: state.domains.scene } });
const standingHero = character => character.v1 === true && character.alive !== false && character.hp > 0;

/** True for a setup the v1 engine plays. */
const isV1 = setup => setup?.v1 === 1;
/** True when the sheet is a Combat Rules v1 one: a v1 Character stands (the old engine cannot read it). */
const v1Sheet = state => readSheet(real(state)).characters.some(character => character.v1 === true);

// What each hero's worn pieces soak (the Bag's `inventory.gear` answers; the first hero also holds the party's shared bag). Soak is read live, by the engine's input and by the witness.
function soakOf(state, sheet) {
    const query = gearQuery(real(state)), out = {};
    sheet.characters.filter(character => character.v1 === true).forEach((character, at) => {
        const total = gearSoakRecord([actorIdOf(character.module), ...(at === 0 ? ['party'] : [])], owner => query('inventory.gear', { owner })).total;
        if (total > 0) out[character.key] = total;
    });
    return out;
}

/** The engine's input and the heroes' module ids for `setup` on `state`'s sheet. */
function inputOf(state, setup) {
    const sheet = readSheet(real(state)), input = fightInputOf(sheet, { carried: setup.carried ?? null });
    const soak = soakOf(state, sheet);   // (read live: a piece worn between two replies reaches the next segment, and the witness holds the same number)
    input.party = input.party.map(hero => ({ ...hero, gearSoak: Number(soak[hero.id]) || 0 }));
    return { sheet, input };
}

// One step's inputs → the engine's choices, keyed by the hero's key (an input names its hero by actor id; the board's older buttons name it in `who`).
function choicesOf(sheet, step) {
    const byActor = new Map(sheet.characters.filter(character => character.v1 === true).map(character => [actorIdOf(character.module), character.key]));
    const out = {};
    for (const input of step.inputs) {
        const key = byActor.get(input.actor) ?? fold(String(input.args?.who ?? ''));
        if (!key) continue;
        const { who, ...rest } = plain(input.args) ? input.args : {};
        out[key] = { ...rest, kind: input.choice };
    }
    return out;
}

function playedOf(state, setup, steps, dice) {
    const { sheet, input } = inputOf(state, setup);
    if (!input.party.length || !input.foes.length) throw new Error('There is no fight to play.');
    const record = playBoard(input, { dice, ...(setup.start ? { start: structuredClone(setup.start) } : {}) }, steps.map(step => choicesOf(sheet, step)));
    return { sheet, input, record };
}

const mapped = (state, setup, played) => fightResultV1(setup, played.record, { sheet: played.sheet, groups: played.input.groups });

/** The first setup of a fight on a v1 sheet: every filled foe group fights, the party is every standing hero. `error` when no one can fight. */
function openV1(state, { anchor, seed, attempt = 0, args = {} }) {
    const sheet = readSheet(real(state)), groups = sheet.foes.filter(foe => foe.v1 === true && foe.filled).map(foe => foe.slot);
    if (!sheet.characters.some(standingHero) || !groups.length) return { error: 'There is no fight to open.' };
    const setup = { id: `${anchor}:${attempt}`, v1: 1, groups, offset: 0, rules: structuredClone(args.rules ?? {}), practice: practiceOf(args.practice) ?? PRACTICE.perUse, ...(xpRateOf(args.rate) === null ? {} : { rate: args.rate }),
        ...(Array.isArray(args.resumed?.foes) && args.resumed.foes.length ? { resumed: true, carried: { foes: structuredClone(args.resumed.foes) } } : {}) };
    try { playedOf(state, setup, [], portDice(seed, 0)); } catch (error) { return { error: error.message }; }
    return { setup, seed };
}

/** `{ view, result, stop }`: the fight so far (the port's preview). */
function playV1(state, setup, steps, dice) {
    const played = playedOf(state, setup, steps, dice);
    const result = mapped(state, setup, played);
    return { view: { result: played.record }, result, stop: result.stop };
}

/** The settled fight: the record the readers know and the calls that write the party's new bars and clear the ended groups. */
function settleV1(state, setup, steps, dice) {
    const played = playedOf(state, setup, steps, dice), result = mapped(state, setup, played);
    return { result, stop: result.stop, changes: fightChangesV1(result, played.sheet) };
}

// Auto is the engine's own policy for that hero, and a stance the hero's last exchange had switched off stays off (read from the steps before: a swipe, a Re-read, a rewind and a reload give the same input).
function autoInput(state, setup, steps = [], actor = '') {
    const last = steps.at(-1)?.inputs?.find(input => input?.actor === actor);
    return { choice: 'auto', args: last?.args?.stance === false ? { stance: false } : {} };
}

/** Everything the kind's hooks use for a v1 fight (`isV1`/`sheet` tell whether a setup or a state is one): Auto is the engine's own automatic policy for that hero; the next setup carries the start and the foes' bars; the witness is what the engine reads. */
export const V1 = Object.freeze({
    isV1, sheet: v1Sheet, open: openV1, play: playV1, settle: settleV1,
    auto: autoInput,
    soak: soakOf,
    next(setup, result) {
        const out = structuredClone(setup), exchanges = Number(result.exchanges);
        if (Number.isInteger(exchanges) && exchanges >= 1) {
            out.offset = exchanges;
            out.start = { offset: exchanges, order: structuredClone(result.order), rotation: Number(result.rotation) || 0 };
            out.carried = { foes: structuredClone(result.foes), order: structuredClone(result.order) };
        }
        for (const key of ['opening', 'opened', 'approach', 'drop']) delete out[key];
        return out;
    },
    witness: (state, setup) => ({ ...witnessOf(readSheet(real(state))), soak: soakOf(state, readSheet(real(state))), groups: setup.groups }),
    validate: (state, setup, steps, step) => (step.inputs.every(input => plain(input.args) && typeof input.choice === 'string' && KINDS.includes(input.choice)
        && (input.args.target === undefined || typeof input.args.target === 'string')) ? null : 'Choose an action for each standing member.'),
    actors: state => readSheet(real(state)).characters.filter(standingHero).map(character => ({ id: actorIdOf(character.module), name: character.who, party: true })),
});
