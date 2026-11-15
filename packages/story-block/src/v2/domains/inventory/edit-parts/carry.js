// The reader-only rule for edits, and setting what an item adds to carry capacity.

import { fill } from '../../../strings.js';
import { READER_CARRY_MAX } from '../state.js';
import { E } from '../stacks.js';

// A reader edit is never a story line or a nested module call.
export function byReader(ctx) {
    if (ctx.cause !== 'ui' || ctx.caller !== null) ctx.fail('REFUSED', E.onlyReader);
}

/**
 * `inventory.carry { stack, carry }`: the reader sets what an item adds to carry capacity, 0 to 500 (0 removes it). It lands on the item's
 * definition, so every piece of it counts. Only the reader can: a story line never reaches this command (byReader), and a pack item keeps its own.
 */
export function setCarry(ctx, inv, payload) {
    byReader(ctx);
    const stack = inv.stacks[payload.stack];
    const def = stack && inv.defs[stack.def];
    if (!def) ctx.fail('NOT_FOUND', 'There is no such item.');
    if (def.id.startsWith('pack.')) ctx.fail('REFUSED', E.carryPack);
    if (def.kind === 'money') ctx.fail('REFUSED', E.carryMoney);
    const carry = payload.carry;
    if (!Number.isSafeInteger(carry) || carry < 0 || carry > READER_CARRY_MAX) ctx.fail('INVALID', fill(E.carryRange, { max: READER_CARRY_MAX }));
    if (carry === 0) delete def.carry;
    else def.carry = carry;
    return { summary: fill(E.itemSet, { detail: `${def.name}: carry ${carry}` }), data: { edit: true, stack: stack.id, def: def.id, carry }, narrate: true };
}
