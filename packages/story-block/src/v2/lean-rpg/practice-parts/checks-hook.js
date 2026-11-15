// The part's afterCapture for story checks: asks for the guarded `rpg.check` step from the reply's roll lines.
import { CHECK_STEP, DICE, LEAN_RPG_FEATURE, PRACTICE, RESOLVE } from '../names.js';
import { diceOf, tableOf } from '../checks/dice.js';
import { isObject } from './shared-values.js';
import { PAID_TYPES, CHECK_LINES } from './shared-limits.js';
import { rollOf, usesOf } from './uses.js';

/**
 * The part's afterCapture for story checks: the reply's `? roll` lines (their `capture.roll` receipts) with the dice recorded with it (the `rpg.dice` receipt: the dice,
 * the rules and the practice per use it was offered under; today's settings are never read). → { commands } (the `rpg.check` step) or undefined (no roll line,
 * or the RPG is off). A reply's Story checks switch is not asked: the reply's own rule mark decided its lines (factory.js).
 */
export function checksHook(view, info) {
    if (!PAID_TYPES.includes(info?.type ?? 'normal') || view?.feature?.(LEAN_RPG_FEATURE) !== true) return undefined;
    const receipts = Array.isArray(info?.receipts) ? info.receipts : [];
    const lines = receipts.filter(receipt => receipt?.type === 'capture.roll' && typeof receipt.data?.check?.raw === 'string').map(receipt => receipt.data.check.raw).slice(0, CHECK_LINES);
    if (!lines.length) return undefined;
    const kept = receipts.findLast(receipt => receipt?.type === DICE)?.data?.v2?.dice;
    const dice = diceOf(kept);
    // The note's table is the contract: the step works each check at the bonuses the table showed (recorded in `table`). A Re-read keeps what the reply was worked with:
    // a reply whose earlier check step has no `table` stays on the sheet's bonuses, as it was.
    const old = info?.type === 'reread' ? (info.previous ?? []).filter(receipt => receipt?.type === CHECK_STEP).map(receipt => receipt.replan?.payload).find(isObject) : undefined;
    const table = dice && Array.isArray(kept?.table) && (!old || Array.isArray(old.table)) ? tableOf(kept.table) : null;
    // A fight and separate story checks can share a reply. Both use the same per-skill cap; old check steps retain their original inputs.
    const board = receipts.findLast(receipt => receipt?.type === RESOLVE && receipt.replan?.payload?.board);
    const fight = board && rollOf([board]);
    const spent = fight && (!old || Array.isArray(old.spent)) ? usesOf(fight).map(use => ({ who: use.who, skill: use.skill, amount: Math.min(PRACTICE.max, use.n * fight.practice) })) : [];
    return { commands: [{ type: CHECK_STEP, payload: { lines, dice, practice: true, ...(table ? { table } : {}), ...(spent.length ? { spent } : {}) } }] };
}
