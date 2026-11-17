// `chronicle.condition.set` and `chronicle.condition.clear`: the writes to `chronicle.conditions` (cause system or story; never a click). Behind the feature `story-director.world-events`.

import { cleanName, cleanSummary } from '../domain-parts/names.js';
import { revOf } from '../domain-parts/lookup.js';
import { isRecord } from '../domain-parts/shared-basics.js';
import { LASTING_BY } from '../domain-parts/limits-lasting.js';
import { clockOf } from '../capture/text.js';
import { declaredConditions } from './declared.js';
import { fadeMinutes } from './fade.js';
import { tempoOf } from '../world-daily/tempo.js';
import { conditionKey, pointerOf } from './key.js';
import { hostGeo, knownRef } from './known-refs.js';
import { markLedger } from './ledger.js';
import { setRefusal } from './refusal.js';
import { SCOPES } from './limits.js';
import { WORLD_EVENTS_FEATURE } from './feature.js';

const BY = /^(?:narrator|director|code)$/;
const DAY = 1440;

/**
 * The end of a condition set again (spec §2 Holders): the longer remaining time is kept ("until cleared" is longest), and the
 * daily step's event holds (`holds`, `open`) stay. A condition set for the first time ends `minutes` from now (null: never).
 */
function lifetime(old, minutes, now) {
    const end = minutes === null ? null : now + minutes;
    if (!old) return { fadesAt: end };
    if (old.holds?.length) return { fadesAt: end === null ? old.fadesAt : old.fadesAt === null ? end : Math.max(old.fadesAt, end), holds: old.holds, ...(old.open || end === null ? { open: true } : {}) };
    if (old.fadesAt === null || end === null) return { fadesAt: null };
    return { fadesAt: old.fadesAt > now ? Math.max(old.fadesAt, end) : end };
}

// Who wrote it: `event:<id>`, "narrator", "director" or "code".
function readBy(ctx, payload, type) {
    if (typeof payload.by !== 'string' || !(BY.test(payload.by) || LASTING_BY.test(payload.by))) {
        return ctx.fail('INVALID', `${type} needs by: "event:<id>", "narrator", "director" or "code".`);
    }
    return payload.by;
}

function declaredOf(ctx, name) {
    const declared = declaredConditions((query, args) => ctx.query(query, args)).find(entry => entry.name === name);
    if (!declared) ctx.fail('REFUSED', `"${name}" is not one of this world's conditions.`);
    return declared;
}

/**
 * `chronicle.condition.set { name, scope?, ref, fades?, why, by }`: the condition is active on `ref`. `fades` is how long it lasts
 * ("10 days", "1 season", "until cleared", null = until cleared; whole days, at least one); left out, the pack's own. `ref` is read as
 * the condition's declared scope (an id, a name or an alias; spec §2 Clearing scope: a place ref on a region condition is refused).
 * Refused with a note when the name is not declared by the pack, the scope is not the declared one, the ref is not a place, route,
 * region or realm of that scope, or setRefusal says so (no date, cleared there today, a full cap, a placeStatus where a protected
 * person lives). Setting one that is active again keeps when it began and the longer end. The `set:` anchors go to the ledger.
 */
