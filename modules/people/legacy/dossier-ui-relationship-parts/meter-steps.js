/* NPC State Delta dossier relationship part: the relationship meter steps: the ▲/▼ beside one axis and the centre-out axis meter. */
import { escapeHtml } from '../src/util/html.js';
import { relationshipValue, wholeNumber } from '../dossier-ui-model.js';

// (1.2.15) The change the latest reply made to one axis, beside its meter: ▲3 / ▼2. Only for a change
// recorded at the latest reply (an older one is history, shown below the meters); tension rising reads
// as bad, the other axes rising as good.
export function relationshipStepHtml(axis, label, change, latestReply) {
    const reply = wholeNumber(latestReply);
    if (!change || reply === null || wholeNumber(change.message) !== reply) return '';
    const step = Math.round(Number(change.delta?.[axis]) || 0);
    if (!step) return '';
    const up = step > 0;
    const good = axis === 'tension' ? !up : up;
    const title = `${label} ${up ? 'up' : 'down'} ${Math.abs(step)} since the last reply (reply #${reply})`;
    return `<span class="delta-rel-step delta-rel-step-${good ? 'good' : 'bad'}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${up ? '▲' : '▼'}${Math.abs(step)}</span>`;
}

export function relationshipAxis(label, value, axis, change = null, latestReply = null) {
    const score = relationshipValue(value);
    const position = Math.max(0, Math.min(100, (score + 100) / 2));
    return `<div class="delta-rel-axis delta-rel-${escapeHtml(axis)}">
        <div class="delta-rel-label"><span>${escapeHtml(label)}</span><b>${score > 0 ? '+' : ''}${score}${relationshipStepHtml(axis, label, change, latestReply)}</b></div>
        <div class="delta-rel-track" aria-label="${escapeHtml(label)} ${score}"><span class="delta-rel-zero"></span><i style="left:${position}%"></i></div>
    </div>`;
}
