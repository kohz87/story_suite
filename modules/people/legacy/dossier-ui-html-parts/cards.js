/* NPC State Delta dossier surface: the current-value card and the birthday card. */
import { escapeHtml } from '../../util/html.js';
import { plain } from '../dossier-ui-model.js';
import { changedMark } from './change-marks.js';

function currentCard(label, value, fallback = 'Unknown', mark = '', from = '') {
    return `<div class="delta-current-card${mark ? ' delta-changed' : ''}"><b>${escapeHtml(label)}${mark}</b><span>${escapeHtml(plain(value, fallback))}${from ? `<em class="delta-from">${escapeHtml(from)}</em>` : ''}</span></div>`;
}

function birthdayCard(npc) {
    // (a generated birthday shows no source line: "deterministic fallback" is internal wording, not something to read on the profile)
    const source = npc.birthdaySource === 'established' ? 'Story established' : '';
    return `<div class="delta-current-card delta-continuity-birthday-card"><b>Birthday${changedMark(npc, 'birthDate')}</b><span>${escapeHtml(npc.birthday || 'Unknown')}${source ? `<small class="delta-continuity-source">${escapeHtml(source)}</small>` : ''}</span></div>`;   // the note sits in the value column, under the date, not in a cell of its own
}

export { currentCard, birthdayCard };
