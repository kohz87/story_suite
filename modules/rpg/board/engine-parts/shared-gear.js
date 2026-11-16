// The id order and the live gear query shared by the board's gear helpers.
import { gearAnswer } from '../../../../packages/story-block/src/v2/domains/gear.js';
import { condOf, defCarry, ENCUMBERED_PENALTY } from '../../../../packages/story-block/src/v2/domains/inventory.js';
import { mountRows } from '../../../../packages/story-block/src/v2/domains/mounts.js';

export const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export const gearQuery = state => (_name, args) => gearAnswer(state, args, { condOf, carryOf: defCarry, penalty: ENCUMBERED_PENALTY, mounts: mountRows(state) });
