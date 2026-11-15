// Story Director v2, part **cast**: world-level cast steps (`cast.sync`, `cast.advance`, `cast.journey`).

import { applyAdvance, applyJourney, applySync } from '../apply.js';
import { MAX_DOING, MAX_NAME, MAX_PEOPLE, MAX_PLACE, MAX_REASON, isInt, isRecord } from '../domain.js';
import { envOf, keyOk, only, textOk } from './shared-helpers.js';

// ---- cast.sync ---------------------------------------------------------------------------------------------------------------

const SYNC_FIELDS = ['add', 'update', 'drop', 'updated', 'init', 'first', 'names', 'at'];

function checkSync(payload) {
    if (!isRecord(payload) || Object.keys(payload).some(field => !SYNC_FIELDS.includes(field))) return 'cast.sync takes { add?, update?, drop?, updated?, init?, names?, at? }.';
    const list = (value, max) => value === undefined || (Array.isArray(value) && value.length <= max);
    if (![payload.add, payload.update, payload.drop, payload.updated].every(value => list(value, MAX_PEOPLE))) return 'cast.sync: add, update, drop and updated are lists.';
    if (payload.init !== undefined && payload.init !== true) return 'cast.sync: init is true.';
    if (payload.first !== undefined && payload.first !== true) return 'cast.sync: first is true.';
    if (payload.at !== undefined && !(isInt(payload.at) && payload.at >= 0)) return 'cast.sync: at is the chat\'s length.';
    if (payload.names !== undefined && !(isRecord(payload.names) && Object.keys(payload.names).length <= 8 && Object.values(payload.names).every(name => textOk(name, MAX_NAME)))) return 'cast.sync: names is { pack: name }.';
    for (const item of payload.add ?? []) {
        if (!isRecord(item) || !textOk(item.pack, MAX_NAME) || !textOk(item.id, MAX_NAME) || !item.pack || !item.id || !textOk(item.name, MAX_NAME) || !item.name
            || !textOk(item.ver, MAX_NAME) || !(item.sig === undefined || textOk(item.sig, 24)) || !textOk(item.place, MAX_PLACE) || !textOk(item.doing, MAX_DOING)
            || !(item.aliases === undefined || (Array.isArray(item.aliases) && item.aliases.length <= 6 && item.aliases.every(alias => textOk(alias, MAX_NAME))))) return 'cast.sync: each of add is { pack, id, name, aliases?, ver, place, doing }.';
    }
    for (const item of payload.update ?? []) {
        if (!isRecord(item) || !keyOk(item.key) || !textOk(item.ver, MAX_NAME) || !(item.sig === undefined || textOk(item.sig, 24)) || !textOk(item.name, MAX_NAME) || !(Array.isArray(item.aliases) && item.aliases.length <= 6 && item.aliases.every(alias => textOk(alias, MAX_NAME)))) return 'cast.sync: each of update is { key, ver, sig?, name, aliases }.';
    }
    if ((payload.drop ?? []).some(key => !keyOk(key))) return 'cast.sync: drop is a list of keys.';
    for (const item of payload.updated ?? []) {
        if (!isRecord(item) || !textOk(item.pack, MAX_NAME) || !isInt(item.n) || !isInt(item.changed) || !textOk(item.from, MAX_NAME) || !textOk(item.to, MAX_NAME)) return 'cast.sync: each of updated is { pack, n, changed, from, to }.';
    }
    return '';
}

/** `cast.sync` (cause `system`). `packNames` (the hook's) names a pack in the card's words. */
export function sync(ctx, payload = {}) {
    only(ctx, 'Who joins the world from the packs');
    const bad = checkSync(payload);
    if (bad) return ctx.fail('INVALID', bad);
    const cast = ctx.draft('cast');
    const names = isRecord(payload.names) ? payload.names : {};
    const done = applySync(cast, payload, envOf(ctx, cast, names, payload.at));
    const parts = [done.added ? `${done.added} joined the world` : '', done.updated ? `${done.updated} updated` : '', done.dropped ? `${done.dropped} left` : ''].filter(Boolean);
    return { summary: parts.length ? `The cast: ${parts.join(', ')}.` : 'The cast: nothing new.', narrate: false, data: { added: done.added, updated: done.updated, dropped: done.dropped } };
}

