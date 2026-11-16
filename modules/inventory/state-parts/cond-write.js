// Writing a condition event to a stack and checking the condition log.

import { isPlainObject } from '../../scene/domains/common.js';
import { COND_MAX, COND_LOG_MAX, clampCond } from './shared-cond.js';
import { condOf } from './cond-read.js';

// Adds one condition event (`d`) to a stack, as this reply's (or this receipt's) own key, and returns
// the condition now. Back at 100 the stack's events (and an older plain `cond`) are dropped by key; past
// COND_LOG_MAX events they are folded into one. Logs of stacks no longer there are dropped too (a stack a
// deleted reply had dropped, back on replay, starts as new then).
export function condWrite(ctx, inv, stack, d) {
    if (!isPlainObject(inv.condLog)) inv.condLog = {};
    for (const id of Object.keys(inv.condLog)) if (!isPlainObject(inv.stacks[id])) delete inv.condLog[id];
    if (!isPlainObject(inv.condLog[stack.id])) inv.condLog[stack.id] = {};
    const log = inv.condLog[stack.id];
    const owner = typeof ctx.carrier?.sid === 'string' && ctx.carrier.sid ? ctx.carrier.sid : String(ctx.receiptId ?? 'rc');
    let k = 1;
    while (Object.hasOwn(log, `${owner}#${k}`)) k += 1;
    const n = Number.isSafeInteger(ctx.rev) ? ctx.rev : 0;
    log[`${owner}#${k}`] = { d, n };
    const now = condOf(stack, inv);
    // Only keys go, never the records that hold them: a record a later reply finds missing is written
    // whole, and replayed after a middle delete that whole write would put back or drop other replies'
    // events. (A stack's whole log goes only once the stack itself is gone.)
    if (now === COND_MAX) {
        for (const key of Object.keys(log)) delete log[key];
        delete stack.cond;
    } else if (Object.keys(log).length > COND_LOG_MAX) {
        const start = Number.isSafeInteger(stack.cond) ? clampCond(stack.cond) : COND_MAX;
        for (const key of Object.keys(log)) delete log[key];
        log[`${owner}#${k}`] = { d: now - start, n };
    }
    return now;
}

export function condLogErrors(condLog) {
    if (!isPlainObject(condLog)) return ['The condition log is not a record.'];
    const errors = [];
    for (const [stackId, log] of Object.entries(condLog)) {
        if (!isPlainObject(log)) { errors.push(`The condition log of ${stackId} is not a record.`); continue; }
        for (const [key, event] of Object.entries(log)) {
            if (!isPlainObject(event) || !Number.isSafeInteger(event.d) || Math.abs(event.d) > COND_MAX || !Number.isSafeInteger(event.n)) {
                errors.push(`The condition event ${key} of ${stackId} needs a change from -${COND_MAX} to ${COND_MAX} and its rev.`);
            }
        }
    }
    return errors;
}