function condition(ctx, payload) {
    if (ctx.cause === 'ui') return ctx.fail('REFUSED', 'Conditions are set by the story, not by a click.');
    if (!isRecord(payload)) return ctx.fail('INVALID', 'chronicle.condition.set takes { name, scope?, ref, fades?, why, by }.');
    const by = readBy(ctx, payload, 'chronicle.condition.set');
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const declared = declaredOf(ctx, name);
    if (payload.scope !== undefined && !SCOPES.includes(payload.scope)) return ctx.fail('INVALID', `scope is one of ${SCOPES.join(', ')}.`);
    if (payload.scope !== undefined && payload.scope !== declared.scope) return ctx.fail('REFUSED', `"${name}" is a ${declared.scope} condition, not a ${payload.scope} one.`);
    const query = (type, args) => ctx.query(type, args);
    const geo = hostGeo(query);
    const ref = knownRef(query, declared.scope, cleanName(payload.ref), geo);
    if (!ref) return ctx.fail('REFUSED', `"${cleanName(payload.ref)}" is not a ${declared.scope} of this world (a ${declared.scope} condition takes a ${declared.scope}).`);
    const fades = payload.fades === undefined ? declared.fades : payload.fades;
    const minutes = fadeMinutes(fades, tempoOf(typeof ctx.settings === 'function' ? ctx.settings() : ctx.settings));
    if (minutes === undefined) return ctx.fail('INVALID', `fades must be a duration like "10 days" or "1 season", or "until cleared".`);
    const now = clockOf(ctx);
    if (now === null) return ctx.fail('NOT_YET', 'The story has no date yet; a condition waits for one.');
    const chronicle = ctx.draft('chronicle');
    const refusal = setRefusal({ query, chronicle, geo, declared, ref, now, by });
    if (refusal) return ctx.fail('REFUSED', `${refusal[0].toUpperCase()}${refusal.slice(1)}.`);
    const table = chronicle.conditions ?? {};
    const key = conditionKey(name, ref);
    // An entry past its end that settle has not removed yet is gone: setting it again starts it anew (a `set:` anchor, a new `since`).
    const held = table[key];
    const old = held && (held.holds?.length > 0 || !(Number.isInteger(held.fadesAt) && held.fadesAt <= now)) ? held : undefined;
    const why = cleanSummary(typeof payload.why === 'string' ? payload.why : '').slice(0, 200);
    chronicle.conditions = table;
    chronicle.conditions[key] = { name, scope: declared.scope, ref, since: old?.since ?? now, ...lifetime(old, minutes, now), why, by, rev: revOf(ctx) };
    if (!old) markLedger(chronicle, { day: Math.floor(now / DAY), anchors: [`set:${name}`, `set:${key}`] });
    return { summary: `${old ? 'Still' : 'Now'}: ${name} on ${ref}${why ? ` (${why})` : ''}.`, narrate: false, data: { key, created: !old } };
}

/**
 * `chronicle.condition.clear { name, ref, why, by }`: the condition ends on `ref`, read as its declared scope (spec §2 Clearing scope:
 * a clear acts at the scope it is held, so a region condition cleared on its region is gone for every place in it). It is not set
 * there again today (the ledger's tomb), and the `cleared:` anchors go to the ledger. One that is not active is left as it is (a
 * note, not a failure); a name the pack does not declare, or a ref of another scope, is refused.
 */
function clear(ctx, payload) {
    if (ctx.cause === 'ui') return ctx.fail('REFUSED', 'Conditions are ended by the story, not by a click.');
    if (!isRecord(payload)) return ctx.fail('INVALID', 'chronicle.condition.clear takes { name, ref, why, by }.');
    readBy(ctx, payload, 'chronicle.condition.clear');
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const declared = declaredOf(ctx, name);
    const given = cleanName(payload.ref);
    const chronicle = ctx.draft('chronicle');
    const table = chronicle.conditions ?? {};
    // A ref read as the scope; an entry kept under a name the map no longer has is still found by its own name.
    const ref = knownRef((type, args) => ctx.query(type, args), declared.scope, given) ?? Object.values(table).find(entry => entry.name === name && entry.ref.toLowerCase() === given.toLowerCase())?.ref;
    if (!ref) return ctx.fail('REFUSED', `"${given}" is not a ${declared.scope} of this world (a ${declared.scope} condition is cleared on a ${declared.scope}).`);
    const found = table[conditionKey(name, ref)];
    if (!found) {
        // Not active: nothing to end, but the day's tomb still holds (spec §2: a clear at a ref is not undone by a set there the same day), as the daily step's clear does.
        const at = clockOf(ctx);
        if (at !== null) markLedger(chronicle, { day: Math.floor(at / DAY), tombKeys: [conditionKey(name, ref)] });
        return { summary: `${name} is not active on ${ref || 'that place'}.`, narrate: false, data: { key: null } };
    }
    const key = conditionKey(found.name, found.ref);
    // An older reply's condition may be gone when this replays after a delete: the removal is marked ctx.ifThere (SPEC §2.2).
    if (typeof ctx.ifThere === 'function') ctx.ifThere('chronicle', pointerOf(key));
    delete chronicle.conditions[key];
    const now = clockOf(ctx);
    if (now !== null) markLedger(chronicle, { day: Math.floor(now / DAY), anchors: [`cleared:${name}`, `cleared:${key}`], tombKeys: [key] });
    return { summary: `Ended: ${name} on ${found.ref}.`, narrate: false, data: { key } };
}

/** The commands, each tagged with the feature (Story Block refuses it while it is off). */
export const conditionCommands = {
    'chronicle.condition.set': Object.assign(condition, { feature: WORLD_EVENTS_FEATURE }),
    'chronicle.condition.clear': Object.assign(clear, { feature: WORLD_EVENTS_FEATURE }),
};
