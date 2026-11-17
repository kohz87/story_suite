// Story Director v2, part **keypeople**: the reader's commands that pin and unpin a key person, and the cap setting.

import { DEFAULT_CAP, MAX_ALIASES, MAX_CAP, cleanName, findPin, isInt, isRecord, keyOf } from '../domain.js';
import { calendarFrom } from '../time.js';
import { removePin } from './removal.js';
import { nowOf, query, revOf } from './shared-ctx.js';

/** The `cap` setting: 0 to MAX_CAP, else the default. */
export function capOf(settings) {
    const value = settings?.cap;
    return isInt(value) && value >= 0 ? Math.min(MAX_CAP, value) : DEFAULT_CAP;
}

function aliasesOf(ctx, value, name) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 24) return ctx.fail('INVALID', 'keypeople.pin: aliases is a list of names.');
    const out = [];
    for (const given of value) {
        if (typeof given !== 'string') return ctx.fail('INVALID', 'keypeople.pin: an alias is a name.');
        const alias = cleanName(given);
        if (keyOf(alias) && keyOf(alias) !== keyOf(name) && !out.some(other => keyOf(other) === keyOf(alias))) out.push(alias);
        if (out.length >= MAX_ALIASES) break;
    }
    return out;
}

const PIN_FIELDS = ['name', 'aliases', 'nsd'];

/** `keypeople.pin { name, aliases? }` (cause `ui`): the reader makes someone a key person, up to the cap. */
export function pin(ctx, payload = {}) {
    if (ctx.cause !== 'ui') return ctx.fail('REFUSED', 'Only you pin a key person; the story cannot.');
    if (!isRecord(payload) || Object.keys(payload).some(field => !PIN_FIELDS.includes(field))) return ctx.fail('INVALID', 'keypeople.pin takes { name, aliases? }.');
    if (typeof payload.name !== 'string') return ctx.fail('INVALID', 'keypeople.pin needs a name.');
    if (payload.nsd !== undefined && typeof payload.nsd !== 'boolean') return ctx.fail('INVALID', 'keypeople.pin: nsd is true or false.');
    const name = cleanName(payload.name);
    if (!keyOf(name)) return ctx.fail('INVALID', 'keypeople.pin needs a name with letters or digits in it.');
    const aliases = aliasesOf(ctx, payload.aliases, name);
    const kp = ctx.draft('keypeople');
    const found = findPin(kp, name, aliases);
    if (found) return { summary: `${found.pin.name} is already a key person.`, narrate: false, data: { person: found.key, edit: true } };
    const cap = capOf(ctx.settings());
    if (Object.keys(kp.pins).length >= cap) return ctx.fail('LIMITED', `You can have ${cap} key ${cap === 1 ? 'person' : 'people'}; unpin someone first (Settings, Modules, Story Director, Key people).`);
    const key = keyOf(name);
    kp.pins[key] = { name, since: nowOf(ctx), rev: revOf(ctx), ...(aliases.length ? { aliases } : {}), ...(payload.nsd === true ? { nsd: true } : {}) };
    delete kp.gone[key];
    return { summary: `${name} is now a key person.`, narrate: false, data: { person: key, pinned: true, edit: true } };
}

/** `keypeople.unpin { name }` (cause `ui`): the reader takes someone off the list. */
export function unpin(ctx, payload = {}) {
    if (ctx.cause !== 'ui') return ctx.fail('REFUSED', 'Only you unpin a key person; the story cannot (a death comes from NPC State).');
    if (!isRecord(payload) || Object.keys(payload).some(field => field !== 'name') || typeof payload.name !== 'string') return ctx.fail('INVALID', 'keypeople.unpin takes { name }.');
    const kp = ctx.draft('keypeople');
    const found = findPin(kp, payload.name);
    if (!found) return ctx.fail('NOT_FOUND', `${cleanName(payload.name) || 'That person'} is not a key person.`);
    const summary = removePin(ctx, kp, found.key, found.pin, 'unpinned', calendarFrom(query(ctx)), nowOf(ctx));
    return { summary, narrate: false, data: { person: found.key, removed: 'unpinned', edit: true } };
}
