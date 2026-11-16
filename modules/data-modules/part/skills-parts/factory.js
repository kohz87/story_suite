// The Skills part's function table (what part.js builds its factory from).
import { skillCapacity, skillRow } from './rows.js';
import { words, skillNamed } from './naming.js';
import { skillRoute } from './route.js';
import { skillRoom, skillWant } from './room.js';
import { growSkills } from './grow.js';

function createSkills() {
    return { skillCapacity, skillRow, skillNamed, words, skillRoute, skillRoom, skillWant, growSkills };
}

export { createSkills };
