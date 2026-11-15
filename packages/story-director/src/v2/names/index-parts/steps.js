// Story Director v2, names: the system commands `names.seen` and `names.told`.

import { cleanName } from './text.js';
import { nameKey } from './keys.js';
import { MAX_SEEN, MAX_TAKEN } from './slice-limits.js';
import { tables, identityKey, identityOk, revOf } from './slice-keys.js';
import { jsonKey, oldest } from './slice-edit.js';
import { isRecord } from './host-read.js';

/** `names.seen { who, identities? }` (system): record names and the aliases belonging to each known person. */
export function seeSeen(ctx, payload = {}) {
    if (ctx.cause !== 'system') return ctx.fail('REFUSED', 'The names others use are noted by Story Director itself.');
    if (!isRecord(payload) || !Array.isArray(payload.who) || payload.who.length > 60 || payload.who.some(name => typeof name !== 'string') || (payload.identities !== undefined && (!Array.isArray(payload.identities) || payload.identities.length > 60 || payload.identities.some(entry => !identityOk(entry))))) return ctx.fail('INVALID', 'names.seen takes { who: [name], identities?: [person] }.');
    const { people, seen } = tables(ctx.draft('names'));
    for (const raw of payload.who) {
        const name = cleanName(raw);
        const key = nameKey(name);
        if (key && !Object.hasOwn(people, key) && !Object.hasOwn(seen, key)) seen[key] = { name, rev: revOf(ctx) };
    }
    for (const entry of payload.identities ?? []) if (!Object.hasOwn(seen, identityKey(entry))) seen[identityKey(entry)] = { name: entry.name, source: entry.source, aliases: entry.aliases, rev: revOf(ctx) };
    oldest(seen, MAX_SEEN);
    return { summary: 'Names noted.', narrate: false };
}

/** `names.told { who }` (system): the rename cue of these refusals went to the narrator with this reply. */
export function told(ctx, payload = {}) {
    if (ctx.cause !== 'system') return ctx.fail('REFUSED', 'The rename cue is marked told by Story Director itself.');
    if (!isRecord(payload) || !Array.isArray(payload.who) || payload.who.length > MAX_TAKEN || payload.who.some(key => typeof key !== 'string')) return ctx.fail('INVALID', 'names.told takes { who: [key] }.');
    const { taken } = tables(ctx.draft('names'));
    for (const key of payload.who) if (Object.hasOwn(taken, key)) { ctx.ifThere('names', `/taken/${jsonKey(key)}`); taken[key].told = true; }
    return { summary: 'Rename cue told.', narrate: false };
}
