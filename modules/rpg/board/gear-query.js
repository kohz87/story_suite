// The live gear query the fight kind and the bag's helpers share: `inventory.gear` answered from a state.
import { gearAnswer } from '../../inventory/gear.js';
import { condOf, defCarry, ENCUMBERED_PENALTY } from '../../inventory/index.js';
import { mountRows } from '../../scene/mounts.js';

export const gearQuery = state => (_name, args) => gearAnswer(state, args, { condOf, carryOf: defCarry, penalty: ENCUMBERED_PENALTY, mounts: mountRows(state) });
