/* NPC State Delta dossier surface: sorting and filtering the dossier index and choosing the selected dossier. */
import { plain } from '../dossier-ui-model.js';

export function sortDossierIndex(rows = []) {
    const bucketRank = { active: 0, archived: 1, dead: 2 };
    return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => (
        Number(Boolean(b?.present)) - Number(Boolean(a?.present))
        || Number(Boolean(b?.worldActive)) - Number(Boolean(a?.worldActive))
        || (bucketRank[a?.bucket] ?? 9) - (bucketRank[b?.bucket] ?? 9)
        || String(a?.name || '').localeCompare(String(b?.name || ''))
    ));
}

// The dead stay out of the list: a search finds them, and the selected dossier (for example one
// opened from a chat card) stays visible while it is selected.
export function filterDossierIndex(rows = [], { query = '', filter = 'all', keepId = '' } = {}) {
    const needle = plain(query).toLocaleLowerCase();
    const mode = ['all', 'active', 'archived'].includes(filter) ? filter : 'all';
    const keep = plain(keepId);
    return sortDossierIndex(rows).filter(row => {
        if (row?.bucket === 'dead') {
            if (keep && row.id === keep) return true;
            if (!needle) return false;
        } else if (mode !== 'all' && row?.bucket !== mode) return false;
        if (!needle) return true;
        return [
            row?.name,
            row?.role,
            row?.species,
            row?.gender,
            row?.apparentAge,
            row?.homeBase,
            row?.location,
            row?.status,
            row?.statusLabel,
            ...(Array.isArray(row?.aliases) ? row.aliases : []),
        ].some(value => String(value || '').toLocaleLowerCase().includes(needle));
    });
}

export function chooseDossierSelection(currentId, visibleRows = [], allRows = []) {
    const current = plain(currentId);
    const visible = Array.isArray(visibleRows) ? visibleRows : [];
    const all = Array.isArray(allRows) ? allRows : [];
    if (current && visible.some(row => row?.id === current)) return current;
    if (visible[0]?.id) return visible[0].id;
    if (current && all.some(row => row?.id === current)) return current;
    return all[0]?.id || '';
}
