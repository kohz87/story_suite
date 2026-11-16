/* NPC State Delta turning in-memory checkpoints into their packed on-disk form. */
import { PACK_SCHEME, PACK_DEFAULTS, PackError } from './pack-constants.js';
import { isObject, withKey } from './pack-shared.js';
import { applyJson } from './pack-apply.js';
import { diffImages } from './pack-diff.js';

function fullReason(info, firstOfTurn, tailFrom, anchorEvery) {
    if (info.turn === null) return 'no-turn';
    if (tailFrom !== null && info.turn >= tailFrom) return 'tail';
    if (firstOfTurn && info.turn % anchorEvery === 0) return 'anchor';
    return null;
}

// Nearest earlier non-verbatim entry of the same parent lineage, else the nearest earlier non-verbatim entry.
function findBase(infos, index) {
    const parent = infos[index].parentLineageKey;
    if (parent !== undefined && parent !== null) {
        for (let j = index - 1; j >= 0; j--) {
            if (infos[j] && infos[j].lineageKey === parent) return j;
        }
    }
    for (let j = index - 1; j >= 0; j--) {
        if (infos[j]) return j;
    }
    return -1;
}

// The JSON image of an entry's snapshot, parsed once and only when a diff needs it. A verified packed entry rebuilds to
// exactly this image (its JSON equals `text`), so it is also the base the decoder will chain from.
function imageOf(info) {
    if (info.image === undefined) info.image = JSON.parse(info.text);
    return info.image;
}

// Builds the patch and checks it the way the decoder will rebuild it. Null when it does not reproduce the
// entry's own JSON byte for byte (the entry then stays full).
function tryPatch(baseImage, info) {
    const ops = diffImages(baseImage, imageOf(info), [], []);
    let rebuiltImage;
    try {
        rebuiltImage = applyJson(baseImage, ops);
    } catch (error) {
        if (error instanceof PackError) return null;
        throw error;
    }
    if (JSON.stringify(rebuiltImage) !== info.text) return null;
    return { ops, patchText: JSON.stringify(ops) };
}

function activeLineageSet(keys) {
    if (keys === undefined || keys === null) return null;
    if (!Array.isArray(keys) && !(keys instanceof Set)) throw new PackError('activeKeys must be an array or a Set');
    const set = new Set(keys);
    return set.size ? set : null;
}

function packSettings(options) {
    const settings = { ...PACK_DEFAULTS };
    for (const key of Object.keys(PACK_DEFAULTS)) {
        if (options[key] !== undefined) settings[key] = options[key];
        if (!Number.isInteger(settings[key]) || settings[key] < 1) throw new PackError(`${key} must be a positive integer`);
    }
    return settings;
}

// Returns { entries, packing, stats }. `entries` is the on-disk checkpoint array: full entries are the original
// objects, packed entries have their `snapshot` key replaced in place by `packed: {base, patch}`. Options:
// anchorEvery, fullTail, maxChainEntries (defaults PACK_DEFAULTS) and activeKeys (the active lineage's checkpoint
// keys; empty or absent means every entry counts as active when choosing the newest reply). No cache: every packed
// entry is rebuilt and compared byte for byte on every call.
export function packCheckpoints(checkpoints, options = {}) {
    if (!Array.isArray(checkpoints)) throw new PackError('checkpoints must be an array');
    const settings = packSettings(options);
    const active = activeLineageSet(options.activeKeys);
    const infos = checkpoints.map(entry => {
        if (!isObject(entry)) return null;
        if (Object.hasOwn(entry, 'packed')) throw new PackError('checkpoint already uses the reserved "packed" key');
        if (!isObject(entry.snapshot)) return null;
        const text = JSON.stringify(entry.snapshot);
        const turn = entry.snapshot.turn;
        return {
            entry,
            text,
            image: undefined,
            turn: typeof turn === 'number' && Number.isFinite(turn) ? turn : null,
            lineageKey: entry.lineageKey,
            parentLineageKey: entry.parentLineageKey,
        };
    });
    let newest = null;
    for (const info of infos) {
        if (!info || info.turn === null) continue;
        if (active !== null && !active.has(info.lineageKey)) continue;
        newest = newest === null ? info.turn : Math.max(newest, info.turn);
    }
    const tailFrom = newest === null ? null : newest - (settings.fullTail - 1);
    const count = checkpoints.length;
    const entries = new Array(count);
    const chain = new Array(count).fill(0);
    const seenTurns = new Set();
    const stats = { entries: count, full: 0, packed: 0, verbatim: 0, reasons: {}, snapshotChars: 0, patchChars: 0 };
    const countReason = reason => {
        stats.reasons[reason] = (stats.reasons[reason] || 0) + 1;
    };
    for (let index = 0; index < count; index++) {
        const info = infos[index];
        if (!info) {
            entries[index] = checkpoints[index];
            stats.verbatim++;
            continue;
        }
        stats.snapshotChars += info.text.length;
        const firstOfTurn = info.turn !== null && !seenTurns.has(info.turn);
        if (info.turn !== null) seenTurns.add(info.turn);
        let reason = fullReason(info, firstOfTurn, tailFrom, settings.anchorEvery);
        let base = -1;
        if (!reason) {
            base = findBase(infos, index);
            if (base < 0) reason = 'no-base';
            else if (chain[base] + 1 > settings.maxChainEntries) reason = 'stall';
        }
        const patch = reason ? null : tryPatch(imageOf(infos[base]), info);
        if (!reason && !patch) reason = 'verify';
        if (!reason && patch.patchText.length >= info.text.length) reason = 'size';
        if (reason) {
            entries[index] = checkpoints[index];
            stats.full++;
            countReason(reason);
            continue;
        }
        entries[index] = withKey(info.entry, 'snapshot', 'packed', { base, patch: patch.ops });
        chain[index] = chain[base] + 1;
        stats.packed++;
        stats.patchChars += patch.patchText.length;
    }
    const packing = {
        scheme: PACK_SCHEME,
        anchorEvery: settings.anchorEvery,
        fullTail: settings.fullTail,
        maxChainEntries: settings.maxChainEntries,
    };
    return { entries, packing, stats };
}
