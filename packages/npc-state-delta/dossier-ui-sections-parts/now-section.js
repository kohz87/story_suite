/* NPC State Delta dossier sections part: the Right now section: where, doing, goal and condition, with the away and cast blocks above. */
import { escapeHtml } from '../src/util/html.js';
import { plain } from '../dossier-ui-model.js';
import { castFromHtml, keyAwayHtml } from '../dossier-ui-catalog.js';
import { subhead, updatedLineHtml } from './shared-section-bits.js';

const NOW_FIELD_WORDS = Object.freeze({ location: 'where', goal: 'goal', status: 'condition' });

// Right now: where she is, what she is doing and wants, her condition, then the line that says which of these the latest reply updated.
// The Story Director away block and the pack's cast block (with its Pin button) stay above, as they did in the old dossier.
export function nowSectionHtml(npc = {}, { reply = null } = {}) {
    const cast = npc.cast && typeof npc.cast === 'object' ? npc.cast : {};
    const rows = [
        ['Where', escapeHtml(plain(cast.where) || plain(npc.location))],
        ['Doing', escapeHtml(plain(cast.doing))],
        ['Goal', escapeHtml(plain(cast.goal) || plain(npc.goal))],
        ['Condition', escapeHtml(plain(npc.status))],
    ].filter(([, value]) => value);
    const blocks = `${npc.key ? keyAwayHtml(npc.key) : ''}${npc.cast ? castFromHtml(npc.cast) : ''}`;
    const kv = list => `<dl class="delta-kv">${list.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${value}</dd>`).join('')}</dl>`;
    return `${blocks}<div class="delta-sheet delta-now">`
        + (rows.length ? subhead('Where and what') + kv(rows) : (blocks ? '' : '<p class="delta-muted">Nothing recorded yet.</p>'))
        + updatedLineHtml(npc, reply, NOW_FIELD_WORDS)
        + '</div>';
}
