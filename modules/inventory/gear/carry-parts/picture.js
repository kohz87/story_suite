// The whole carry picture from a state, and the carry query's answer.

import { isPlainObject } from '../../../scene/domains/common.js';
import { readSheet } from '../../../rpg/read.js';
import { kindCarry } from './mount-kinds.js';
import { travelsWith } from './mount-travel.js';
import { capacityFor } from './load.js';
import { weightFor } from '../stats-parts/weight.js';
import { partyCarriers, domainActors } from './members.js';

/**
 * The whole carry picture from a state, in `items.carry`'s shape:
 * { on, people: [{ id, name, load, capacity }] (the party's members with room of their own: members.js), bag, load, capacity, bonuses,
 * left: [{ id, name, load }] (who holds things but is no longer in the party: their things are in `load`, they add nothing to `capacity`) }.
 * `carryOf(def)` is the capacity a def adds (inventory.js: a pack item's `carry`).
 * The shared bag (owner `party`) has the capacities of the RPG characters who are not counted as a person added up (a story with none counts one reader of default
 * strength); each person owns theirs. `roster` (optional, { members, pc }: a roster a query answers, as Text RPG's) adds its members from the start; `nameOf(id)`
 * (optional) names a person the `party` domain does not hold; `legacy` counts as before the roster did (members.js). A unit weighs its def's weight (stats-parts/weight.js: its own, else by slot or kind; coins 0), and what a stack adds counts while it is worn (equipment) or held.
 */
export function carryPicture(state, { carryOf, mounts = [], nameOf = null, roster = null, legacy = false }) {
    const inventory = state?.domains?.inventory;
    const defs = isPlainObject(inventory?.defs) ? inventory.defs : {};
    const stacks = Object.values(isPlainObject(inventory?.stacks) ? inventory.stacks : {}).filter(stack => isPlainObject(stack) && isPlainObject(defs[stack.def]));
    const load = {}, bags = {}, bonuses = [];
    for (const stack of stacks) {
        const def = defs[stack.def];
        // The unit is "load": a stack weighs its def's weight × its count (coins 0): `load` and `weights` count the same.
        load[stack.owner] = (load[stack.owner] ?? 0) + weightFor(def) * stack.qty;
        const carry = carryOf(def);
        if (carry) {
            bonuses.push({ stack: stack.id, carry });
            if (def.kind !== 'equipment' || stack.equipped !== null) bags[stack.owner] = (bags[stack.owner] ?? 0) + carry;
        }
    }
    const holders = new Set(stacks.map(stack => stack.owner));
    const { shared: members, people: carriers, left } = partyCarriers({ sheet: readSheet(state).characters, actors: domainActors(state), holders, roster, nameOf, legacy });
    // Mounts and carts that travel with the party add their carry × count to the shared bag.
    const place = state?.domains?.scene?.place?.name ?? '';
    const animals = (Array.isArray(mounts) ? mounts : []).filter(row => row).map(row => ({
        name: row.name, carry: (Number.isSafeInteger(row.carry) && row.carry > 0 ? row.carry : kindCarry(row.kind)) * (Number.isSafeInteger(row.count) && row.count > 0 ? row.count : 1), withParty: travelsWith(row.where, place),
    }));
    const rides = animals.filter(animal => animal.withParty).map(({ name, carry }) => ({ name, carry }));
    const sources = {
        party: [...members.map(member => ({ name: member.name, carry: capacityFor(member.str) })),
            ...stacks.filter(stack => stack.owner === 'party' && carryOf(defs[stack.def]) && (defs[stack.def].kind !== 'equipment' || stack.equipped !== null)).map(stack => ({ name: defs[stack.def].name, carry: carryOf(defs[stack.def]) })),
            ...rides],
    };
    const sharedCapacity = sources.party.reduce((sum, entry) => sum + entry.carry, 0);
    const people = carriers.map(person => ({ id: person.id, name: person.name, load: load[person.id] ?? 0, capacity: capacityFor(person.str) + (bags[person.id] ?? 0) }));
    for (const person of carriers) {
        sources[person.id] = [{ name: person.name, carry: capacityFor(person.str) },
            ...stacks.filter(stack => stack.owner === person.id && carryOf(defs[stack.def]) && (defs[stack.def].kind !== 'equipment' || stack.equipped !== null)).map(stack => ({ name: defs[stack.def].name, carry: carryOf(defs[stack.def]) }))];
    }
    // Load weights (the unit is "load"): each stack's weight (the def's weight × the count, coins free, as `load` counts it); and the animals and carts, each with what it adds and whether it travels with the party.
    const weights = Object.fromEntries(stacks.map(stack => [stack.id, weightFor(defs[stack.def]) * stack.qty]));
    const total = Object.values(load).reduce((sum, n) => sum + n, 0);
    return {
        on: true, people, left: left.map(person => ({ ...person, load: load[person.id] ?? 0 })), bag: load.party ?? 0, load: total, capacity: sharedCapacity + people.reduce((sum, person) => sum + person.capacity, 0),
        shared: { load: load.party ?? 0, capacity: sharedCapacity, members: members.length }, sources, bonuses, unit: 'load', weights, animals: animals.filter(animal => typeof animal.name === 'string'),
    };
}

const weightOf = (add, defs) => (Array.isArray(add) ? add : []).reduce((sum, entry) => {
    const qty = Number.isSafeInteger(entry?.qty) && entry.qty > 0 ? entry.qty : 0;
    return sum + (entry?.defId && defs?.[entry.defId] ? weightFor(defs[entry.defId]) * qty : qty);
}, 0);

/** `items.carry`'s answer, from Story Block's own rules: the whole picture, or `{ ok, message }` when `args.add` asks whether things fit. */
export function carryAnswer(state, args, deps) {
    const picture = carryPicture(state, deps);
    const { shared, sources, left, ...answer } = picture;
    if (!Array.isArray(args?.add)) return answer;
    const weight = weightOf(args.add, state?.domains?.inventory?.defs);
    const owner = typeof args.owner === 'string' ? args.owner : 'party';
    const person = picture.people.find(entry => entry.id === owner);
    if (person) {
        return person.load + weight > person.capacity
            ? { ok: false, message: `${person.name} cannot carry that: ${person.load} of ${person.capacity} carried.` } : { ok: true };
    }
    // A hand-over inside the party keeps the whole load; the shared bag has the whole party's capacity.
    if (args.move === true) return { ok: true };
    return picture.load + weight > picture.capacity
        ? { ok: false, message: `The party cannot carry that: ${picture.load} of ${picture.capacity} carried.` } : { ok: true };
}
