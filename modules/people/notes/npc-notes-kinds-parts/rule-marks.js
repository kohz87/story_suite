// The rule marks of a note line and the matching mark on its result.
import { tasteRuleFor, markTasteResult } from '../npc-notes-tastes.js';
import { knowRuleFor, markKnowResult } from '../npc-notes-knows.js';

/** The rule marks of a note line: `rule` (taste or know, 0 when strict) and the matching mark for the result. */
export function noteRule(kind, ctx, key, reply, labels) {
    return kind === 'taste' ? tasteRuleFor(ctx.standing, key, reply, labels.likes ?? labels.dislikes, ctx.standingReceipts)
        : kind === 'know' ? knowRuleFor(ctx.standing, key, reply, labels, ctx.standingReceipts) : 0;
}
export function markNote(kind, result, labels, rule) {
    return kind === 'taste' ? markTasteResult(result, labels.likes ?? labels.dislikes, rule) : kind === 'know' ? markKnowResult(result, labels, rule) : result;
}
