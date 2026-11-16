/* NPC State Delta dossier surface: the library foot bar, its static count and the search box. */
import { escapeHtml } from '../../util/html.js';

// The bar under every other screen: it goes back to the library ("▸ DOSSIER LIBRARY · 10 NPCs").
export function libraryFootHtml(count = 0) {
    return `<button type="button" class="delta-library-foot" data-delta-screen="library">▸ Dossier library · ${Number(count) || 0} NPC${Number(count) === 1 ? '' : 's'}</button>`;
}

// On the library itself the same bar is a plain count (there is nowhere to go back to), so every screen ends in the same strip.
export function libraryCountHtml(count = 0) {
    return `<div class="delta-library-foot" data-static="true">▸ Dossier library · ${Number(count) || 0} NPC${Number(count) === 1 ? '' : 's'}</div>`;
}

export function librarySearchHtml(query = '', count = 0) {
    return `<label class="delta-library-search"><span aria-hidden="true">⌕</span><input type="search" data-delta-library-search placeholder="Search ${Number(count) > 0 ? `${Number(count)} people` : 'people'}…" aria-label="Search dossiers" autocomplete="off" value="${escapeHtml(String(query || ''))}"></label>`;
}
