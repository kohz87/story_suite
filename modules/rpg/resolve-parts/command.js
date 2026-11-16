// The `rpg.resolve { key, plan }` command: opens foes, applies gear, rolls the plan and records the result.
import { FIX_VERSION, LEVEL, LV_VERSION, RESOLVE, practiceOf } from '../names.js';
import { resolveBoard } from '../board/commit.js';
import { hasLevels } from '../rules.js';
import { cueOfResult } from '../cue.js';
import { readSheet } from '../read.js';
import { validatePlan } from '../plan.js';
import { openFoes } from '../open.js';
import { applyGear, earnedLegend, gearMarkOf, noteGear, planGear, wearGear } from '../gear.js';
import { condWord, stepDown } from '../../../packages/story-block/src/v2/domains/gear.js';
import { partyLevels, averageLevel, settleOpen } from '../foes.js';
import { carriedFrom } from '../ambush.js';
import { FLOW_VERSION, positionalDice } from '../resolve/dice.js';
import { DICE_VERSION, RESULT_VERSION, claimKey } from './versions.js';
import { prepare, rollPrepared, fieldMax } from './roll.js';
import { orderOf, rulesOfPayload, staleOf } from './payload.js';

const KEY = /^\d{1,7}-[0-9a-z]{1,7}$/;

// The blocks the told rolls took or gave, written to the bars: the same fields the narrator's change lines and the reader's pencils set.
function writeBars(ctx, hurts) {
    if (!hurts.length) return;
    const instances = ctx.draft('dataModules')?.instances;
    for (const hurt of hurts) {
        const fields = instances?.[hurt.module]?.chat?.fields;
        if (fields && Object.hasOwn(fields, hurt.field)) fields[hurt.field] = hurt.to;
    }
}

// The levels a roll gave its opened foes, in the plan's order (recorded with the roll, as the guard cannot draw them again).
const levelsOf = settled => settled.map(entry => entry.level);

// A payload that says `lv: 1` rolls with levels (rules.levelDivisor, 5 if the numbers carry none); one that does not rolls with the Soul Class, as before.
const levelledRules = (rules, lv) => (lv === LV_VERSION && !hasLevels(rules) ? { ...rules, levelDivisor: LEVEL.divisor } : rules);
// The flow a payload asks for: FLOW_VERSION only when it says so (a roll of the earlier flow stops as it did).

const flowOf = (asked, positional) => (asked === FLOW_VERSION && positional ? FLOW_VERSION : 1);

const guardOf = (ctx, predicate, witness) => ({ owner: ctx.module, version: 2, epoch: ctx.epoch, rulesHash: null, predicate, inputHash: ctx.hash({ source: ctx.source, predicate, witness }) });

/**
 * `rpg.resolve { key, plan }`: the command (a prelude: turn.js previews it with a seed and stores it on the generated
 * reply with the same seed). `key` is the reader's message (its index and a hash of its text), as Assist's pre-roll keys it.
 */
