// A cast pack entry's tastes and drives as the record's first leaves.
import { readTastes, tastesText } from '../npc-notes-tastes.js';
import { setDrives } from '../npc-notes-drives.js';

/** The pack entry's (cast-dossier normalizeEntry) tastes and drives as the record's first leaves: { tastes?, drives? } (nothing for a default). */
export function seedNotes(entry) {
    const out = {};
    const rows = (Array.isArray(entry?.tastes) ? entry.tastes : []).map(({ sign, item, from }) => ({ sign, item, from, day: 0, r: 'pack' }));
    const tastes = rows.length ? tastesText(readTastes(rows)) : '';
    if (tastes) out.tastes = tastes;
    const drives = setDrives('', {}, { pack: { drives: entry?.drives }, description: `${entry?.personality ?? ''} ${entry?.about ?? ''}` });
    if (drives && drives !== setDrives('', {}, {})) out.drives = drives;
    return out;
}
