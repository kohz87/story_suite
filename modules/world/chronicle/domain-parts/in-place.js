// Writes a chronicle value that later replies rewrite (the daily step's state, the world's ledger) in place, so a reply records only what it
// changed (core/ops/diff.js walks into objects) and the chat grows by the change, not by a whole copy (perf PB9, L7).
// Every entry an earlier reply made that this write changes or removes is marked `ctx.ifThere`, deepest first, and the value itself last: on replay
// after the reply that made one is deleted, the changes inside it are passed over (SPEC §2.2 rule d) and the rest of the reply still applies,
// as the conditions table is written (world-daily/command.js writeConditions). A value that is not there yet, or one kept as a slot
// (`[value]`, rpg/slot.js), is written whole once, as a plain object; readers take either form (slotValue).
// A checkpoint (`whole`) writes the value as a slot instead: a changed list is one whole `replace` (ops.js diff), so a replay after an edited
// or deleted earlier reply puts the recorded value back exactly from there on (the next plain write is whole too, then the deltas go on).

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const escape = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
const copy = value => (value === undefined ? undefined : structuredClone(value));
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

// Makes `held` equal `next` key by key; `marks` gets [depth, path] for each entry that was there and changes or goes.
function merge(held, next, path, depth, marks) {
    for (const key of Object.keys(held)) {
        if (Object.hasOwn(next, key)) continue;
        marks.push([depth, `${path}/${escape(key)}`]);
        delete held[key];
    }
    for (const key of Object.keys(next)) {
        if (!Object.hasOwn(held, key)) { held[key] = copy(next[key]); continue; }
        if (same(held[key], next[key])) continue;
        const at = `${path}/${escape(key)}`;
        if (isRecord(held[key]) && isRecord(next[key])) merge(held[key], next[key], at, depth + 1, marks);
        else held[key] = copy(next[key]);
        marks.push([depth, at]);
    }
}

/**
 * `holder[name]` (a `chronicle` draft) becomes `next` (a plain object; null takes the value away). `ctx` marks the entries an earlier reply
 * made (the chronicle's owner's command context); without one nothing is marked. `whole`: a checkpoint, written whole as a slot.
 */
export function writeInPlace(ctx, holder, name, next, { whole = false } = {}) {
    if (!isRecord(next)) {
        if (next === null && holder[name] !== undefined) holder[name] = null;
        return;
    }
    if (whole) { holder[name] = [copy(next)]; return; }
    const held = holder[name];
    if (!isRecord(held)) { holder[name] = copy(next); return; }
    const marks = [];
    merge(held, next, `/${escape(name)}`, 1, marks);
    if (typeof ctx?.ifThere !== 'function') return;
    // An op takes the first mark that holds it (commands/transact.js), so the deepest go first and the value itself last (an add of a new key
    // is held by it: passed over when the value is gone).
    marks.sort((a, b) => b[0] - a[0]);
    for (const [, path] of marks) ctx.ifThere('chronicle', path);
    ctx.ifThere('chronicle', `/${escape(name)}`);
}
