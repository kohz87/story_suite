// The `rpg.fight` step of a Combat Rules v1 fight: it pays nothing (the settle did, board/v1-award.js, BEFORE the reply's story lines) and puts back the practice a story line of the same reply added to a skill the fight practised.
// Why: the v1 Skills block has a `practice-N` line the narrator may write; the old fight's rule is that code sets the number, so what the story added to those slots in the winning reply is not used (one Problems line says so).
// (The v1 Character has no XP line, so the XP needs no hold.) The step is a guarded block on the reply, like the old fight steps: a swipe or a delete takes it away, a Re-read plans it again on the new story.
import { FIGHT } from '../names.js';
import { createEvaluation } from '../../data-modules/interpreter.js';
import { PRACTICE_HELD } from '../practice-parts/give.js';
import { fromOf, itemsOf, witnessOf } from '../practice-parts/slots.js';
import { CLAIM, isObject, whole } from './shared-values.js';

const text = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const PREDICATE = Object.freeze({ kind: FIGHT, v1: 1 });

/** The step's payload `{ v1: 1, claim, uses: [{ who, skill }] }` checked, or null. */
export const holdShape = payload => (isObject(payload) && payload.v1 === 1 && typeof payload.claim === 'string' && CLAIM.test(payload.claim)
    && Array.isArray(payload.uses) && payload.uses.length >= 1 && payload.uses.length <= 40 && payload.uses.every(use => isObject(use) && text(use.who) && text(use.skill))
    ? { v1: 1, claim: payload.claim, uses: payload.uses.map(({ who, skill }) => ({ who, skill, n: 1 })) } : null);

/** `rpg.fight { v1: 1, claim, uses }`: puts back what the story practised on the skills the fight practised. NO_LONGER_DONE when the settle it was for is gone. */
export function holdStepV1(ctx, payload) {
    if (ctx.cause !== 'system' || ctx.caller !== null) ctx.fail('REFUSED', 'The practice of a fight is given by Story Block, not by an action.');
    const given = holdShape(payload);
    if (!given) ctx.fail('INVALID', 'The fight\'s practice hold was damaged.');
    // (the claim of this reply's settle is held while that settle stands; a delete or a Re-read that took the fight back leaves it free, and the step goes)
    if (ctx.claim(given.claim)) ctx.fail('NO_LONGER_DONE', 'The fight this practice was for was taken back.');
    const domain = ctx.read('dataModules'), items = itemsOf(domain, given.uses);
    ctx.replayGuard({ owner: ctx.module, version: 2, epoch: ctx.epoch, rulesHash: null, predicate: PREDICATE, inputHash: ctx.hash({ source: ctx.source, predicate: PREDICATE, witness: witnessOf(domain, ctx.source, given.uses) }) },
        { v1: 1, claim: given.claim, uses: given.uses.map(({ who, skill }) => ({ who, skill })) });
    const from = fromOf(domain, ctx.source), draft = ctx.draft('dataModules');
    let held = 0;
    for (const item of items) {
        const was = from[item.module]?.[String(item.slot)], instance = draft.instances?.[item.module]?.chat, fields = instance?.fields, definition = draft.pins?.[draft.active?.[item.module]?.hash]?.definition;
        if (!was || !isObject(fields) || !whole(fields[`practice${item.slot}`]) || (fields[`practice${item.slot}`] === was.practice && fields[`rank${item.slot}`] === was.rank)) continue;
        held += 1;
        if (isObject(definition?.state) && Array.isArray(definition.rules)) {
            const evaluation = createEvaluation(definition, instance, { inputs: {}, source: {}, cursor: null, subject: 'chat' });
            evaluation.effects([{ op: 'set', path: [`practice${item.slot}`], value: was.practice }, { op: 'set', path: [`rank${item.slot}`], value: was.rank }]);
            evaluation.rules();
            evaluation.finish();
        } else Object.assign(fields, { [`practice${item.slot}`]: was.practice, [`rank${item.slot}`]: was.rank });
    }
    return { summary: '', narrate: false, replan: true, data: { v2: { result: { fightHold: { skills: held } } } }, ...(held ? { problem: PRACTICE_HELD } : {}) };
}

/** The replay guard of that step (fightGuard routes a `v1` record here): it stands while the claim stands and the practice numbers it used are what the prefix holds. */
export function holdGuardV1({ state, hash }, { guard, source, recorded }) {
    const given = holdShape(recorded);
    if (!given || guard?.version !== 2 || guard.rulesHash !== null || guard.predicate?.kind !== FIGHT || guard.predicate.v1 !== 1) return { ok: false, reason: 'The fight\'s practice hold was damaged.' };
    if (state.meta?.claims?.[given.claim] !== true) return { ok: false, reason: 'The fight this practice was for was taken back.' };
    return hash({ source, predicate: guard.predicate, witness: witnessOf(state.domains?.dataModules, source, given.uses) }) === guard.inputHash ? { ok: true } : { ok: false, reason: 'The sheet before this step changed; Re-read this reply.' };
}
