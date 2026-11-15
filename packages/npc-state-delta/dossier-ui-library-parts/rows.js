/* NPC State Delta dossier surface: which rows the library shows, in what order, and the cache key for them. */
import { filterDossierIndex } from '../dossier-ui-catalog.js';
import { portraitMark } from '../dossier-ui-html.js';

// Key people first. A stable partition: the sort order inside each group is kept.
export function keyFirstRows(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    return [...list.filter(row => row?.key === true), ...list.filter(row => row?.key !== true)];
}

// What the library shows: the same search and filter as before (the dead only by search, or while
// selected), then key people first.
export function libraryRows(index = [], { query = '', filter = 'all', keepId = '' } = {}) {
    return keyFirstRows(filterDossierIndex(index, { query, filter, keepId }));
}

// Cache key for the library: a face changes only when one of these fields, its ring or its
// selection changes. Include the portrait mark so a new portrait re-draws.
export function librarySignature(rows = [], { selectedId = '', refs = null } = {}) {
    return JSON.stringify((Array.isArray(rows) ? rows : []).map(row => [
        row.id, row.name, row.statusLabel, row.role, row.species, row.gender, row.bucket,
        row.key === true, row.mood || '', row.tone || '', portraitMark(row.portrait, refs), row.id === selectedId,
    ]));
}
