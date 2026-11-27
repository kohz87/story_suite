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
import { wearOfV1 } from './v1-wear.js';
import { waitsOf, withoutWaits } from './v1-away.js';
import { stanceAfter, stanceHeldOff } from './v1-stance.js';
import { gearQuery } from './gear-query.js';
import { gearSoakRecord, sheetWithGear } from '../gear.js';
import { hordeFrom, wordsOf } from './horde-build.js';
import { blockWords } from './horde-block.js';
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

// The sheet the engine rolls with: a fight made with the mark (`gearStats: 1`) has each hero's worn pieces' stats added (read live, as soak is); a fight before it rolled with the sheet's own stats.
const rollSheet = (state, setup, sheet) => (setup.gearStats === 1 ? sheetWithGear(sheet, gearQuery(real(state))) : sheet);

/** The engine's input and the heroes' module ids for `setup` on `state`'s sheet. */
function inputOf(state, setup) {
    const sheet = readSheet(real(state)), input = withoutWaits(fightInputOf(rollSheet(state, setup, sheet), { carried: setup.carried ?? null }), setup);
    const soak = soakOf(state, sheet);   // (read live: a piece worn between two replies reaches the next segment, and the witness holds the same number)
    input.party = input.party.map(hero => ({ ...hero, gearSoak: Number(soak[hero.id]) || 0 }));
    return { sheet, input };
}

// One step's inputs → the engine's choices, keyed by the hero's key (an input names its hero by actor id; the board's older buttons name it in `who`).
// The first step of a reply: a pick with no stance switch takes the one the earlier replies left (`carried`, actor id → false).
function choicesOf(sheet, step, carried = {}) {
    const byActor = new Map(sheet.characters.filter(character => character.v1 === true).map(character => [actorIdOf(character.module), character.key]));
    const out = {};
    for (const input of step.inputs) {
        const key = byActor.get(input.actor) ?? fold(String(input.args?.who ?? ''));
        if (!key) continue;
        const { who, ...rest } = plain(input.args) ? input.args : {};
        out[key] = { ...rest, kind: input.choice, ...(rest.stance === undefined && carried[input.actor] === false ? { stance: false } : {}) };
    }
    return out;
}

function playedOf(state, setup, steps, dice) {
    const { sheet, input } = inputOf(state, setup);
    if (!input.party.length || !input.foes.length) throw new Error('There is no fight to play.');
    const record = playBoard(input, { dice, ...(setup.start ? { start: structuredClone(setup.start) } : {}), ...(setup.fleeIdle === 1 ? { fleeIdle: true } : {}), ...(setup.speedFull === 1 ? { speedFull: true } : {}), ...(setup.soakWhole === 1 ? { soakWhole: true } : {}), ...(setup.horde ? { horde: structuredClone(setup.horde) } : {}) }, steps.map((step, at) => choicesOf(sheet, step, at === 0 ? setup.stance : {})));
    return { sheet, input, record };
}

// The wear the fight costs the worn gear (a setup with the mark `gearWear: 1` only; one opened before it wears nothing): read live from the worn pieces, as soak is.
function wearOf(state, setup, played) {
    if (setup.gearWear !== 1) return null;
    const query = gearQuery(real(state)), modules = Object.fromEntries(played.sheet.characters.filter(character => character.v1 === true).map(character => [character.key, character.module]));
    const out = wearOfV1(played.record, { modules, slotsOf: owner => query('inventory.gear', { owner })?.slots });
    return out.events.length ? out : null;
}

const mapped = (state, setup, played) => fightResultV1(setup, played.record, { sheet: played.sheet, groups: played.input.groups, wear: wearOf(state, setup, played) });

// With "Companions who are away wait" on, the companions the story has away sit this fight out (`waits`, with their level) and `awayXp` is the percent they are paid of a win; recorded now, so the fight settles the same on every replay.
const waitMark = (state, sheet, away) => {
    const waits = away?.wait === true ? waitsOf(state.domains.away, sheet, standingHero) : [];
    return waits.length ? { waits, ...(Number.isInteger(away.xp) && away.xp > 0 ? { awayXp: Math.min(100, away.xp) } : {}) } : {};
};

