// Checking the stored note leaves of one record.
import { readLies } from '../npc-notes-lies.js';
import { readKnows, KNOWS_MAX, KNOWS_TEXT_MAX } from '../npc-notes-knows.js';
import { readTastes, TASTE_LIMITS } from '../npc-notes-tastes.js';
import { readTies } from '../npc-notes-ties.js';
import { readDrives } from '../npc-notes-drives.js';
import { readLookStamp } from '../npc-notes-look.js';
import { NOTE_FIELDS } from './consts.js';

// Stored-leaf checks for validateNotes: each returns true when the leaf reads back whole (no entry dropped by the reader).
function knowsOk(text) {
    if (typeof text !== 'string' || text.length > KNOWS_TEXT_MAX) return false;
    let list;
    try { list = JSON.parse(text); } catch { return false; }
    return Array.isArray(list) && list.length <= KNOWS_MAX && readKnows(text).length === list.length;
}

function tastesOk(text) {
    if (typeof text !== 'string' || text.length > TASTE_LIMITS.text) return false;
    let list;
    try { list = JSON.parse(text); } catch { return false; }
    return Array.isArray(list) && readTastes(text, { cite: false }).length === list.length; // as stored: what main accepted stays valid
}

const CHECKS = Object.freeze({
    lies: value => readLies(value) !== null,
    knows: knowsOk,
    tastes: tastesOk,
    ties: value => readTies(value) !== null,
    drives: value => readDrives(value) !== null,
    lookLockedAt: value => readLookStamp(value) !== null,
});

/**
 * Checks the note fields of one record. An absent field (undefined, null or '') is fine. Returns '' when every present field is
 * valid, else the name of the first bad field and "is not valid." (the host refuses the whole command, as validateNpcSlice does).
 */
export function validateNotes(record) {
    if (!record || typeof record !== 'object') return '';
    for (const field of NOTE_FIELDS) {
        const value = record[field];
        if (value === undefined || value === null || value === '') continue;
        if (!CHECKS[field](value)) return `${field} is not valid.`;
    }
    return '';
}
