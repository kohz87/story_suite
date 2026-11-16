// Builds the cue a receipt tells from its record, and puts it on receipts.

import { DICE, RESOLVE } from '../names.js';
import { offerLine } from './offer.js';
import { cueText } from './text.js';

/**
 * The cue text of a recorded roll (`data.v2.result` of an `rpg.resolve` receipt), built again from what the record holds: the lines, the refusals,
 * the standard parts, the shape it was fitted to (`shape`, kept beside the record in `data.v2.shape`, absent = 0) and how it stopped. `rpg.resolve` stores no copy of it (stage 51), and keeps the text
 * only if this would not give the same bytes. → text, or '' for a record that is not a roll.
 */
export function cueOfResult(result, shape = 0) {
    if (!result || typeof result !== 'object' || !Array.isArray(result.rounds) || !Array.isArray(result.checks)) return '';
    try {
        const rounds = result.rounds, flow2 = result.flow === 2;
        const std = Array.isArray(result.order) ? {
            order: result.order, opening: result.opening ?? [], quick: result.quickStart ?? [],
            // the bars the told lines moved: only a bar's field is read, and its id says which
            start: { get: id => hurts.get(id) ?? { field: /:(stamina|mana)$/.exec(id)?.[1] ?? 'health' } },
        } : null;
        const hurts = new Map((result.hurts ?? []).map(item => [item.id, item]));
        const decisive = !flow2 && (result.stop === 'decisive' || result.stop === 'over');
        const end = flow2 && ['won', 'lost', 'heavy'].includes(result.stop) ? result.stop : null;
        return cueText({
            checks: result.checks, rounds, refused: (result.refused ?? []).map(entry => entry.text), decisive,
            ...(std ? { standard: std } : {}), ...(flow2 ? { flow: 2, end } : {}), ...(result.noXp === true ? { noXp: true } : {}), ...(result.wear ? { wear: result.wear } : {}), ...(result.fix >= 2 ? { opened: result.opened, carriedDrop: result.ambush?.spent === true } : { legacy: true }),
        }, Number.isInteger(shape) ? shape : 0);
    } catch { return ''; }
}

/** A receipt with its cue as `summary` (an `rpg.resolve` receipt stores none from stage 51 on): readers get the same text the prompt does. */
export const receiptWithCue = receipt => (receipt?.type === RESOLVE && !receipt.summary ? { ...receipt, summary: receiptCue(receipt) } : receipt);
/** The same over the store's `{ index, receipt }` entries. */
export const entriesWithCue = list => (Array.isArray(list) ? list.map(entry => (entry?.receipt ? { ...entry, receipt: receiptWithCue(entry.receipt) } : entry)) : list);

/** The cue a receipt tells: its own `summary`, else (an `rpg.resolve` receipt of stage 51 on) the one its record gives back. */
export function receiptCue(receipt) {
    if (typeof receipt?.summary === 'string' && receipt.summary) return receipt.summary;
    if (receipt?.type === DICE) return offerLine(receipt.data?.v2?.dice);
    return receipt?.type === RESOLVE ? cueOfResult(receipt.data?.v2?.result, receipt.data?.v2?.shape) : (receipt?.summary ?? '');
}
