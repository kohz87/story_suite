// The whole carry picture from a state, and the carry query's answer.

import { isPlainObject } from '../../common.js';
import { readSheet } from '../../../../../../../modules/rpg/read.js';
import { kindCarry } from './mount-kinds.js';
import { travelsWith } from './mount-travel.js';
import { capacityFor } from './load.js';

function actorStr(actor) {
    for (const value of [actor?.str, actor?.STR, actor?.stats?.str, actor?.stats?.STR]) if (Number.isSafeInteger(value)) return value;
    return null;
}

/**
 * The whole carry picture from a state, in `items.carry`'s shape:
 * { on, people: [{ id, name, load, capacity }] (the party's own members who hold things of their own), bag, load, capacity, bonuses }.
 * `carryOf(def)` is the capacity a def adds (inventory.js: a pack item's `carry`).
 * The shared bag (owner `party`) has the RPG characters' capacities added up (a story with none counts one reader of default
 * strength); each person owns theirs. A thing weighs 1 per unit, and what a stack adds counts while it is worn (equipment) or held.
 */
export function carryPicture(state, { carryOf, mounts = [] }) {
    const inventory = state?.domains?.inventory;
    const defs = isPlainObject(inventory?.defs) ? inventory.defs : {};
    const stacks = Object.values(isPlainObject(inventory?.stacks) ? inventory.stacks : {}).filter(stack => isPlainObject(stack) && isPlainObject(defs[stack.def]));
    const actors = isPlainObject(state?.domains?.party?.actors) ? state.domains.party.actors : {};
    const load = {}, bags = {}, bonuses = [];
    for (const stack of stacks) {
        const def = defs[stack.def];
        // Coins weigh nothing (the unit is "load": a thing is 1 per unit, money 0): `load` and `weights` count the same.
        load[stack.owner] = (load[stack.owner] ?? 0) + (def.kind === 'money' ? 0 : stack.qty);
        const carry = carryOf(def);
        if (carry) {
            bonuses.push({ stack: stack.id, carry });
            if (def.kind !== 'equipment' || stack.equipped !== null) bags[stack.owner] = (bags[stack.owner] ?? 0) + carry;
        }
    }
    const sheet = readSheet(state).characters;
    const members = sheet.length ? sheet.map(person => ({ name: person.who, str: person.stats?.str })) : [{ name: 'The reader', str: null }];
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
    const ids = [...new Set([...Object.keys(actors), ...Object.keys(load)])].filter(id => id !== 'party').sort();
    const people = ids.map(id => ({
        id, name: typeof actors[id]?.name === 'string' && actors[id].name.trim() ? actors[id].name.trim() : id,
        load: load[id] ?? 0, capacity: capacityFor(actorStr(actors[id])) + (bags[id] ?? 0),
    }));
    for (const person of people) {
        sources[person.id] = [{ name: person.name, carry: capacityFor(actorStr(actors[person.id])) },
            ...stacks.filter(stack => stack.owner === person.id && carryOf(defs[stack.def]) && (defs[stack.def].kind !== 'equipment' || stack.equipped !== null)).map(stack => ({ name: defs[stack.def].name, carry: carryOf(defs[stack.def]) }))];
    }
    // Load weights (the unit is "load"): each stack's weight (1 per unit, coins free, as `load` counts it); and the animals and carts, each with what it adds and whether it travels with the party.
    const weights = Object.fromEntries(stacks.map(stack => [stack.id, defs[stack.def].kind === 'money' ? 0 : stack.qty]));
    const total = Object.values(load).reduce((sum, n) => sum + n, 0);
    return {
        on: true, people, bag: load.party ?? 0, load: total, capacity: sharedCapacity + people.reduce((sum, person) => sum + person.capacity, 0),
        shared: { load: load.party ?? 0, capacity: sharedCapacity }, sources, bonuses, unit: 'load', weights, animals: animals.filter(animal => typeof animal.name === 'string'),
    };
}

const weightOf = (add, defs) => (Array.isArray(add) ? add : []).reduce((sum, entry) => {
    const qty = Number.isSafeInteger(entry?.qty) && entry.qty > 0 ? entry.qty : 0;
    return sum + (entry?.defId && defs?.[entry.defId]?.kind === 'money' ? 0 : qty);
}, 0);

/** `items.carry`'s answer, from Story Block's own rules: the whole picture, or `{ ok, message }` when `args.add` asks whether things fit. */
export function carryAnswer(state, args, deps) {
    const picture = carryPicture(state, deps);
    const { shared, sources, ...answer } = picture;
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
