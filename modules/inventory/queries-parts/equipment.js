// What the Inventory screen's Equipped section and pickers need.

import { isPlainObject } from '../../scene/domains/common.js';
import { membersOf, pcOf, slotLimits, canWear, asking } from '../validate.js';
import { listItems } from './list.js';
import { asker } from './shared-ask.js';

/**
 * What the Inventory screen's Equipped section and pickers need (MODULES §F99), from the state:
 * { members: [{ id, name }], worn: [{ id, name, items: [item] }] (each wearer's pieces, by slot key),
 *   wearers: { [stack]: [{ id, name }] } (who may put on each piece of equipment, not its wearer),
 *   givers: { [stack]: [{ id, name }] } (where Give may hand each stack: the party's bag and members,
 *   not its owner), users: { [stack]: [{ id, name }] } (whom Use on… offers for a consumable: usersOf),
 *   limits: { accessory, worn } }.
 */
export function equipmentView(state, tools) {
    const query = asker(tools);
    const inventory = state?.domains?.inventory;
    const party = state?.domains?.party ?? null;
    const members = membersOf(query, party);
    const pc = pcOf(query, party);
    const limits = slotLimits(query);
    const items = listItems(inventory);
    const names = new Map(members.map(member => [member.id, member.name]));
    const wearer = item => (item.owner === 'party' ? pc ?? 'party' : item.owner);
    const worn = [];
    for (const id of [...members.map(member => member.id), 'party']) {
        const pieces = items.filter(item => item.equipped !== null && wearer(item) === id)
            .sort((a, b) => (a.equipped < b.equipped ? -1 : a.equipped > b.equipped ? 1 : 0));
        if (pieces.length) worn.push({ id, name: names.get(id) ?? 'The party', items: pieces.map(item => ({ ...item, cond: item.cond ?? null })) });
    }
    const wearers = {};
    const givers = {};
    const bag = { id: 'party', name: 'the party\'s bag' };
    for (const item of items) {
        const def = inventory.defs[item.def];
        if (def.kind === 'equipment') {
            wearers[item.stack] = members.filter(member => !(item.equipped !== null && wearer(item) === member.id)
                && canWear(query, def, member.id, limits, member.name).ok);
        }
        givers[item.stack] = [bag, ...members].filter(target => target.id !== item.owner);
    }
    return { members, worn, wearers, givers, users: usersOf(query, inventory, items, members), limits };
}

/**
 * Who a Use on… picker offers for each consumable (bag management, beta.1 live test): the module that
 * answers `items.useOn`; Use runs `item.use { stack, target }`. Only consumables the party holds, only members;
 * {} without such a module, so the picker is not drawn.
 */
function usersOf(query, inventory, items, members) {
    const given = asking(query, 'items.useOn', {});
    if (!isPlainObject(given)) return {};
    const names = new Map(members.map(member => [member.id, member.name]));
    const out = {};
    for (const item of items) {
        if (inventory.defs[item.def]?.kind !== 'consumable' || !Object.hasOwn(given, item.stack) || !Array.isArray(given[item.stack])) continue;
        const ids = [...new Set(given[item.stack].map(entry => (isPlainObject(entry) ? entry.id : entry)).filter(id => names.has(id)))];
        // (`via`: the command a member's button runs when the answer names one, as the RPG's own does; else `item.use`)
        const via = id => { const entry = given[item.stack].find(one => isPlainObject(one) && one.id === id); return typeof entry?.via === 'string' && /^[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+$/.test(entry.via) ? { via: entry.via } : {}; };
        if (ids.length) out[item.stack] = ids.map(id => ({ id, name: names.get(id), ...via(id) }));
    }
    return out;
}
