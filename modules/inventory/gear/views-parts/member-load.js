// Words each member's own part of the party's load for `gear.view`: the chips for what they add, and their own load line.

import { STRINGS } from '../../../../core/strings.js';
import { loadLevel } from '../carry.js';

const S = STRINGS.inventory.gear;

/**
 * From the carry picture and the inventory's stacks:
 * `parts` ({ label, value, text, dim }): for each person of `picture.people` what they carry themself, then what each bag of theirs adds, so that with the shared bag's
 * own chips they add up to the party's capacity;
 * `people` ({ id, name, load, capacity, level }): those who hold something that weighs, or a bag; then everyone who left and still holds something
 * ({ id, name, load, level, left: true, unnamed? }: no capacity, as they add no room; `unnamed` when no name is known).
 */
export function memberLoads(picture, stacks) {
    const parts = [], people = [];
    for (const person of picture.people) {
        const [own, ...bags] = picture.sources[person.id];
        parts.push({ label: person.name, value: own.carry, text: `${person.name} ${S.carries} ${own.carry}`, dim: false });
        for (const bag of bags) parts.push({ label: `${person.name}'s ${bag.name}`, value: bag.carry, text: `${person.name}'s ${bag.name} +${bag.carry}`, dim: false });
        if (person.load > 0 || bags.length || stacks.some(stack => stack.owner === person.id && stack.equipped === 'bag')) {
            people.push({ id: person.id, name: person.name, load: person.load, capacity: person.capacity, level: loadLevel(person.load, person.capacity) });
        }
    }
    for (const person of picture.left) {
        people.push({ id: person.id, name: person.name, load: person.load, level: 'normal', left: true, ...(person.name === S.someoneLeft ? { unnamed: true } : {}) });
    }
    return { parts, people };
}
