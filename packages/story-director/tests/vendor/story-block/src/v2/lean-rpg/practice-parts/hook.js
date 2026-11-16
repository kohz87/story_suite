// The part's afterCapture for practice: asks for guarded `rpg.practice` steps for the skills the roll used.
import { LEAN_RPG_FEATURE, PRACTICE_STEP } from '../names.js';
import { PAID_TYPES, USES_PER_STEP } from './shared-limits.js';
import { rollOf, usesOf } from './uses.js';

/**
 * The part's afterCapture: the step for the skills this reply's rolls used, else nothing. `info.receipts`: the reply's own receipts (turn.js passes them,
 * live or in a Re-read).
 */
export function practiceHook(view, info) {
    if (!PAID_TYPES.includes(info?.type ?? 'normal') || view?.feature?.(LEAN_RPG_FEATURE) !== true) return undefined;
    const roll = rollOf(info?.receipts);
    const uses = roll ? usesOf(roll) : [];
    if (!uses.length) return undefined;
    const commands = [];
    for (let at = 0; at < uses.length; at += USES_PER_STEP) {
        // Counts above 99 already reach the per-skill cap even at one practice per use.
        const batch = uses.slice(at, at + USES_PER_STEP).map(use => ({ ...use, n: Math.min(use.n, 99) }));
        commands.push({ type: PRACTICE_STEP, payload: { uses: batch, perUse: roll.practice } });
    }
    return { commands };
}
