/* NPC State Delta dossier relationship part: the rows of the "Recent changes" lists (With {{user}} and Right now's mood). */
import { escapeHtml } from '../../util/html.js';
import { changeStamp, RELATIONSHIP_AXES } from '../dossier-ui-model.js';
import { gateWords } from '../dossier-ui-view-model.js';
import { impactLabel } from './shared-impact.js';

// One row of the With {{user}} "Recent changes" list: the date and reply number on the left, the change in its good / bad
// colour (tension rising is bad) over a muted "via ..." line on the right. `change` is the latest change (the projection's
// lastRelationshipChange, with the signed numbers and, when hosted, the event's gate and date); `event` is an earlier one from the stored
// history, which keeps only its tier, the axes it had evidence for and its reason (no signed numbers, no calendar date).
// Said plainly when nothing recorded why a change happened (a scan's row with no reason, a story line without one).
export const NO_REASON = 'no reason given';

export function recentChangeRowHtml({ change = null, event = null, entry = null } = {}) {
    if (entry) return meterEntryRowHtml(entry);
    const source = change || event;
    const stamp = changeStamp(source || {});
    const hosted = change?.hosted ? change.event : null;
    const when = [hosted?.date, stamp.mark].filter(Boolean);
    const whenHtml = when.length ? `<span class="delta-chg-when">${when.map((part, index) => (index ? `<small>${escapeHtml(part)}</small>` : escapeHtml(part))).join('<br>')}</span>` : '<span class="delta-chg-when"></span>';
    let head = '';
    let lines = [];
    if (change) {
        head = hosted?.held ? '<span class="delta-chg-d" data-good="muted">Held</span>' : RELATIONSHIP_AXES
            .filter(([axis]) => change.delta?.[axis])
            .map(([axis, label]) => {
                const value = change.delta[axis];
                const good = axis === 'tension' ? value < 0 : value > 0;
                return `<span class="delta-chg-d" data-good="${good ? 'yes' : 'no'}">${escapeHtml(label)} ${value > 0 ? '+' : '−'}${Math.abs(value)}</span>`;
            }).join(' · ') || '<span class="delta-chg-d" data-good="muted">Progress only</span>';
        // as the mockup: how it came about and why on ONE muted line ("via help — Astra helped her cover up")
        lines = [[hosted?.held ? `Held: ${hosted.note || 'the day\'s allowance is used'}` : gateWords(hosted?.gate, { row: true }), change.reason || NO_REASON].filter(Boolean).join(' — ')];
    } else {
        head = `<span class="delta-chg-d" data-good="muted">${escapeHtml((event.axes || []).length ? event.axes.join(' · ') : impactLabel(event.impact))}</span>`;
        lines = [event.reason || NO_REASON];
    }
    return changeRowHtml(whenHtml, head, lines);
}

// One earlier reply's meter change from the meters' own log (the last three, newest first): the date and reply on the left, the signed amounts
// (or, for a text from before amounts were kept, the axes it asked) over the reason. A held one says so.
function meterEntryRowHtml(entry) {
    const stamp = [entry.date, Number.isInteger(entry.n) ? `#${entry.n}` : ''].filter(Boolean);
    const whenHtml = `<span class="delta-chg-when">${stamp.map((part, index) => (index ? `<small>${escapeHtml(part)}</small>` : escapeHtml(part))).join('<br>')}</span>`;
    const moved = RELATIONSHIP_AXES.filter(([axis]) => entry.mv?.[axis]).map(([axis, label]) => {
        const value = entry.mv[axis];
        const good = axis === 'tension' ? value < 0 : value > 0;
        return `<span class="delta-chg-d" data-good="${good ? 'yes' : 'no'}">${escapeHtml(label)} ${value > 0 ? '+' : '−'}${Math.abs(value)}</span>`;
    }).join(' · ');
    const asked = RELATIONSHIP_AXES.filter(([axis]) => entry.ask?.[axis]).map(([, label]) => label).join(' · ');
    const head = entry.held ? '<span class="delta-chg-d" data-good="muted">Held</span>' : moved || `<span class="delta-chg-d" data-good="muted">${escapeHtml(asked || 'Progress only')}</span>`;
    return changeRowHtml(whenHtml, head, [[entry.held ? `Held: ${entry.note || 'the day\'s allowance is used'}` : '', entry.why || NO_REASON].filter(Boolean).join(' — ')]);
}

// The row both Recent changes lists share (With {{user}} and Right now's mood): the date and reply on the left, the change over its muted reason on the right.
export function changeRowHtml(whenHtml, head, lines) {
    const via = lines.filter(Boolean).map(line => `<div class="delta-chg-via">${escapeHtml(line)}</div>`).join('');
    return `<li class="delta-chg">${whenHtml}<div><b>${head}</b>${via}</div></li>`;
}
