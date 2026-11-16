// Reading the stored drives leaf and writing changes over it.
import { DRIVES_TEXT_MAX } from './shared-limits.js';
import { KEYS, isStrength, defaults } from './shared-strength.js';
import { serialize, validExtras, readExtras } from './extras.js';
import { seedDetail } from './seed.js';

// A stored leaf: absent (undefined, null, '') reads as the defaults; a present leaf must be a JSON object of known keys with
// whole-number strengths 0..3 (missing keys take the default). Anything else is null, so the validator can reject the command.
export function readDrives(leaf) {
    if (leaf === undefined || leaf === null || leaf === '') return defaults();
    if (typeof leaf !== 'string' || leaf.length > DRIVES_TEXT_MAX) return null;
    let parsed;
    try { parsed = JSON.parse(leaf); } catch { return null; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const out = defaults();
    if (Object.hasOwn(parsed, 'x') && !validExtras(parsed.x)) return null;
    for (const key of Object.keys(parsed)) {
        if (key === 'x') continue;
        if (!KEYS.has(key) || !isStrength(parsed[key])) return null;
        out[key] = parsed[key];
    }
    return out;
}

// Writes the changes ({ key: strength }) over the stored leaf and returns the new leaf text (keys always in DRIVES order), or
// null when a change is unknown or not a strength, or the stored leaf is unusable. The seed (`{ pack, description }`) is used
// only when there is no stored leaf yet, so a later write never reseeds.
export function setDrives(leaf, changes, seed) {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return null;
    const hasLeaf = leaf !== undefined && leaf !== null && leaf !== '';
    const seeded = hasLeaf ? null : seedDetail(seed?.pack, seed?.description);
    const base = hasLeaf ? readDrives(leaf) : seeded.out;
    if (!base) return null;
    const extras = hasLeaf ? readExtras(leaf) : seeded.extras;
    const next = { ...base };
    for (const key of Object.keys(changes)) {
        if (!KEYS.has(key) || !isStrength(changes[key])) return null;
        if (next[key] !== changes[key]) delete extras[key];   // a hand-set value has no source or pending evidence
        next[key] = changes[key];
    }
    return serialize(next, extras);
}