export function resolve(ctx, payload = {}) {
    if (payload?.board !== undefined) return resolveBoard(ctx, payload);
    if (ctx.cause !== 'system' || ctx.caller !== null) ctx.fail('REFUSED', 'Rolls are made by Story Block before a reply, not by an action.');
    const key = String(payload?.key ?? '');
    if (!KEY.test(key)) ctx.fail('INVALID', 'A roll needs the key of the message it was made for.');
    const start = payload.start;
    if (start !== undefined && (typeof start !== 'string' || !start || start.length > 120)) ctx.fail('INVALID', 'The fight opening is damaged.');
    const checked = validatePlan(payload?.plan);
    if (!checked.ok) ctx.fail('INVALID', `That is not a plan: ${checked.errors[0]}`);
    const plan = payload.plan;
    const order = orderOf(payload.order);
    // A drop an earlier reply's ambush check gave (precall.js carries it in the payload, as it does a fight's turn order): spent on this roll's acts.
    const drop = carriedFrom(payload.ambush);
    // The numbers this roll is made with are the ones the payload carries (chosen when it was planned, from the settings of that
    // moment); a Re-read, a rebuild and a reload run the same payload, so they roll with them again. The settings are never read here.
    const rules = levelledRules(rulesOfPayload(payload.rules), payload.lv);
    const lv = hasLevels(rules) ? LV_VERSION : undefined;
    // The flow of stage 49 is asked for by the payload (precall.js) and needs the dice by position; a roll made before has none and stops as it did.
    const flow = flowOf(payload.flow, true);
    // A fight the pre-call opened (open.js): its foes are put in free slots of the Foes block first, through the block's own set-slot kind, and the
    // roll is made on the sheet that leaves. A plan with no `open` reads the block as it stands, as ever.
    // From the Levels rules (`lv` in the payload) each foe has a level: the one the plan gave, or one drawn inside a rank's band or near the party's average level,
    // from the reply's own seed (the first number it gives, which the dice by position then use as well), so a swipe draws anew and a Re-read keeps it.
    const base = Math.floor(ctx.rng() * 4294967296) >>> 0;
    const opening = Array.isArray(plan.open) && plan.open.length > 0;
    const domain = opening ? ctx.draft('dataModules') : ctx.read('dataModules');
    const settled = opening && lv ? settleOpen(plan.open, averageLevel(partyLevels(readSheet({ domains: { dataModules: domain } }))), base) : null;
    const fix = [2, FIX_VERSION].includes(payload.fix) ? payload.fix : undefined;
    const stale = staleOf(payload.stale);
    const opened = opening ? openFoes(domain, settled ?? plan.open, { fix: fix ?? 1, stale: stale ?? [] }) : null;
    // From a roll that carries the gear mark (precall.js, while `story-block.gear` is on) the worn pieces and the load, worked out here from the state before the
    // roll (the inventory's `recorded` answers: the mark decides, not today's switch), are laid over the stats it rolls with (gear.js). The record is kept with the
    // roll, so a later change never moves it; a change before it is seen by the guard.
    const standing = readSheet({ domains: { dataModules: domain } });
    const noXp = standing.characters.length > 0 && standing.characters.every(character => character.scale === 2);
    const mark = gearMarkOf(payload.gear);
    const gear = mark ? planGear(standing, (name, args) => ctx.query(name, ['inventory.gear', 'party.actors', 'party.pc'].includes(name) ? { ...args, recorded: true } : args), mark.lead ?? '') ?? undefined : undefined;
    const sheet = applyGear(standing, gear);
    const prepared = prepare(plan, sheet, rules, { maxOf: fieldMax(domain), flow, lv: Boolean(lv), fix: fix >= 2, then: fix >= 3 });
    if (opening) prepared.witness = { ...prepared.witness, opened };
    if (!opening && !prepared.acts.length && !prepared.foes.length && !prepared.checks.length) ctx.fail('NO_LONGER_DONE', 'Nothing is left to roll on this sheet.');
    const claim = start ? `${claimKey(`start:${encodeURIComponent(start)}`)}:reply:${ctx.reply?.sid ?? ''}` : claimKey(key);
    if (!ctx.claim(claim)) ctx.fail('CLAIMED', 'This message has already been rolled for.');
    // A roll that asks for the dice version draws one number from the seed, and each action's dice come from that and its place in
    // the plan; one made before has no version and draws its dice in one sequence, as it did.
    const source = positionalDice(base);
    const dice = rollPrepared(plan, prepared, source, rules, { earlier: payload.dice !== DICE_VERSION, carried: order, drop, opened: opened ?? null, fix: fix >= 2, then: fix >= 3, flow, noXp, wearOf: gear ? (rounds, opening) => wearGear(ctx, gear, { opening, rounds, rules, condWord, stepDown }) : null });
    // From stage 50 a payload may carry the practice per skill use (practice.js); a roll made before has none and gives none.
    const practice = practiceOf(payload.practice) ?? undefined;
    // Gear: each told line names what it rolled with, and a decisive hit taken or miss made wears a piece (gear.js); the wear is part of the roll's receipt.
    let wear = [], legend = false;
    if (gear) {
        noteGear([...dice.checks, ...(dice.opening ?? []), ...dice.rounds.flatMap(round => round.lines)], gear);
        wear = wearGear(ctx, gear, { opening: dice.opening ?? [], rounds: dice.rounds, rules, condWord });
        legend = earnedLegend(dice, sheet, lv === LV_VERSION);
    }
    const predicate = { kind: RESOLVE, key, ...(start ? { start } : {}), ...(stale ? { stale } : {}), plan: ctx.hash(plan), rules: ctx.hash(rules), ...(order ? { order: ctx.hash(order) } : {}), ...(drop ? { ambush: ctx.hash(drop) } : {}), ...(flow === FLOW_VERSION ? { flow } : {}), ...(fix ? { fix } : {}), ...(practice ? { practice } : {}), ...(lv ? { lv } : {}), ...(settled ? { levels: ctx.hash(levelsOf(settled)) } : {}), ...(gear ? { gear: ctx.hash(gear) } : {}) };
    ctx.replayGuard(guardOf(ctx, predicate, prepared.witness), { key, ...(start ? { start } : {}), ...(stale ? { stale } : {}), plan, rules, ...(order ? { order } : {}), ...(drop ? { ambush: drop } : {}), ...(flow === FLOW_VERSION ? { flow } : {}), ...(fix ? { fix } : {}), ...(practice ? { practice } : {}), ...(lv ? { lv } : {}), ...(settled ? { levels: levelsOf(settled) } : {}), ...(gear ? { gear } : {}) });
    const result = {
        v: RESULT_VERSION, key, pace: plan.pace, rules, ...(flow === FLOW_VERSION ? { flow } : {}), ...(noXp ? { noXp: true } : {}), ...(fix ? { fix } : {}), ...(practice ? { practice } : {}), ...(lv ? { lv } : {}), ...(gear ? { gear } : {}), stop: dice.stop, checks: dice.checks, rounds: dice.rounds,
        refused: prepared.refused, summary: dice.summary, ...(dice.ambush ? { ambush: dice.ambush } : {}), ...(opening ? { opened } : {}), ...(wear.length ? { wear } : {}), ...(legend ? { legend: 1 } : {}),
        order: dice.order, quickStart: dice.quickStart, opening: dice.opening, idle: dice.idle, hurts: dice.hurts,
    };
    writeBars(ctx, dice.hurts);
    // From stage 51 the receipt keeps no copy of the cue text: it is rebuilt from the record (cue.js cueOfResult) wherever it is told or shown. The text is
    // kept as it always was only if the record would not give back exactly the same bytes (so what is told never changes).
    // (with gear the wear lines were fitted into the cue's budget with the dice (cue.js fitCue `wearOf`); what was really worn is in the record, so the text is the record's)
    if (gear) dice.text = cueOfResult(result, dice.shape);
    const text = cueOfResult(result, dice.shape) === dice.text ? '' : dice.text;
    // (the shape the cue was fitted to is kept beside the record, not in it: a roll made before it is replanned without its record changing)
    return { summary: text, narrate: true, replan: true, data: { v2: { key: claim, result, ...(dice.shape ? { shape: dice.shape } : {}) } } };
}
