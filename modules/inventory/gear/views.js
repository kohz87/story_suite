// Gear's query answers and screen picture (moved out of domains/gear.js unchanged; gear.js re-exports every public
// name): what a wearer has on, the stats it gives, the carry card and the four gear queries, using supplied readers.
// Public face: re-exports its parts.

export { statBonus, gearAnswer } from './views-parts/answers.js';
export { bonusText } from './views-parts/bonus-text.js';
export { gearView } from './views-parts/view.js';
export { createGearQueries } from './views-parts/queries.js';
