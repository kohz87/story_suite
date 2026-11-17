// The story's state lines (Place, Present, Equipped, Wallet, Carried) as the narrator's tail gives them, for the repair of a reply that came with no block.

import { tailOrder } from '../prompt-parts/tail-order.js';

const DOMAINS = Object.freeze(['scene', 'inventory']);
// Only the lines that state facts (the scene's other tail lines are instructions to the narrator, not state).
const FACT = /^(Place|Present|Equipped|Wallet|Carried|Also carried)\b/;

/** The tail lines of the modules that own the scene or the inventory, in tail order; a module whose tail throws gives none. `viewOf()` → the view the tails read. */
export function stateLinesOf(registry, viewOf) {
    const view = viewOf();
    const out = [];
    for (const context of tailOrder(registry.contexts())) {
        if (typeof context.tail !== 'function' || !context.domains.some(domain => DOMAINS.includes(domain))) continue;
        let tail = null;
        try { tail = context.tail(view); } catch { tail = null; }
        for (const line of Array.isArray(tail?.lines) ? tail.lines : []) {
            const text = typeof line === 'string' ? line : line?.text;
            if (typeof text === 'string' && FACT.test(text.trim())) out.push(text.trim());
        }
    }
    return out;
}
