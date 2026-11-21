// The dossier's "changed at reply" stamp (`fieldChangeMessages`, display only) for a story line's write: each tracked field a command changed gets the
// index of the reply the change is stored on (the capture's carrier, else the reply the command's changes go on). A scan's merge stamps these already;
// without this a line's goal, mood or memory left the dossier's last change on an older reply until a Refresh (owner, 21 Nov). Replay applies the same ops;
// they are marked inside the stamps (ctx.ifThere): when the reply that made the stamps container was deleted, a later reply's stamp is passed over
// and the rest of its changes still apply (a stamp is display only).
import { CHANGE_TRACKED_FIELDS } from '../fields/registry.js';

const TRACKED = new Set(CHANGE_TRACKED_FIELDS);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const escapeKey = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');

/** Stamps `record` (the draft of person `id` in people domain `domain`) for every field in `fields` whose value differs from `before` (a copy taken before the write). */
export function stampChanged(ctx, { domain, id, record, before }, fields) {
    const at = Number.isInteger(ctx.carrier?.index) ? ctx.carrier.index : ctx.reply?.index;
    if (!Number.isInteger(at) || at < 0) return;
    const moved = fields.filter(field => TRACKED.has(field) && !same(before?.[field], record[field]));
    if (!moved.length) return;
    ctx.ifThere?.(domain, `/npcs/${escapeKey(id)}/fieldChangeMessages`);
    const stamps = record.fieldChangeMessages && typeof record.fieldChangeMessages === 'object' && !Array.isArray(record.fieldChangeMessages) ? record.fieldChangeMessages : {};
    record.fieldChangeMessages = { ...stamps, ...Object.fromEntries(moved.map(field => [field, at])) };
}
