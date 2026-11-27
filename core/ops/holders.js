// Rule (i): a keyed holder a domain names (`holders`, SPEC §2.2) is remade on replay when a later block writes under an entry only a
// deleted reply had made, and replayed writes inside its entries are fitted to what is there. Pure.
//
// A domain may name maps of keyed holders (`holders: { 'bonds/npcs': make }`, the people's per-person meter records): every
// entry is made whole by the first reply that writes it, and every later write of it is a leaf change under it. When that first
// reply is deleted, a replayed block that writes under the entry would fail whole. Instead, an add or replace strictly under an
// entry that is not there (the map is, and no earlier op of the block wrote the entry) first finds the entry as `make(key, slice)`
// (the domain's slice before the block; a value that is not an object leaves the block as written, so it fails as before), and
// the block's ops inside an entry that is there (or remade) are fitted, since a part of it only a deleted reply made may be gone
// too (a later reply's leaf under the entry's `turn` or `impactDay`): the objects on the way are made ({}, or [] for an append), a `replace` of
// something not there becomes an `add` (a counted one, `was`, adds its change alone, as rule (a) counts from 0), and a `remove` of
// something not there is passed over. Ops marked `within` (rule d) are left to rule (d). Never for a live command.

import { escapeKey, parsePath, valueAt } from './paths.js';
import { clone, isPlainObject } from './json.js';

// The entry `path` lies strictly under: { root, map, key } for /domains/<name>/<map…>/<key>/<more…>, else null.
function entryOf(keys, holdersOf) {
    if (keys[0] !== 'domains' || keys.length < 4 || typeof holdersOf !== 'function') return null;
    const holders = holdersOf(keys[1]);
    if (!isPlainObject(holders)) return null;
    for (const [map, make] of Object.entries(holders)) {
        const parts = map.split('/');
        if (typeof make !== 'function' || keys.length < parts.length + 4) continue;
        if (!parts.every((part, n) => keys[2 + n] === part)) continue;
        const above = `/domains/${[keys[1], ...parts].map(escapeKey).join('/')}`;
        return { name: keys[1], map: above, key: keys[2 + parts.length], root: `${above}/${escapeKey(keys[2 + parts.length])}`, make };
    }
    return null;
}

/**
 * The block `ops` replayed onto `state` with rule (i): { made, ops }, where `made` are the `add` ops that put each remade entry
 * there (to apply first) and `ops` the block with its writes inside a remade entry fitted. `holdersOf`: a domain name → its
 * `holders` map, or null. Ops are not changed in place.
 */
export function remakeHolders(state, ops, holdersOf) {
    // A domain's holders are looked up once a block (the registry hands out a copy each time).
    const known = new Map();
    const lookup = name => { if (!known.has(name)) known.set(name, holdersOf(name)); return known.get(name); };
    const made = [];
    const shadows = new Map();   // remade entry root → what it holds as the block goes (a copy)
    const written = [];
    const out = [];
    for (const op of ops) {
        let keys = null;
        try { keys = typeof op?.path === 'string' ? parsePath(op.path) : null; } catch { keys = null; }
        const entry = keys && typeof op.within !== 'string' ? entryOf(keys, lookup) : null;
        if (entry && !shadows.has(entry.root) && (op.op === 'add' || op.op === 'replace')
            && !written.some(at => entry.root === at || entry.root.startsWith(`${at}/`))
            && isPlainObject(valueAt(state, entry.map)) && valueAt(state, entry.root) === undefined) {
            const value = entry.make(entry.key, clone(valueAt(state, `/domains/${escapeKey(entry.name)}`)));
            if (isPlainObject(value)) {
                shadows.set(entry.root, clone(value));
                made.push({ op: 'add', path: entry.root, value: clone(value) });
            }
        }
        // An entry that is there (or was remade above) and that no earlier op of the block wrote whole: its writes are fitted.
        if (entry && !shadows.has(entry.root) && !written.some(at => entry.root === at || entry.root.startsWith(`${at}/`)) && isPlainObject(valueAt(state, entry.root))) {
            shadows.set(entry.root, clone(valueAt(state, entry.root)));
        }
        if (entry && shadows.has(entry.root) && !written.some(at => entry.root === at || entry.root.startsWith(`${at}/`))) out.push(...fitted(shadows, entry.root, op, keys.slice(parsePath(entry.root).length)));
        else out.push(op);
        if ((op?.op === 'add' || op?.op === 'replace') && typeof op.path === 'string') written.push(op.path);
    }
    return { made, ops: out };
}

// One op inside a remade entry, fitted to what the entry holds (`rest`: the keys below the entry's root); the shadow follows it.
function fitted(shadows, root, op, rest) {
    const holder = { v: shadows.get(root) };
    const keep = () => shadows.set(root, holder.v);
    let node = holder.v;
    let at = root;
    const out = [];
    for (let n = 0; n < rest.length - 1; n++) {
        const key = rest[n];
        if (Array.isArray(node)) return [op];   // a list position on the way: as written
        if (!isPlainObject(node)) return [op];
        if (node[key] === undefined) {
            if (op.op === 'remove') return [];   // a remove of something not there is passed over
            node[key] = rest[n + 1] === '-' && n + 1 === rest.length - 1 ? [] : {};
            out.push({ op: 'add', path: `${at}/${escapeKey(key)}`, value: clone(node[key]) });
        }
        node = node[key];
        at = `${at}/${escapeKey(key)}`;
    }
    const last = rest.at(-1);
    if (Array.isArray(node)) {
        if (op.op === 'add' && last === '-') node.push(clone(op.value));
        else return [...out, op];   // a position in a list: as written (the shadow no longer follows it)
        keep();
        return [...out, op];
    }
    if (!isPlainObject(node)) return [...out, op];
    if (op.op === 'remove') {
        if (!Object.hasOwn(node, last)) return out;
        delete node[last];
        keep();
        return [...out, op];
    }
    const absent = !Object.hasOwn(node, last);
    const counted = op.op === 'replace' && typeof op.was === 'number' && typeof op.value === 'number';
    const put = absent && op.op === 'replace' ? { op: 'add', path: op.path, value: counted ? op.value - op.was : op.value } : op;
    node[last] = clone(put.value);
    keep();
    return [...out, put];
}
