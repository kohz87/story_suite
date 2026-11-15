/* NPC State Delta dossier surface: plain list and paragraph markup. */
import { escapeHtml } from '../src/util/html.js';
import { plain } from '../dossier-ui-model.js';

function listHtml(items, empty = 'None established yet.') {
    const rows = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!rows.length) return `<p class="delta-muted">${escapeHtml(empty)}</p>`;
    return `<ul class="delta-list">${rows.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function proseHtml(value, empty = 'Unknown') {
    const text = plain(value);
    return `<p${text ? '' : ' class="delta-muted"'}>${escapeHtml(text || empty)}</p>`;
}

export { listHtml, proseHtml };
