// A cast pack entry's tastes, drives and ties as the record's first leaves.
import { readTastes, tastesText } from '../npc-notes-tastes.js';
import { setDrives } from '../npc-notes-drives.js';
import { TIES_MAX_PEOPLE, tiesText } from '../npc-notes-ties.js';
import { npcKey } from '../../meters/npc-meters-config.js';

/** The entry's ties [{ name, tag }] as the ties leaf's text (one record for each person, at most twelve people), or '' for none. */
function tiesLeaf(rows) {
    const ties = {};
    for (const { name, tag } of Array.isArray(rows) ? rows : []) {
        const key = npcKey(name);
        if (!key || (!ties[key] && Object.keys(ties).length >= TIES_MAX_PEOPLE)) continue;
        ties[key] = [...new Set([...(ties[key] ?? []), tag])];
    }
    return tiesText(ties) ?? '';
}

/** The pack entry's (cast-dossier normalizeEntry) tastes, drives and ties as the record's first leaves: { tastes?, drives?, ties? } (nothing for a default). */
export function seedNotes(entry) {
    const out = {};
    const rows = (Array.isArray(entry?.tastes) ? entry.tastes : []).map(({ sign, item, from }) => ({ sign, item, from, day: 0, r: 'pack' }));
    const tastes = rows.length ? tastesText(readTastes(rows)) : '';
    if (tastes) out.tastes = tastes;
    const drives = setDrives('', {}, { pack: { drives: entry?.drives }, description: `${entry?.personality ?? ''} ${entry?.role ?? ''}` });
    if (drives && drives !== setDrives('', {}, {})) out.drives = drives;
    const ties = tiesLeaf(entry?.ties);
    if (ties) out.ties = ties;
    return out;
}
