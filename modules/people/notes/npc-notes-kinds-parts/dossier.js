// What the dossier shows of a record's notes, as plain rows.
import { lieRows } from '../npc-notes-lies.js';
import { knowsView } from '../npc-notes-knows.js';
import { readTastes } from '../npc-notes-tastes.js';
import { readTies } from '../npc-notes-ties.js';
import { readDrives, driveRows } from '../npc-notes-drives.js';
import { readLookStamp } from '../npc-notes-look.js';
import { tieRows } from './ties.js';

/**
 * What the dossier shows of a record's notes: { lies, knows, tastes, ties, drives, look } as plain rows (`look`: the locked-look stamp { day, r } or null). A lie the story has not caught and a
 * secret it has not told are redacted (no words of them) unless `show`; `bonds` are the person's bond strings (ties rows follow them).
 */
export function dossierNotes(record, { bonds = null, show = false } = {}) {
    const source = record && typeof record === 'object' ? record : {};
    return {
        lies: lieRows(source.lies, { redact: !show }),
        knows: knowsView(source.knows ?? '', { show }),
        tastes: readTastes(source.tastes).map(({ sign, item, from, mirrored }) => ({ sign, item, from: from ?? '', mirrored: mirrored === true })),
        ties: Array.isArray(bonds) ? tieRows(readTies(source.ties) ?? {}, bonds, []) : (readTies(source.ties) ?? {}),
        drives: driveRows(readDrives(source.drives) ?? undefined, source.drives),
        look: readLookStamp(source.lookLockedAt),
    };
}
