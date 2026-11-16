/* NPC State Delta dossier sections part: the sub-heading and the "Updated this reply" line several sections share. */
import { escapeHtml } from '../../util/html.js';
import { changeStamp, wholeNumber } from '../dossier-ui-model.js';

// A sub-heading inside a section (Recent changes, Pull, Lies told, Knows about others, Where and what): one class, so one CSS rule spaces them all.
export const subhead = text => `<h4 class="delta-subhead">${escapeHtml(text)}</h4>`;

// "Updated this reply (#3): where, goal." from the stored field changes; an older change reads "Updated at reply #2: ...".
// Empty when none of the latest change's fields is one this section shows.
export function updatedLineHtml(npc, reply, fieldWords) {
    const changes = npc.fieldChanges;
    if (!changes || changes.latestTurn === null) return '';
    const words = (changes.latest || []).map(field => fieldWords[field]).filter(Boolean);
    if (!words.length) return '';
    const stamp = changeStamp({ turn: changes.latestTurn, message: changes.message });
    const when = !stamp.legacy && stamp.message !== null && stamp.message === wholeNumber(reply) ? `this reply (#${stamp.message})` : `at ${stamp.text}`;
    return `<p class="delta-now-updated delta-muted">Updated ${escapeHtml(when)}: ${escapeHtml(words.join(', '))}.</p>`;
}
