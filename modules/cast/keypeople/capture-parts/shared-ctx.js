// Story Director v2, part **keypeople**: reads the reply context (text, rev, story time, query) safely for the writers.

import { isInt } from '../domain.js';

export const asText = value => (typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value));
export const revOf = ctx => (isInt(ctx?.rev) ? ctx.rev : 0);
export const nowOf = ctx => {
    try {
        const minutes = typeof ctx?.time === 'function' ? ctx.time() : null;
        return isInt(minutes) ? minutes : null;
    } catch {
        return null;
    }
};
export const query = ctx => (typeof ctx?.query === 'function' ? (name, args) => ctx.query(name, args) : null);