/** The first setup of a fight on a v1 sheet: every filled foe group fights, the party is every standing hero. `error` when no one can fight. */
function openV1(state, { anchor, seed, attempt = 0, args = {} }) {
    const sheet = readSheet(real(state)), front = sheet.foes.filter(foe => foe.v1 === true && foe.filled), groups = front.map(foe => foe.slot);
    if (!sheet.characters.some(standingHero) || !groups.length) return { error: 'There is no fight to open.' };
    // (a horde, 21 Nov: the pre-check's words, else the narrator's horde line on the Foes block; code builds the reserve from them and the front once, here, and the setup keeps it.
    // A resumed fight is never a horde: a fled or lost horde leaves no reserve to come back to.)
    const horde = args.resumed ? null : hordeFrom(wordsOf(args.horde) ?? blockWords(real(state), front), front);
    // (`soakWhole`: soak takes off only the whole points it adds up to, so 6% on a 3-damage hit takes nothing, 22 Nov (owner); a fight opened before rounds the damage left down)
    // (`speedFull`: a Speed stance adds its full mastery to evasion, 20 Nov; `gearStats`: the stats of the worn gear count in every roll, 20 Nov; `gearWear`: a decisive hit taken wears the body armour (else the off-hand) and a decisive miss the weapon, one step, v1-wear.js, 20 Nov; a fight opened before it rolls with the sheet's stats; `fleeIdle`: a member who picked nothing pays no stance in an exchange where the party flees and gets away, combat/exchange.js; a fight opened before the mark has none; `xpRule: 'each2'`: the XP of 15 for each foe at the tier's own factor, 20 Nov evening; 'each' (that afternoon) keeps mob 0.5 / minion 0.75; a setup without one pays per group as before)
    const setup = { id: `${anchor}:${attempt}`, v1: 1, fleeIdle: 1, xpRule: 'each2', gearStats: 1, gearWear: 1, speedFull: 1, soakWhole: 1, groups, offset: 0, rules: structuredClone(args.rules ?? {}), practice: practiceOf(args.practice) ?? PRACTICE.perUse, ...(xpRateOf(args.rate) === null ? {} : { rate: args.rate }), ...waitMark(state, sheet, args.away),
        ...(Array.isArray(args.resumed?.foes) && args.resumed.foes.length ? { resumed: true, carried: { foes: structuredClone(args.resumed.foes) } } : {}), ...(horde ? { horde } : {}) };
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

// Auto is the engine's own policy for that hero, and a stance switched off stays off: by the switch as the player left it for this exchange (`held`, actor id → on or off), else by the steps before and the replies before
// (read from the stored steps and setup: a swipe, a Re-read, a rewind and a reload give the same input; the input stored holds the stance, so replaying it needs no `held`).
function autoInput(state, setup, steps = [], actor = '', held = null) {
    const said = held?.[actor], off = typeof said === 'boolean' ? !said : stanceHeldOff(setup, steps, actor);
    return { choice: 'auto', args: off ? { stance: false } : said === true ? { stance: true } : {} };
}

/** Everything the kind's hooks use for a v1 fight (`isV1`/`sheet` tell whether a setup or a state is one): Auto is the engine's own automatic policy for that hero; the next setup carries the start and the foes' bars; the witness is what the engine reads. */
export const V1 = Object.freeze({
    isV1, sheet: v1Sheet, open: openV1, play: playV1, settle: settleV1,
    auto: autoInput,
    soak: soakOf,
    next(setup, result, steps = []) {
        const out = structuredClone(setup), exchanges = Number(result.exchanges);
        if (Number.isInteger(exchanges) && exchanges >= 1) {
            out.offset = exchanges;
            out.start = { offset: exchanges, order: structuredClone(result.order), rotation: Number(result.rotation) || 0, ...(result.horde ? { horde: structuredClone(result.horde) } : {}) };
            out.carried = { foes: structuredClone(result.foes), order: structuredClone(result.order) };
            const held = stanceAfter(setup, steps);
            if (Object.keys(held).length) out.stance = held; else delete out.stance;
        }
        for (const key of ['opening', 'opened', 'approach', 'drop']) delete out[key];
        return out;
    },
    witness: (state, setup) => ({ ...witnessOf(rollSheet(state, setup, readSheet(real(state)))), soak: soakOf(state, readSheet(real(state))), groups: setup.groups }),
    validate: (state, setup, steps, step) => (step.inputs.every(input => plain(input.args) && typeof input.choice === 'string' && KINDS.includes(input.choice)
        && (input.args.target === undefined || typeof input.args.target === 'string')) ? null : 'Choose an action for each standing member.'),
    actors: state => readSheet(real(state)).characters.filter(standingHero).map(character => ({ id: actorIdOf(character.module), name: character.who, party: true })),
});
