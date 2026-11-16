// Evidence, record entries: the [{ proof, block }] a stored record holds on the blocks replay could apply.

import { isObject } from '../constants.js';
import { evidenceProblem } from '../stored.js';
import { spanProblem } from '../../replay.js';

const entries = new WeakMap();
// Whether a block could be applied, kept per span object (a record written again keeps the spans it had), so listing the
// proof of a record that grows by one block does not look at every block again.
const checked = new WeakMap();

/**
 * [{ proof, block }] a stored record holds on its blocks, in block order (kept per record). `parts` is the record's
 * blocks as the store replays them ([{ ops, span }], store/memo.js blockParts). Only a block that replay could apply
 * counts: it has changes (an empty span is never replayed), its metadata is whole and is the record's own, and it holds
 * exactly the proof its changes pin. A block that is none of these gives none, whatever its span says.
 */
export function recordEntries(record, parts) {
    let out = entries.get(record);
    if (out) return out;
    out = [];
    const own = record?.source;
    for (const { ops, span } of parts) {
        if (!isObject(span) || typeof span.id !== 'string' || !Array.isArray(span.evidence) || !span.evidence.length) continue;
        let whole = checked.get(span);
        if (whole === undefined) {
            whole = Array.isArray(ops) && ops.length > 0 && !spanProblem(span) && !evidenceProblem(span, ops);
            checked.set(span, whole);
        }
        if (!whole) continue;
        if (!isObject(own) || span.source.sid !== own.logical || span.source.swipeKey !== own.swipeKey || span.source.evidence !== own.evidence) continue;
        for (const proof of span.evidence) out.push(Object.freeze({ proof, block: span.id }));
    }
    Object.freeze(out);
    entries.set(record, out);
    return out;
}
