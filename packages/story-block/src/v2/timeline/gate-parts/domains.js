// The names of the host's two domains and the genesis epoch with the epoch of a state.

import { GENESIS_EPOCH, epochOf } from '../../replay.js';

export const HOST_DOMAIN = 'savepoints';
export const RULES_DOMAIN = 'rules';
// (the genesis epoch and the epoch of a state are replay.js's: ctx.epoch reads the same function)
export { GENESIS_EPOCH, epochOf };
