// The dossier's "changed at reply" stamp (`fieldChangeMessages`, display only) for a story line's write: each tracked field a command changed gets the
// index of the reply the change is stored on (the capture's carrier, else the reply the command's changes go on). A scan's merge stamps these already;
// without this a line's goal, mood or memory left the dossier's last change on an older reply until a Refresh (owner, 21 Nov). Replay applies the same ops;
// they are marked inside the stamps (ctx.ifThere): when the reply that made the stamps container was deleted, a later reply's stamp is passed over
// and the rest of its changes still apply (a stamp is display only). A line never makes the container (NPC State's merge does, with a scan's first change,
// and a `+ npc` stub makes the person with an empty one, ../meters/npc-lines-parts/derived.js stubRecord, so it lives and dies with them): a later scan's own
// stamps are plain changes inside it, which a middle delete of the line's reply would otherwise leave with nowhere to go.
import { CHANGE_TRACKED_FIELDS } from '../fields/registry.js';

const TRACKED = new Set(CHANGE_TRACKED_FIELDS);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const escapeKey = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');

/** Stamps `record` (the draft of person `id` in people domain `domain`, when it has stamps already) for every field in `fields` whose value differs from `before` (a copy taken before the write). */
export function stampChanged(ctx, { domain, id, record, before }, fields) {
    const at = Number.isInteger(ctx.carrier?.index) ? ctx.carrier.index : ctx.reply?.index;
    const stamps = record.fieldChangeMessages;
    if (!Number.isInteger(at) || at < 0 || !stamps || typeof stamps !== 'object' || Array.isArray(stamps)) return;
    const moved = fields.filter(field => TRACKED.has(field) && !same(before?.[field], record[field]));
    if (!moved.length) return;
    ctx.ifThere?.(domain, `/npcs/${escapeKey(id)}/fieldChangeMessages`);
    for (const field of moved) stamps[field] = at;
}
