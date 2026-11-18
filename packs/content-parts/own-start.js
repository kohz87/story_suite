// The job: the reader's own starting money and items laid over a merged start (they come before the game pack's; pack-format-4 D6).

import { startOf4 } from './start-v4.js';

/**
 * `start`: mergeStart's answer; `own`: `{ money: integer | null, items: [{ name, qty }] }` (packs/own.js); `worldItems`: the selected world's items.
 * Returns `start` itself when the reader set nothing. Otherwise a copy where the reader's money replaces the packs' and the reader's list replaces their items
 * (names match the world's items, else a plain story item), and `packs` lists "settings" when nothing else gave a start.
 */
export function withOwnStart(start, own, worldItems = []) {
    const money = Number.isInteger(own?.money) ? own.money : null;
    const items = Array.isArray(own?.items) ? own.items : [];
    if (money === null && !items.length) return start;
    const made = startOf4({ kind: 'game', start: { money: money ?? 0, items: items.map(item => ({ name: item.name, qty: item.qty })) } }, worldItems);
    const out = { ...start, inventory: { items: items.length ? made.inventory.items : start.inventory.items, money: money ?? start.inventory.money }, packs: [...start.packs] };
    if (!out.packs.includes('settings')) out.packs.push('settings');
    return out;
}
