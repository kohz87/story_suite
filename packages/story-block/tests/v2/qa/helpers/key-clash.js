// QA oracle for edited Re-reads: a stored `add` that lands on a key already in use. Live, a module picks a free
// key for an entry keyed by rev (`<rev>.<n>`: `while (Object.hasOwn(map, key)) n += 1`) and a claim is taken
// once (`ctx.claim` refuses a held one), so on a line of history told straight on, no reply's stored add finds
// its rev-keyed entry or its claim already there. An edited Re-read that writes more entries (or uses more revs
// before them) than the reply did live can move its own keys onto ones a later reply stored; replayed as
// written, that later add then overwrites the Re-read's entry (PROBLEMSKEY), which the replay oracle cannot see
// (it overwrites the same way). This walks the line as the oracle rebuilds it and lists every such add.
// Not a test file (the test glob does not match helpers/).
import { readRecord } from '../../../../src/v2/persist.js';
import { carriers, rebuildAt, strictApply } from './oracle.js';

const REV_KEY = /^\d+(?:\.\d+)?$/;
const unescape = segment => segment.replace(/~1/g, '/').replace(/~0/g, '~');
// A record's blocks with their spans (as oracle.js reads them): one block of all ops when the spans do not add up.
function blocks(record) {
    const spans = Array.isArray(record.spans) ? record.spans : [];
    if (spans.reduce((sum, span) => sum + (Number.isInteger(span?.n) ? span.n : NaN), 0) !== record.ops.length) return record.ops.length ? [{ ops: record.ops, span: null }] : [];
    let from = 0;
    return spans.filter(span => span.n).map(span => ({ ops: record.ops.slice(from, (from += span.n)), span }));
}
const at = (root, keys) => keys.reduce((node, key) => (node !== null && typeof node === 'object' && Object.hasOwn(node, key) ? node[key] : undefined), root);

/** What kind of key an add path ends in: 'rev' (an entry `<rev>.<n>` in a domain map), 'claim' or null. */
function keyKind(keys) {
    if (keys[0] === 'domains' && keys.length >= 4 && REV_KEY.test(keys.at(-1))) return 'rev';
    if (keys[0] === 'meta' && keys[1] === 'claims' && keys.length === 3) return 'claim';
    return null;
}

/**
 * [{ index, kind, path, held, value, guarded }]: every stored add on the chat's line of history whose rev-keyed entry
 * already holds another value, or whose claim is already held, in the state before its block. `guarded`: the block is a
 * guarded one (its span has an id), which replay refuses with a claim already held (REPLAY.md, rule 4); a legacy block
 * (no guard) is replayed as written, its claim too.
 */
export function keyClashes(chat) {
    const found = [];
    const list = carriers(chat);
    const memo = new Map();
    for (let n = 1; n < list.length; n++) {
        const index = list[n];
        const record = readRecord(chat[index]);
        let state = rebuildAt(chat, list[n - 1], memo).state;
        if (!record || !state) continue;
        for (const { ops, span } of blocks(record)) {
            const wrote = new Set();
            for (const op of ops) {
                if (op?.op !== 'add' || typeof op.path !== 'string' || !op.path.startsWith('/')) continue;
                const keys = op.path.slice(1).split('/').map(unescape);
                const kind = keyKind(keys);
                const held = kind && !wrote.has(op.path) ? at(state, keys) : undefined;
                if (held !== undefined && (kind === 'claim' || JSON.stringify(held) !== JSON.stringify(op.value))) found.push({ index, kind, path: op.path, held, value: op.value, guarded: Boolean(span?.id) });
                wrote.add(op.path);
            }
            // (a block that does not apply is skipped, as the rebuild skips it)
            try { state = strictApply(state, ops); } catch { /* skipped */ }
        }
    }
    return found;
}
