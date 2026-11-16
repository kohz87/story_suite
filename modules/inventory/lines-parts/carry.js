// The carry limit: whether a take fits, and the reader's own takes refused over it.

import { isPlainObject } from '../../scene/domains/common.js';
import { gearOn } from '../state.js';
import { carryAnswer } from '../queries.js';

// The carry limit, when a module keeps one (`items.carry`, MODULES §F39): whether `owner` can take on
// `add` ([{ defId, qty }]; `move` for a hand-over between the party's own) → { ok, message }, or null
// when no module answers (no limit).
export function carryFits(ctx, add, owner, move = false) {
    const fits = carryAnswer((name, args) => ctx.query(name, args), { owner, add, ...(move ? { move: true } : {}) }, gearOn(ctx));
    if (!isPlainObject(fits)) return null;
    const message = typeof fits.message === 'string' && fits.message ? fits.message : 'There is no room to carry that.';
    return { ok: fits.ok !== false, message };
}

// The reader's own takes and hand-overs (MODULES §F39): over the limit they are refused, nothing moves.
export function readerCarry(ctx, add, owner, move = false) {
    const fits = carryFits(ctx, add, owner, move);
    if (fits && !fits.ok) ctx.fail('REFUSED', fits.message);
}
