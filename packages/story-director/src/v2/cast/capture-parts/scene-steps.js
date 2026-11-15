// Story Director v2, part **cast**: scene meeting steps (`cast.meet`, `cast.rumor`, `cast.withdraw`).

import { applyMeet, applyRumor, applyWithdraw } from '../apply.js';
import { MAX_RUMOR } from '../sought.js';
import { MAX_NAME, MAX_PLACE, MAX_REASON, WHYS, isInt, isRecord } from '../domain.js';
import { envOf, keyOk, only, textOk } from './shared-helpers.js';

// ---- cast.meet ---------------------------------------------------------------------------------------------------------------

/** `cast.meet` (cause `system`): the party meets someone for the first time. */
export function meet(ctx, payload = {}) {
    only(ctx, 'Who crosses your path');
    if (!isRecord(payload) || Object.keys(payload).some(field => !['at', 'who', 'names'].includes(field)) || !isInt(payload.at) || payload.at < 0 || !Array.isArray(payload.who) || !payload.who.length || payload.who.length > 4) {
        return ctx.fail('INVALID', 'cast.meet takes { at, who: [{ key, why, reason }] }.');
    }
    for (const item of payload.who) {
        if (!isRecord(item) || !keyOk(item.key) || !WHYS.includes(item.why) || !textOk(item.reason ?? '', MAX_REASON) || !textOk(item.place ?? '', MAX_PLACE)) return ctx.fail('INVALID', 'cast.meet: each of who is { key, why: place | goal | sought | story, reason, place? }.');
    }
    if (payload.names !== undefined && !(isRecord(payload.names) && Object.keys(payload.names).length <= 8 && Object.values(payload.names).every(name => textOk(name, MAX_NAME)))) return ctx.fail('INVALID', 'cast.meet: names is { pack: name }.');
    const cast = ctx.draft('cast');
    const names = isRecord(payload.names) ? payload.names : {};
    const met = applyMeet(cast, payload, envOf(ctx, cast, names, payload.at));
    if (!met.length) return { summary: 'No one new crossed your path.', narrate: false, data: { met: 0 } };
    const who = met.map(key => cast.people[key].name);
    return { summary: `Paths crossed: ${who.join(', ')}.`, narrate: false, data: { met: met.length, keys: met } };
}

// ---- cast.rumor --------------------------------------------------------------------------------------------------------------

/** `cast.rumor` (cause `system`): a sought person who is elsewhere is told of without a name, once. */
export function rumor(ctx, payload = {}) {
    only(ctx, 'Whom people here have heard of');
    if (!isRecord(payload) || Object.keys(payload).some(field => !['at', 'who', 'names'].includes(field)) || !isInt(payload.at) || payload.at < 0 || !Array.isArray(payload.who) || !payload.who.length || payload.who.length > 2) {
        return ctx.fail('INVALID', 'cast.rumor takes { at, who: [{ key, where, text }] }.');
    }
    for (const item of payload.who) {
        if (!isRecord(item) || !keyOk(item.key) || !textOk(item.where ?? '', MAX_PLACE) || !textOk(item.text ?? '', MAX_RUMOR)) return ctx.fail('INVALID', 'cast.rumor: each of who is { key, where, text }.');
    }
    if (payload.names !== undefined && !(isRecord(payload.names) && Object.keys(payload.names).length <= 8 && Object.values(payload.names).every(name => textOk(name, MAX_NAME)))) return ctx.fail('INVALID', 'cast.rumor: names is { pack: name }.');
    const cast = ctx.draft('cast');
    const names = isRecord(payload.names) ? payload.names : {};
    const told = applyRumor(cast, payload, envOf(ctx, cast, names, payload.at));
    // The summary never says who: an unmet person stays hidden.
    return { summary: told.length ? 'People here know of someone you sought.' : 'No one new was heard of.', narrate: false, data: { told: told.length } };
}

// ---- cast.withdraw -----------------------------------------------------------------------------------------------------------

/**
 * `cast.withdraw` (cause `system`, from the hook after the reply's lines): the reply did not name the people it was told to bring in. It is
 * stored on that reply, so a swipe, a Re-read or a delete of the reply takes it back or decides again.
 */
export function withdraw(ctx, payload = {}) {
    only(ctx, 'Whose meeting the reply did not show');
    if (!isRecord(payload) || Object.keys(payload).some(field => !['at', 'keys'].includes(field)) || !isInt(payload.at) || payload.at < 0
        || !Array.isArray(payload.keys) || !payload.keys.length || payload.keys.length > 4 || !payload.keys.every(keyOk)) {
        return ctx.fail('INVALID', 'cast.withdraw takes { at, keys: [key] }.');
    }
    const cast = ctx.draft('cast');
    const out = applyWithdraw(cast, payload, envOf(ctx, cast, {}, payload.at));
    return { summary: out.length ? 'The reply did not show the people it was to bring in; their meeting is taken back.' : 'No meeting to take back.', narrate: false, data: { withdrawn: out.length } };
}
