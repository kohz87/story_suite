/* NPC State Delta dossier surface: the changed-field mark and the latest-change summary line. */
import { escapeHtml } from '../../util/html.js';
import { changeStamp, FIELD_CHANGE_LABELS, wholeNumber } from '../dossier-ui-model.js';

function changedMark(npc, field) {
    const changes = npc?.fieldChanges;
    if (!changes?.latest?.includes(field)) return '';
    const stamp = changeStamp({ turn: changes.latestTurn, message: changes.message });
    return ` <em class="delta-changed-mark${stamp.legacy ? ' delta-legacy-turn' : ''}" title="${escapeHtml(stamp.title)}">• ${escapeHtml(stamp.mark)}</em>`;
}

export function changeSummaryHtml(npc, current = {}) {
    const changes = npc?.fieldChanges;
    if (!changes || changes.latestTurn === null) return '';
    const stamp = changeStamp({ turn: changes.latestTurn, message: changes.message });
    let when = `<span class="delta-legacy-turn" title="${escapeHtml(stamp.title)}">${escapeHtml(stamp.text)}</span>`;
    if (!stamp.legacy) when = stamp.message === wholeNumber(current?.reply) ? 'this reply' : `at ${escapeHtml(stamp.text)}`;
    const labels = changes.latest.map(field => FIELD_CHANGE_LABELS[field]).filter(Boolean);
    return `<p class="delta-change-line"><span class="delta-changed-dot" aria-hidden="true">•</span> Updated ${when} · ${labels.length} field${labels.length === 1 ? '' : 's'} changed${labels.length ? `: ${escapeHtml(labels.join(', '))}` : ''}</p>`;
}

export { changedMark };
