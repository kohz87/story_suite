/* NPC State Delta dossier sections part: the With {{user}} section: the four meter bars, the dynamic, lies told and Recent changes. */
import { escapeHtml } from '../src/util/html.js';
import { plain, relationshipValue, RELATIONSHIP_AXES, wholeNumber } from '../dossier-ui-model.js';
import { recentChangeRowHtml } from '../dossier-ui-relationship.js';
import { meterRowHtml } from '../dossier-ui-board.js';
import { subhead } from './shared-section-bits.js';
import { liesHtml } from './notes-blocks.js';

// With {{user}}: the four meters as bars that run from the centre (−100..100), the dynamic between them, the lies this person told,
// and the list of recent changes: the last one with how it came about, then the earlier ones.
export function withSectionHtml(npc = {}) {
    const lies = npc.v2Meters?.notes ? liesHtml(npc.v2Meters.notes.lies) : '';
    const rel = npc.relationship && typeof npc.relationship === 'object' ? npc.relationship : {};
    const meters = RELATIONSHIP_AXES.map(([axis, label]) => meterRowHtml({ label, value: relationshipValue(rel[axis]), range: 100, text: `${relationshipValue(rel[axis]) > 0 ? '+' : ''}${relationshipValue(rel[axis])}`, cls: `delta-sheet-${axis}` })).join('');
    const summary = plain(npc.relationshipSummary);
    // "Recent changes": the latest change first (signed numbers, via, date), then the earlier ones from the stored history (the latest's own
    // event is not repeated).
    const last = npc.lastRelationshipChange;
    const hasLast = last && last.impact !== 'none' && (last.reason || last.impact === 'manual' || last.hosted);
    // The meters' own log (the last three replies' events, newest first) comes next; the reply the latest change shows is not repeated. The stored
    // history fills what is left (a chat from before the log), never a reply already shown.
    const log = (Array.isArray(npc.recentMeterChanges) ? npc.recentMeterChanges : []).filter(entry => !(hasLast && last.hosted && wholeNumber(last.message) !== null && entry.n === wholeNumber(last.message)));
    const shown = new Set([...(hasLast ? [wholeNumber(last.message)] : []), ...log.map(entry => entry.n)].filter(number => number !== null));
    const earlier = (Array.isArray(npc.recentRelationshipChanges) ? npc.recentRelationshipChanges : [])
        .filter((event, index) => !(hasLast && ((index === 0 && last.reason && event.reason === last.reason) || (last.hosted && wholeNumber(event.message) !== null && wholeNumber(event.message) === wholeNumber(last.message)))))
        .filter(event => !shown.has(wholeNumber(event.message)))
        .slice(0, 3);
    // At most the last three, the latest change counted among them.
    const rows = [...(hasLast ? [recentChangeRowHtml({ change: last })] : []), ...log.map(entry => recentChangeRowHtml({ entry })), ...earlier.map(event => recentChangeRowHtml({ event }))].slice(0, 3).join('');
    return `<div class="delta-sheet">
        <div class="delta-sheet-meters">${meters}</div>
        ${summary ? `<p class="delta-sheet-prose">${escapeHtml(summary)}</p>` : ''}
        ${lies}
        <div class="delta-sheet-recent">${subhead('Recent changes')}${rows ? `<ul class="delta-list">${rows}</ul>` : '<p class="delta-muted">No relationship change recorded yet.</p>'}</div>
    </div>`;
}
