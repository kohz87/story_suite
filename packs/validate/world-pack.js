// Story Suite v2: the pack validator's checks for the world pack (spec v0.13): realms, kind maps, powers and scores, world events and
// templates, lore with its gates, and the companion / figure cast. The install check is structural: it does not depend on the world-events switch.
// Public face: re-exports its parts.

export { checkWorldPack, WORLD_KINDS } from './world-pack-parts/run.js';
export { checkWorldCast } from './world-pack-parts/cast-world.js';