// ---- cast.advance ------------------------------------------------------------------------------------------------------------

function checkAdvance(payload) {
    if (!isRecord(payload) || Object.keys(payload).some(field => !['from', 'to', 'moves', 'died', 'at'].includes(field))) return 'cast.advance takes { from, to, moves?, died? }.';
    if (!isInt(payload.to) || !(payload.from === null || payload.from === undefined || isInt(payload.from)) || !(payload.at === undefined || (isInt(payload.at) && payload.at >= 0))) return 'cast.advance: from and to are story minutes, at the chat\'s length.';
    if (!(payload.moves === undefined || (Array.isArray(payload.moves) && payload.moves.length <= MAX_PEOPLE)) || !(payload.died === undefined || (Array.isArray(payload.died) && payload.died.length <= MAX_PEOPLE))) return 'cast.advance: moves and died are lists.';
    for (const item of payload.moves ?? []) {
        if (!isRecord(item) || !keyOk(item.key) || !textOk(item.where ?? '', MAX_PLACE) || !textOk(item.doing ?? '', MAX_DOING)) return 'cast.advance: each of moves is { key, where, doing }.';
        // `from` (new replies): the last place the atlas had a road for and the minute they left it, kept over a move with no road (world.js `moveReach`).
        if (item.from !== undefined && !(isRecord(item.from) && textOk(item.from.where, MAX_PLACE) && (item.from.since === null || isInt(item.from.since)))) return 'cast.advance: a move\'s from is { where, since }.';
    }
    for (const item of payload.died ?? []) {
        if (!isRecord(item) || !keyOk(item.key)) return 'cast.advance: each of died is { key }.';
    }
    return '';
}

/** `cast.advance` (cause `system`): the batch after a day change or a time skip, and the minute the cast was moved to. */
export function advance(ctx, payload = {}) {
    only(ctx, 'Where the cast has moved on to');
    const bad = checkAdvance(payload);
    if (bad) return ctx.fail('INVALID', bad);
    const cast = ctx.draft('cast');
    const done = applyAdvance(cast, payload, envOf(ctx, cast, {}, payload.at));
    return {
        summary: done.moved + done.died ? `The cast moved on (${done.moved + done.died}).` : 'The cast: nothing changed.',
        narrate: false,
        data: { moved: done.moved, died: done.died },
    };
}

// ---- cast.journey ------------------------------------------------------------------------------------------------------------

/** `cast.journey { start?, stop?, land? }` (cause `system`): see `applyJourney`. */
export function journey(ctx, payload = {}) {
    only(ctx, 'Who sets out towards the party');
    const list = value => value === undefined || (Array.isArray(value) && value.length <= MAX_PEOPLE);
    if (!isRecord(payload) || Object.keys(payload).some(field => !['start', 'stop', 'land'].includes(field)) || ![payload.start, payload.stop, payload.land].every(list)) return ctx.fail('INVALID', 'cast.journey takes { start?, stop?, land? }.');
    for (const item of payload.start ?? []) {
        if (!isRecord(item) || !keyOk(item.key) || !textOk(item.to, MAX_PLACE) || !item.to || !isInt(item.arrive) || !textOk(item.reason ?? '', MAX_REASON)) return ctx.fail('INVALID', 'cast.journey: each of start is { key, to, arrive, reason }.');
    }
    if ((payload.stop ?? []).some(key => !keyOk(key))) return ctx.fail('INVALID', 'cast.journey: stop is a list of keys.');
    for (const item of payload.land ?? []) {
        if (!isRecord(item) || !keyOk(item.key) || !textOk(item.where ?? '', MAX_PLACE) || !textOk(item.doing ?? '', MAX_DOING)) return ctx.fail('INVALID', 'cast.journey: each of land is { key, where, doing }.');
    }
    const cast = ctx.draft('cast');
    const done = applyJourney(cast, payload, envOf(ctx, cast));
    return { summary: 'The cast: someone is on the road.', narrate: false, data: { ...done } };
}
