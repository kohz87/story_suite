// The dossier's "changed at reply" stamp (`fieldChangeMessages`, display only) for a story line's write: each stamped field a command changed gets the
// index of the reply the change is stored on (the capture's carrier, else the reply the command's changes go on). A scan's merge stamps these already;
// without this a line's goal, mood or memory left the dossier's last change on an older reply until a Refresh (owner, 21 Nov). Replay applies the same ops;
// they are marked inside the stamps (ctx.ifThere): when the reply that made the stamps container was deleted, a later reply's stamp is passed over
// and the rest of its changes still apply (a stamp is display only). A line never makes the container (NPC State's merge does, with a scan's first change,
// and a `+ npc` stub makes the person with an empty one, ../meters/npc-lines-parts/derived.js stubRecord, so it lives and dies with them): a later scan's own
// stamps are plain changes inside it, which a middle delete of the line's reply would otherwise leave with nowhere to go.
// Stamped: the tracked fields and the ones only a line stamps (gender, level, abilities, keepsakes, aliases, knows: DOSSFIX2 N2), each line label under the
// record key it writes (learns → abilities, keepsake → keepsakes, aka → aliases). `people.stamp` stamps what a line wrote elsewhere (a `~ know` line's `knows`).
import { CHANGE_TRACKED_FIELDS } from '../fields/registry.js';
import { LINE_STAMPED_FIELDS } from '../core/core-birthday-parts/field-change-normalize.js';

const STAMPED = new Set([...CHANGE_TRACKED_FIELDS, ...LINE_STAMPED_FIELDS]);
const KEY_OF = Object.freeze({ learns: 'abilities', keepsake: 'keepsakes', aka: 'aliases' });
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const escapeKey = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');

// Stamps `keys` of person `id`'s record with this reply, when the record has stamps already.
function stamp(ctx, { domain, id, record }, keys) {
    const at = Number.isInteger(ctx.carrier?.index) ? ctx.carrier.index : ctx.reply?.index;
    const stamps = record.fieldChangeMessages;
    if (!Number.isInteger(at) || at < 0 || !isObject(stamps) || !keys.length) return;
    ctx.ifThere?.(domain, `/npcs/${escapeKey(id)}/fieldChangeMessages`);
    for (const key of keys) stamps[key] = at;
}

/** Stamps `record` (the draft of person `id` in people domain `domain`, when it has stamps already) for every field in `fields` (line labels or record keys) whose stored value differs from `before` (a copy taken before the write). */
export function stampChanged(ctx, { domain, id, record, before }, fields) {
    const keys = [...new Set(fields.map(field => KEY_OF[field] ?? field))].filter(key => STAMPED.has(key) && !same(before?.[key], record[key]));
    stamp(ctx, { domain, id, record }, keys);
}

/** `people.stamp { id, fields }`: a module's line changed these stamped fields of the person somewhere else (a `~ know` line's `knows`, on the meter record). */
export function peopleStamp(domain) {
    return {
        'people.stamp': {
            internal: false,
            handler(ctx, payload) {
                if (typeof ctx.caller !== 'string' || !ctx.caller || ctx.caller.startsWith('event:')) return ctx.fail('REFUSED', 'Only a module\'s own command may stamp a person\'s last change.');
                const fields = Array.isArray(payload?.fields) ? payload.fields : [];
                if (typeof payload?.id !== 'string' || !fields.length || fields.some(field => !LINE_STAMPED_FIELDS.includes(field))) return ctx.fail('INVALID', `people.stamp takes { id, fields } of ${LINE_STAMPED_FIELDS.join(', ')}.`);
                if (!isObject(ctx.read(domain)?.npcs?.[payload.id])) return ctx.fail('REFUSED', 'There is no such person in this story.');
                stamp(ctx, { domain, id: payload.id, record: ctx.draft(domain).npcs[payload.id] }, fields);
                return { summary: '', narrate: false, data: { id: payload.id, fields } };
            },
        },
    };
}
