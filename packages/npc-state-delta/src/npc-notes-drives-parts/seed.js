// The first-time seed of the drives from a cast pack entry or the first description.
import { DRIVE_DEFAULT } from './shared-limits.js';
import { DRIVES, DRIVE_LIST_STRENGTH } from './shared-table.js';
import { isStrength, defaults } from './shared-strength.js';
import { tokensOf, hitsOf } from './cues.js';

// The first-time seed, used only when the record has no leaf yet. A cast pack entry's `drives` wins when it names any strength
// (an object keyed by kind name or short key, or a list of kind names that become DRIVE_LIST_STRENGTH). Otherwise the first
// description is scanned for the drive words (whole words, or a prefix for words of six letters or more). No hit: defaults.
export function seedDrives(pack, description) {
    return seedDetail(pack, description).out;
}

// The seed and where each non-default strength came from: { out, extras } (extras: { key: { s: 'p' | 'd', c? } }).
export function seedDetail(pack, description) {
    const out = defaults();
    const extras = {};
    const listed = pack && typeof pack === 'object' ? pack.drives : undefined;
    if (listed && typeof listed === 'object' && !Array.isArray(listed)) {
        let named = false;
        for (const drive of DRIVES) {
            const value = listed[drive.kind] ?? listed[drive.key];
            if (isStrength(value)) { out[drive.key] = value; named = true; if (value !== DRIVE_DEFAULT) extras[drive.key] = { s: 'p' }; }
        }
        if (named) return { out, extras };
    }
    if (Array.isArray(listed)) {
        const names = listed.map(item => String(item ?? '').trim().toLowerCase());
        const hits = DRIVES.filter(drive => names.includes(drive.kind));
        if (hits.length) {
            for (const drive of hits) { out[drive.key] = DRIVE_LIST_STRENGTH; extras[drive.key] = { s: 'p' }; }
            return { out, extras };
        }
    }
    // The first description: one cue word keeps a drive normal; two different cue words start it high.
    const tokens = tokensOf(description);
    for (const drive of DRIVES) {
        const hits = hitsOf(drive.words, tokens);
        if (hits.length >= 2) { out[drive.key] = DRIVE_LIST_STRENGTH; extras[drive.key] = { s: 'd', c: hits[0] }; }
    }
    return { out, extras };
}
