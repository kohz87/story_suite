// The story's state lines (Place, Present, Equipped, Wallet, Carried, the open hooks and quests) as the narrator's tail gives them, for the repair of a reply that came with no block.

import { tailOrder } from '../prompt-parts/tail-order.js';
import { openThreadLines } from './open-threads.js';

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
    // The open hooks and quests by name, so the repair never adds a lead the story already holds under other words; before Carried (the longest line, the one a limit cuts).
    const carried = out.findIndex(line => /^(Carried|Also carried)\b/.test(line));
    out.splice(carried < 0 ? out.length : carried, 0, ...openThreadLines(view));
    // The Wallet line names the chat's coins, so a repair writes `- coin 8 copper`, not a bare number (which would read as the base coin).
    const names = coinNames(view);
    return names ? out.map(line => (/^Wallet\b/.test(line) ? `${line} (coins: ${names})` : line)) : out;
}

function coinNames(view) {
    let currency = null;
    try { currency = view.query('inventory.currency'); } catch { currency = null; }
    const coins = Array.isArray(currency?.coins) ? currency.coins : [];
    const names = [...new Set((coins.length ? coins : [currency]).map(coin => String(coin?.name || coin?.plural || '').trim()).filter(Boolean))];
    return names.join(', ');
}
