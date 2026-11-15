// Simulation of the Standard stat formula (no network, no SillyTavern): how often a roll succeeds, succeeds at a cost, fails and is
// decisive, for a focused and a spread build at Soul Class I, III, V, VII and IX against foes of the same class and one class either side, at
// each difficulty (Gentle, Standard, Harsh); and how many exchanges a fight between a hero and a foe of the same class lasts.
//
//   node scripts/sim-standard.mjs            the tables, as markdown
//   node scripts/sim-standard.mjs --json     the same numbers as JSON
//
// The single-roll odds are exact (all 400 pairs of dice through the engine's own `judge`); the fights run the real roll engine
// (src/v2/lean-rpg/standard.js) over a synthetic sheet with a seeded generator, so the same numbers come out every time.
// Public face: re-exports its parts.

export { rankAt, buildAt } from './sim-standard-parts/builds.js';
export { exactOdds, rollTable } from './sim-standard-parts/rolls.js';
export { fight, fightTable } from './sim-standard-parts/fights.js';
export { runCli } from './sim-standard-parts/cli.js';
