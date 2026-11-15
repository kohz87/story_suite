// The money guard's warning for a coin or item line's receipt, or none.

import { gainedBy, paidBy } from './payments.js';

/** "Far above the purse": more than this many times the purse before the line, and more than FAR_MIN units. */
export const FAR_TIMES = 5;
export const FAR_MIN = 10;

/**
 * The warning for a coin or item line's receipt, or null. `before`: receipts it can be compared with (earlier replies' and this reply's
 * lines so far). `previous`: the receipts of the one reply right before this one: the same item (same words, quantity and source)
 * gained again there is a "possible repeat" (the narrator may mean it, so it is only told).
 */
export function moneyWarning(receipt, before, previous = []) {
    const gained = gainedBy(receipt);
    if (gained) return previous.some(other => { const had = gainedBy(other); return had && had.def === gained.def && had.qty === gained.qty && had.from === gained.from && had.text === gained.text; })
        ? `Possible repeat: ${gained.text.replace(/^The party gains /u, '').replace(/\.$/u, '')} was also gained in the reply before. It was applied; undo it if the story gave it only once.` : null;
    const now = paidBy(receipt);
    if (!now) return null;
    const repeated = now.source && before.some(other => { const paid = paidBy(other); return paid && paid.source === now.source && paid.amount === now.amount; });
    if (repeated) return `Possible repeat: ${now.amount} from "${now.source}" was paid in a reply a moment ago and is paid again here. It was applied; undo it if the story paid the same find twice.`;
    const purse = now.now - now.amount;
    // An empty purse is no baseline (a chat's first money is not "far above" anything): only a purse with something in it is compared.
    if (purse > 0 && now.amount > FAR_MIN && now.amount > FAR_TIMES * purse) return `${now.amount} is more than ${FAR_TIMES} times the purse (${purse}). It was applied; undo it if the story paid too much.`;
    return null;
}
