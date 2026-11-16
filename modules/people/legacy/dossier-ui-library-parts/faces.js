/* NPC State Delta dossier surface: the library face buttons and the faces list or its empty state. */
import { escapeHtml } from '../../util/html.js';
import { portraitHtml } from '../dossier-ui-html.js';
import { faceRingVar } from './face-ring.js';

export function libraryFaceHtml(npc, { selected = false, refs = null } = {}) {
    const id = escapeHtml(npc.id);
    const line = [npc.role || npc.species].filter(Boolean).join(' · ') || 'Details pending';
    // The mood is what the person is like right now; an archived or dead dossier shows that instead.
    const state = [npc.key === true ? '★ key' : '', npc.bucket === 'active' && npc.mood ? npc.mood : npc.statusLabel].filter(Boolean).join(' · ');
    return `<button type="button" class="delta-library-face${selected ? ' selected' : ''}" role="option" aria-selected="${selected}" data-npc-id="${id}" data-bucket="${escapeHtml(npc.bucket || '')}" data-tone="${escapeHtml(npc.tone || '')}" style="--rc:${faceRingVar(npc.tone)}">
        <span class="delta-library-av">${portraitHtml(npc, 'delta-library-portrait', { alt: false, refs })}</span>
        <b>${escapeHtml(npc.name || 'Unnamed')}</b><span class="delta-library-meta">${escapeHtml(line)}</span><span class="delta-library-meta delta-library-state">${escapeHtml(state)}</span>
    </button>`;
}

// The faces, or the empty state. The caller runs refs.fill(container) after writing the markup.
export function libraryHtml(rows = [], { selectedId = '', refs = null, emptyHint = '' } = {}) {
    if (!Array.isArray(rows) || !rows.length) {
        return `<div class="delta-no-results"><b>No dossiers match this view.</b><span>${escapeHtml(emptyHint || 'Change the search or filter to bring the cast back.')}</span></div>`;
    }
    return `<div class="delta-library-faces" role="listbox" aria-label="Dossiers">${rows.map(npc => libraryFaceHtml(npc, { selected: npc.id === selectedId, refs })).join('')}</div>`;
}
