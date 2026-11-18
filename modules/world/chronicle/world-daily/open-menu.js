// World events, open templates on the host: the menu the Director is shown for one slot, cut to what code would accept there (LA-3). A ladder
// with no rung in a direction, or a clear of a condition that does not hold at the slot, only buys a refused answer and a retry, so they are not offered. Pure.

import { conditionHolds } from '../../daily/holds-read.js';

const DAY = 1440;

/**
 * `shownMenu(ws, menu, slot)` → the menu with the ladder narrowed to the directions that have a rung from where the front stands (the key dropped when
 * none has) and the clear list cut to the conditions that hold at the slot (the key dropped when none does). The answer is still checked against the whole menu.
 */
export function shownMenu(ws, menu, slot) {
    const holds = (name, scope) => Boolean(slot[scope]) && conditionHolds(ws, name, slot[scope], ws.day * DAY);
    const out = { ...menu };
    if (menu.clear) {
        const of = menu.clear.of.filter(name => ws.declared.has(name) && holds(name, ws.declared.get(name).scope));
        if (of.length) out.clear = { ...menu.clear, of };
        else delete out.clear;
    }
    if (menu.ladder) {
        const scopes = new Set(menu.ladder.of.map(name => ws.declared.get(name)?.scope));
        const scope = scopes.size === 1 ? [...scopes][0] : null;
        if (scope) {
            const held = menu.ladder.of.findLastIndex(name => holds(name, scope));
            const ways = ['up', 'down'].filter(way => (menu.ladder.direction === 'either' || menu.ladder.direction === way) && (way === 'up' ? held + 1 < menu.ladder.of.length : held >= 1));
            if (ways.length) out.ladder = { ...menu.ladder, direction: ways.length === 2 ? 'either' : ways[0] };
            else delete out.ladder;
        }
    }
    return out;
}
