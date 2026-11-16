// Wears and repairs a stack's condition by an amount, for another module's rules.

import { stackIn } from '../stacks.js';
import { condOf, condWrite } from '../state.js';
import { moduleOnly, amountArg } from './shared-guards.js';

// `inventory.wear { stack, amount }`: the condition goes down by `amount` (1…100), never below 0 (broken).
export function wear(ctx, payload) {
    moduleOnly(ctx, 'Wear');
    const inv = ctx.draft('inventory');
    const stack = stackIn(ctx, inv, payload.stack);
    const def = inv.defs[stack.def];
    const amount = amountArg(ctx, payload.amount, undefined, 'wear');
    if (amount < 1) ctx.fail('INVALID', 'The wear must be a whole number of at least 1.');
    const before = condOf(stack, inv);
    const now = condWrite(ctx, inv, stack, -amount);
    return {
        summary: before === 0 ? `${def.name} is already broken.` : now === 0 ? `${def.name} breaks.` : `${def.name} wears (${before} → ${now}).`,
        data: { stack: stack.id, def: def.id, amount, before, now, broken: now === 0 },
        narrate: false,
    };
}

// `inventory.repair { stack, amount }`: the condition goes up by `amount` (1…100), never above 100;
// as new (100), the field is dropped again.
export function repair(ctx, payload) {
    moduleOnly(ctx, 'Repair');
    const inv = ctx.draft('inventory');
    const stack = stackIn(ctx, inv, payload.stack);
    const def = inv.defs[stack.def];
    const amount = amountArg(ctx, payload.amount, undefined, 'repair');
    if (amount < 1) ctx.fail('INVALID', 'The repair must be a whole number of at least 1.');
    const before = condOf(stack, inv);
    const now = condWrite(ctx, inv, stack, amount);
    return {
        summary: now === before ? `${def.name} is already as good as new.` : `${def.name} is mended (${before} → ${now}).`,
        data: { stack: stack.id, def: def.id, amount, before, now },
        narrate: false,
    };
}
