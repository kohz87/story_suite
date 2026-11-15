// The Skills block's slot rules (moved out of data-modules/part.js unchanged): skill rows, learn
// and practice routing, the level's open slots, and the additive upgrade of an older block.
// Public face: re-exports its parts.
export { createSkills } from './skills-parts/factory.js';
export { skillCapacity, skillRow } from './skills-parts/rows.js';
export { skillNamed, words } from './skills-parts/naming.js';
export { skillRoute } from './skills-parts/route.js';
export { skillRoom, skillWant } from './skills-parts/room.js';
export { growSkills } from './skills-parts/grow.js';
