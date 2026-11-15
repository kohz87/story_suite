// The `rpg.practice` step and its replay guard.
import { PRACTICE_STEP, ROLLS_QUERY, practiceOf } from '../names.js';
import { isObject, whole, text } from './shared-values.js';
import { USES_PER_STEP } from './shared-limits.js';
import { itemsOf, witnessOf } from './slots.js';
import { PRACTICE_HELD, givePractice } from './give.js';

// The payload's uses, checked: a list of { who, skill, n } with n whole and at least 1. → the clean list, or null.
function usesFrom(value) {
    if (!Array.isArray(value) || !value.length || value.length > USES_PER_STEP) return null;
    const out = [];
    for (const entry of value) {
        if (!isObject(entry) || !text(entry.who) || !text(entry.skill) || !whole(entry.n) || entry.n < 1 || entry.n > 99) return null;
        out.push({ who: text(entry.who), skill: text(entry.skill), n: entry.n });
    }
    return out;
}

/** `rpg.practice { uses }`: the fight's guarded practice step, or NO_LONGER_DONE if no named skills remain. */
export function practiceStep(ctx, payload = {}) {
    if (ctx.cause !== 'system' || ctx.caller !== null) ctx.fail('REFUSED', 'Practice for rolled skills is given by Story Block after a reply, not by an action.');
    const uses = usesFrom(payload?.uses), perUse = practiceOf(payload?.perUse);
    if (!uses || perUse === null) ctx.fail('INVALID', 'The practice step needs the skills the rolls used.');
    // The roll these skills were used in stands on this same reply: when a delete or a Re-read took it back (a fight whose sheet or gear changed), nothing is left to practise for.
    if (Number.isInteger(ctx.reply?.index) && ctx.query(ROLLS_QUERY, { index: ctx.reply.index }) === null) ctx.fail('NO_LONGER_DONE', 'No roll is left on this reply to give practice for.');
    const domain = ctx.read('dataModules');
    const items = itemsOf(domain, uses);
    if (!items.length) ctx.fail('NO_LONGER_DONE', 'None of the skills the rolls used is on a sheet any more.');
    const predicate = { kind: PRACTICE_STEP };
    const witness = witnessOf(domain, ctx.source, uses);
    ctx.replayGuard({ owner: ctx.module, version: 2, epoch: ctx.epoch, rulesHash: null, predicate, inputHash: ctx.hash({ source: ctx.source, predicate, witness }) }, { uses, perUse });
    const skills = givePractice(ctx, domain, items, perUse);
    const held = skills.some(entry => entry.held);
    return {
        summary: `Practice: ${skills.map(entry => `${entry.who}'s ${entry.skill} +${entry.amount}`).join(', ') || 'none to give'}.`, narrate: false, replan: true,
        data: { v2: { result: { practice: { skills } } } },
        ...(held ? { problem: PRACTICE_HELD } : {}),
    };
}

/** The replay guard of `rpg.practice` (leanRpgGuard routes it here): the step stands while the sheet numbers it used are what the prefix holds. */
export function practiceGuard({ state, hash }, { guard, source, recorded }) {
    const bad = reason => ({ ok: false, reason });
    try {
        const predicate = guard?.predicate;
        if (guard?.version !== 2 || guard.rulesHash !== null || !isObject(predicate) || predicate.kind !== PRACTICE_STEP || !isObject(recorded)) return bad('Malformed practice guard.');
        const uses = usesFrom(recorded.uses);
        if (!uses || practiceOf(recorded.perUse) === null) return bad('The practice step\'s skills were damaged.');
        const witness = witnessOf(state.domains?.dataModules, source, uses);
        if (hash({ source, predicate, witness }) !== guard.inputHash) return bad('The sheet before this step changed; Re-read this reply.');
        return { ok: true };
    } catch { return bad('Damaged practice record.'); }
}
