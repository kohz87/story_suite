/* NPC State Delta rebuilding full checkpoints from the packed on-disk form. */
import { PACK_SCHEME, PackError } from './pack-constants.js';
import { isObject, withKey } from './pack-shared.js';
import { applyJson } from './pack-apply.js';

// Inverse of packCheckpoints: one forward pass; every packed entry's base must be an earlier entry that rebuilt.
// Returns v1-shaped checkpoints (full `snapshot` in the same key position). Throws PackError, never a partial result.
export function unpackCheckpoints(entries, packing) {
    if (!Array.isArray(entries)) throw new PackError('packed checkpoints must be an array');
    if (!isObject(packing) || packing.scheme !== PACK_SCHEME) throw new PackError('unknown checkpoint packing scheme');
    const rebuilt = new Array(entries.length);
    const ready = new Array(entries.length).fill(false);
    const out = new Array(entries.length);
    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        if (!isObject(entry)) {
            out[index] = entry;
            continue;
        }
        if (!Object.hasOwn(entry, 'packed')) {
            if (isObject(entry.snapshot)) {
                rebuilt[index] = entry.snapshot;
                ready[index] = true;
            }
            out[index] = entry;
            continue;
        }
        const packed = entry.packed;
        if (Object.hasOwn(entry, 'snapshot')) throw new PackError(`checkpoint ${index} has both a snapshot and a packed form`);
        if (!isObject(packed) || !Number.isInteger(packed.base) || packed.base < 0 || packed.base >= index) {
            throw new PackError(`checkpoint ${index} has an invalid base`);
        }
        if (!ready[packed.base]) throw new PackError(`checkpoint ${index} is based on an entry without a snapshot`);
        if (!Array.isArray(packed.patch)) throw new PackError(`checkpoint ${index} has no patch array`);
        // applyJson shares unchanged parts with its base; the returned snapshot must own its data (hydration edits snapshots in place).
        const image = applyJson(rebuilt[packed.base], packed.patch);
        rebuilt[index] = image;
        ready[index] = true;
        out[index] = withKey(entry, 'packed', 'snapshot', structuredClone(image));
    }
    return out;
}
