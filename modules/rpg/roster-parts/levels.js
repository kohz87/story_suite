// Lists the party's members with their sheet levels (the `party.levels` query).
import { readSheet } from '../read.js';
import { actorIdOf } from './actor-id.js';

/** Members with sheet levels, left ones too, in block order; [] with no Character. */
export function levelsOf(state) {
    return readSheet(state, { withLeft: true }).characters.map(found => ({ id: actorIdOf(found.module), name: found.who, level: found.sheetLevel ?? null, left: found.left === true }));
}

/** The `party.levels` query (the RPG's feature gates it where registered). */
export const levelsQuery = state => levelsOf(state);
