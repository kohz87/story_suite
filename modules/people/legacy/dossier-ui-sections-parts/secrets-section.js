/* NPC State Delta dossier sections part: the Secrets section: opened notes in full, hidden ones only as a bar and a rule. */
import { escapeHtml } from '../../util/html.js';
import { plain } from '../dossier-ui-model.js';
import { knowsHtml } from './notes-blocks.js';

// Secrets: the hosted meters' notes (npc.v2Meters.secrets). An open note shows its title and text; a hidden note shows
// only its bar and its rule ("opens at Trust 60"), never its title or text. Same data as dossier-ui-meters.js v2SecretsHtml.
export function secretsSectionHtml(npc = {}) {
    const notes = Array.isArray(npc.v2Meters?.secrets) ? npc.v2Meters.secrets.filter(note => note && typeof note === 'object') : [];
    const knows = npc.v2Meters?.notes ? knowsHtml(npc.v2Meters.notes.knows) : '';
    if (!notes.length) return knows ? `<div class="delta-sheet">${knows}</div>` : '<p class="delta-muted">No secrets for this character yet.</p>';
    const opened = notes.filter(note => note.state === 'open').length;
    const rows = notes.map(note => (note.state === 'open'
        ? `<div class="delta-secret delta-secret-open"><div class="delta-secret-head"><b>${escapeHtml(plain(note.title))}</b><span class="delta-secret-pill">${escapeHtml(plain(note.pill))}</span></div>${plain(note.text) ? `<p>${escapeHtml(plain(note.text))}</p>` : ''}</div>`
        : `<div class="delta-secret delta-secret-hidden"><span class="delta-secret-bar" style="width:${Math.max(0, Math.min(100, Number(note.width) || 0))}%" aria-hidden="true"></span><span class="delta-secret-when">${escapeHtml(plain(note.opens))}</span></div>`)).join('');
    return `<p class="delta-muted delta-secrets-intro">${opened} opened · ${notes.length - opened} still hidden. The narrator knows them all and keeps them; each appears here when it opens.</p>
        <div class="delta-sheet delta-secrets">${rows}${knows}</div>`;
}
