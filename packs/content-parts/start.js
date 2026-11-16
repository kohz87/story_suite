// The enabled packs' start: merged into one, and written into an initial State.

import { foldKey } from '../../core/text.js';
import { copy } from './shared-copy.js';
import { itemDef } from './items.js';

/**
 * The enabled packs' `start` merged into one (SPEC §2.6):
 * `{ scene: { place, present }, inventory: { items: [{ def, aliases, qty, note }], money }, currency, packs, problems }`.
 *
 * * `place`: the first pack (in list order) that names one; places are not mixed field by field.
 * * `present`: every name once, in pack order.
 * * `items`: in pack order; the same def with the same note is one line with the quantities added.
 *   A start item from another pack that is not enabled is left out and listed in `problems`.
 * * `money`: added up, a whole number of the chat's one currency.
 * * `currency`: the first enabled pack's suggested `{ name, short }`, or null. The host uses it only
 *   when the reader has not named the currency.
 * * `packs`: the ids of the packs that gave something.
 */
export function mergeStart(packs) {
    const out = { scene: { place: null, present: [] }, inventory: { items: [], money: 0 }, currency: null, packs: [], problems: [] };
    const items = new Map();
    for (const item of packs.flatMap(pack => pack.content.items)) if (!items.has(item.id)) items.set(item.id, item);
    const present = new Set();
    for (const pack of packs) {
        if (pack.currency && !out.currency) out.currency = copy(pack.currency);
        const start = pack.start;
        if (!start) continue;
        let gave = false;
        if (start.scene.place && !out.scene.place) {
            out.scene.place = copy(start.scene.place);
            gave = true;
        }
        for (const name of start.scene.present) {
            gave = true;
            if (present.has(foldKey(name))) continue;
            present.add(foldKey(name));
            out.scene.present.push(name);
        }
        for (const line of start.inventory.items) {
            const item = items.get(line.item);
            if (!item) {
                out.problems.push(`${pack.name} starts with ${line.item}, but the pack that defines it is not enabled.`);
                continue;
            }
            gave = true;
            const same = out.inventory.items.find(entry => entry.def.id === item.id && entry.note === line.note);
            if (same) same.qty += line.qty;
            else out.inventory.items.push({ def: itemDef(item), aliases: [...item.aliases], qty: line.qty, note: line.note });
        }
        if (start.inventory.money) {
            gave = true;
            out.inventory.money += start.inventory.money;
        }
        if (gave) out.packs.push(pack.id);
    }
    return out;
}

/**
 * Writes a merged start into an initial State (SPEC §2.6, shapes of SPEC §7) and returns the
 * new State; `state` is not changed. Only the `scene` and `inventory` slices that exist are
 * touched. `id(prefix)` makes record IDs (the host passes `sdk.id`); `coin` is the wallet key,
 * `coin` by default (MODULES §F1: `wallets[owner] = { coin: n }`).
 *
 * * The start place is used only when the scene has no place yet; present names are added once.
 * * Each start item adds its def (if inventory has none with that ID), its name and aliases to
 *   `aliases` (where free), and a party stack; an item that does not stack gets one stack each.
 * * Money is added to the party's wallet under `coin`.
 */
export function applyStart(state, start, { id, coin = 'coin' } = {}) {
    if (typeof id !== 'function') throw new Error('applyStart needs an id(prefix) function.');
    const next = copy(state);
    const scene = next.domains?.scene;
    if (scene && start.scene) {
        if (start.scene.place && !scene.place?.name) scene.place = copy(start.scene.place);
        if (Array.isArray(scene.present)) {
            const here = new Set(scene.present.map(foldKey));
            for (const name of start.scene.present) if (!here.has(foldKey(name))) { here.add(foldKey(name)); scene.present.push(name); }
        }
    }
    const inventory = next.domains?.inventory;
    if (inventory && start.inventory) {
        inventory.defs ??= {};
        inventory.stacks ??= {};
        inventory.wallets ??= {};
        inventory.aliases ??= {};
        for (const line of start.inventory.items) {
            const def = line.def;
            inventory.defs[def.id] ??= copy(def);
            for (const name of [def.name, ...(line.aliases ?? [])]) inventory.aliases[foldKey(name)] ??= def.id;
            const stacks = def.stack ? [line.qty] : Array.from({ length: line.qty }, () => 1);
            for (const qty of stacks) {
                const stackId = id('it');
                inventory.stacks[stackId] = { id: stackId, def: def.id, qty, owner: 'party', equipped: null, note: line.note ?? '', from: '' };
            }
        }
        if (start.inventory.money) {
            const wallet = inventory.wallets.party ??= {};
            wallet[coin] = (wallet[coin] ?? 0) + start.inventory.money;
        }
    }
    return next;
}
