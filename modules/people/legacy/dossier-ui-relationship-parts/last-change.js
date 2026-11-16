/* NPC State Delta dossier relationship part: the "Last relationship change" block and the "Earlier changes" history list. */
import { escapeHtml } from '../../util/html.js';
import { changeStamp, RELATIONSHIP_AXES, stampHtml, wholeNumber } from '../dossier-ui-model.js';
import { impactLabel } from './shared-impact.js';

export function lastRelationshipChangeHtml(change) {
    if (!change || change.impact === 'none' || (!change.reason && change.impact !== 'manual' && !change.hosted)) {
        return `<div class="delta-rel-last"><h4>Last relationship change</h4><p class="delta-muted">No relationship change recorded yet.</p></div>`;
    }
    const deltas = RELATIONSHIP_AXES
        .filter(([axis]) => change.delta[axis] !== 0)
        .map(([axis, label]) => {
            const value = change.delta[axis];
            const good = axis === 'tension' ? value < 0 : value > 0;   // tension rising reads as bad, like the ▲/▼ beside the meter
            return `<span class="delta-rel-delta delta-rel-delta-${good ? 'up' : 'down'} delta-rel-${escapeHtml(axis)}">${escapeHtml(label)} ${value > 0 ? '+' : ''}${value}</span>`;
        })
        .join('');
    const event = change.hosted ? change.event : null;
    const tier = change.hosted ? (event ? event.tier : '') : change.impact;
    const stamp = changeStamp(change);
    const asked = event?.held ? RELATIONSHIP_AXES.filter(([axis]) => event.ask?.[axis]).map(([axis, label]) => `${label} ${event.ask[axis] > 0 ? '+' : ''}${event.ask[axis]}`).join(', ') : '';
    return `<div class="delta-rel-last">
        <div class="delta-rel-last-head"><h4>Last relationship change</h4>${tier ? `<span class="delta-rel-impact delta-rel-impact-${escapeHtml(tier)}">${escapeHtml(impactLabel(tier))}</span>` : ''}${stampHtml(event?.date && stamp.label ? { ...stamp, label: `${stamp.label} · ${event.date}` } : stamp)}</div>
        ${event?.held ? `<p class="delta-rel-held">Held: ${escapeHtml(event.note || 'the day\'s allowance is used')}. Nothing moved.</p>${asked ? `<p class="delta-muted delta-rel-asked">Asked: ${escapeHtml(asked)}</p>` : ''}`
        : `<div class="delta-rel-deltas">${deltas || '<span class="delta-rel-delta delta-rel-delta-progress">Progress only · no point change</span>'}</div>`}
        ${event?.gate ? `<p class="delta-rel-gate">${escapeHtml(event.gate)}</p>` : ''}
        ${change.reason ? `<p>${escapeHtml(change.reason)}</p>` : ''}
    </div>`;
}

export function relationshipHistoryHtml(history, latest) {
    const rows = (Array.isArray(history) ? history : [])
        .filter((event, index) => !(index === 0 && latest?.reason && event.reason === latest.reason))
        .filter(event => !(latest?.hosted && wholeNumber(event.message) !== null && wholeNumber(event.message) === wholeNumber(latest.message)))   // the net change shown above is this reply's event
        .slice(0, 3);
    if (!rows.length) return '';
    return `<div class="delta-rel-history"><h4>Earlier changes</h4><ul class="delta-list">${rows.map(event => `<li><span class="delta-rel-impact delta-rel-impact-${escapeHtml(event.impact)}">${escapeHtml(impactLabel(event.impact))}</span>${changeStamp(event).label ? ` ${stampHtml(changeStamp(event), 'small', 'delta-muted')}` : ''} ${escapeHtml(event.reason)}</li>`).join('')}</ul></div>`;
}
