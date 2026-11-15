/* NPC State Delta dossier sections part: the notes blocks shown inside other sections: lies told and what this person knows about others. */
import { escapeHtml } from '../src/util/html.js';
import { storyDayText } from '../calendar.js';
import { subhead } from './shared-section-bits.js';

const dayText = day => storyDayText(day);   // the story's calendar date; '' without one (never the raw day counter)
const part = (label, kind, body) => (body ? `<section class="delta-notes-block" data-notes="${kind}">${subhead(label)}${body}</section>` : '');

// Lies told (in With {{user}}, after the dynamic): a caught lie in its words; lies not caught only as a count (never the words). Hidden when there are none.
export function liesHtml(lies = []) {
    const caught = lies.filter(lie => !lie.hidden);
    const hidden = lies.length - caught.length;
    const rows = caught.map(lie => `<p class="delta-note-row"><b>“${escapeHtml(lie.said)}”</b><span>to ${escapeHtml(lie.to)}${dayText(lie.day) ? ` · ${dayText(lie.day)}` : ''} · caught</span></p>`).join('');
    const count = hidden ? `<p class="delta-note-row"><b>${hidden === 1 ? 'a lie you have not caught' : `${hidden} lies you have not caught`}</b></p>` : '';
    return part('Lies told', 'lies', rows + count);
}

// What this person knows about others (in Secrets, after the list): only what the story told or opened (a secret not opened is not in the projection).
export function knowsHtml(knows = []) {
    return part('Knows about others', 'knows', knows.map(row => `<p class="delta-note-row"><b>${escapeHtml(row.text)}</b><span>${escapeHtml([row.how && `${row.how} it`, dayText(row.day)].filter(Boolean).join(' · '))}</span></p>`).join(''));
}
