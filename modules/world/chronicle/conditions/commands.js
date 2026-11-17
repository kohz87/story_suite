// `chronicle.condition.set` and `chronicle.condition.clear`: the writes to `chronicle.conditions` (cause system or story; never a click). Behind the feature `story-director.world-events`.

import { cleanName, cleanSummary } from '../domain-parts/names.js';
import { revOf } from '../domain-parts/lookup.js';
import { isRecord } from '../domain-parts/shared-basics.js';
import { LASTING_BY } from '../domain-parts/limits-lasting.js';
import { clockOf } from '../capture/text.js';
import { declaredConditions } from './declared.js';
import { fadeMinutes } from './fade.js';
import { conditionKey, pointerOf } from './key.js';
import { knownRef } from './known-refs.js';
import { MAX_CONDITIONS, MAX_PER_REF, SCOPES } from './limits.js';
import { WORLD_EVENTS_FEATURE } from './feature.js';

const BY = /^(?:narrator|director|code)$/;

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
 * ("10 days", "1 season", "until cleared", null = until cleared); left out, the pack's own. Refused with a note when the name is
 * not declared by the pack, the scope is not the declared one, the ref is not a known place, route, region or realm, or a cap is full.
 * Setting one that is active again keeps when it began and moves the end.
 */
function condition(ctx, payload) {
    if (ctx.cause === 'ui') return ctx.fail('REFUSED', 'Conditions are set by the story, not by a click.');
    if (!isRecord(payload)) return ctx.fail('INVALID', 'chronicle.condition.set takes { name, scope?, ref, fades?, why, by }.');
    const by = readBy(ctx, payload, 'chronicle.condition.set');
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const declared = declaredOf(ctx, name);
    if (payload.scope !== undefined && !SCOPES.includes(payload.scope)) return ctx.fail('INVALID', `scope is one of ${SCOPES.join(', ')}.`);
    if (payload.scope !== undefined && payload.scope !== declared.scope) return ctx.fail('REFUSED', `"${name}" is a ${declared.scope} condition, not a ${payload.scope} one.`);
    const ref = knownRef((query, args) => ctx.query(query, args), declared.scope, cleanName(payload.ref));
    if (!ref) return ctx.fail('REFUSED', `"${cleanName(payload.ref)}" is not a place, route, region or realm of this world (${declared.scope} wanted).`);
    const fades = payload.fades === undefined ? declared.fades : payload.fades;
    const minutes = fadeMinutes(fades);
    if (minutes === undefined) return ctx.fail('INVALID', `fades must be a duration like "10 days" or "1 season", or "until cleared".`);
    const now = clockOf(ctx);
    if (now === null) return ctx.fail('NOT_YET', 'The story has no date yet; a condition waits for one.');
    const chronicle = ctx.draft('chronicle');
    const table = chronicle.conditions ?? {};
    const key = conditionKey(name, ref);
    const old = table[key];
    if (!old && Object.keys(table).length >= MAX_CONDITIONS) return ctx.fail('REFUSED', `The world already carries ${MAX_CONDITIONS} conditions; one must end first.`);
    if (!old && Object.values(table).filter(entry => entry.ref === ref).length >= MAX_PER_REF) return ctx.fail('REFUSED', `${ref} already carries ${MAX_PER_REF} conditions.`);
    const why = cleanSummary(typeof payload.why === 'string' ? payload.why : '').slice(0, 200);
    chronicle.conditions = table;
    chronicle.conditions[key] = { name, scope: declared.scope, ref, since: old?.since ?? now, fadesAt: minutes === null ? null : now + minutes, why, by, rev: revOf(ctx) };
    return { summary: `${old ? 'Still' : 'Now'}: ${name} on ${ref}${why ? ` (${why})` : ''}.`, narrate: false, data: { key, created: !old } };
}

/**
 * `chronicle.condition.clear { name, ref, why, by }`: the condition ends on `ref`. A condition that is not active is left as it is (a note, not a failure);
 * a name the pack does not declare is refused.
 */
function clear(ctx, payload) {
    if (ctx.cause === 'ui') return ctx.fail('REFUSED', 'Conditions are ended by the story, not by a click.');
    if (!isRecord(payload)) return ctx.fail('INVALID', 'chronicle.condition.clear takes { name, ref, why, by }.');
    readBy(ctx, payload, 'chronicle.condition.clear');
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    declaredOf(ctx, name);
    const ref = cleanName(payload.ref);
    const chronicle = ctx.draft('chronicle');
    const found = Object.values(chronicle.conditions ?? {}).find(entry => entry.name === name && entry.ref.toLowerCase() === ref.toLowerCase());
    if (!found) return { summary: `${name} is not active on ${ref || 'that place'}.`, narrate: false, data: { key: null } };
    const key = conditionKey(found.name, found.ref);
    // An older reply's condition may be gone when this replays after a delete: the removal is marked ctx.ifThere (SPEC §2.2).
    if (typeof ctx.ifThere === 'function') ctx.ifThere('chronicle', pointerOf(key));
    delete chronicle.conditions[key];
    return { summary: `Ended: ${name} on ${found.ref}.`, narrate: false, data: { key } };
}

/** The commands, each tagged with the feature (Story Block refuses it while it is off). */
export const conditionCommands = {
    'chronicle.condition.set': Object.assign(condition, { feature: WORLD_EVENTS_FEATURE }),
    'chronicle.condition.clear': Object.assign(clear, { feature: WORLD_EVENTS_FEATURE }),
};
