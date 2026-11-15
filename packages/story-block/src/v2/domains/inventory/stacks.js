// The inventory domain's stack and definition handling (moved out of domains/inventory.js unchanged; inventory.js re-exports every public
// name): finding and taking stacks, the bound-gear guards, the definition builders and the money receive/pay handlers.
// Public face: re-exports its parts.

export { E, told, currencyIn } from './stacks-parts/common-ctx.js';
export { stackIn, shortOf, stacksOf } from './stacks-parts/find.js';
export { boundId, boundName, refuseBound, unbound } from './stacks-parts/bound.js';
export { count, ownerArg, receiverArg, textArg } from './stacks-parts/args.js';
export { take, takeAcross } from './stacks-parts/taking.js';
export { addStack, looseMatch, grantInto } from './stacks-parts/granting.js';
export { ambiguous, knownDef, freeId } from './stacks-parts/lookup.js';
export { storeDef } from './stacks-parts/def-build.js';
export { defineByName, defineGiven } from './stacks-parts/def-create.js';
export { peekPackDef } from './stacks-parts/def-pack.js';
export { receive, pay } from './stacks-parts/wallet-moves.js';
export { ECONOMY_SCALE, economyOf, scaledDefault } from './stacks-parts/economy.js';
