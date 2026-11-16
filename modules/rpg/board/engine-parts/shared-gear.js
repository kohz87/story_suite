// The id order and the live gear query shared by the board's gear helpers.
import { gearAnswer } from '../../../inventory/gear.js';
import { condOf, defCarry, ENCUMBERED_PENALTY } from '../../../inventory/index.js';
import { mountRows } from '../../../scene/mounts.js';

export const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export const gearQuery = state => (_name, args) => gearAnswer(state, args, { condOf, carryOf: defCarry, penalty: ENCUMBERED_PENALTY, mounts: mountRows(state) });
