/* NPC State Delta: whether a queued backfill still applies to its NPC and chat roster. */
import { text } from './shared-text.js';
import { npcParticipatesInExchange } from './participation.js';
import { normalizeAutomaticBackfillRequest } from './backfill-queue.js';
import { isTerminalNpcDeath } from '../../core/terminal-lifecycle.js';

/**
 * A queued backfill is meaningful only while its target is still an active
 * member of the owning chat roster. Automatic backfill relevance is checked
 * by the caller so manual repair remains available even when the NPC is not
 * in the newest exchange.
 */
export function backfillNeedsRequest(target, roster = []) {
    if (!target || typeof target !== 'object' || target.archived === true || isTerminalNpcDeath(target)) return false;
    const source = Array.isArray(roster) ? roster : [];
    const id = text(target.id);
    if (id) return source.some(item => text(item?.id) === id && item?.archived !== true && !isTerminalNpcDeath(item));
    return source.includes(target);
}

export function automaticBackfillStillRelevant(request, target, roster = [], owningExchange = '') {
    const normalized = normalizeAutomaticBackfillRequest(request);
    if (!normalized || !backfillNeedsRequest(target, roster)) return false;
    if (normalized.reason === 'new-admission' || normalized.reason === 'new-person') return true;
    if (normalized.reason === 'missed-participant') {
        return npcParticipatesInExchange(target, roster, owningExchange, { includeRole: false });
    }
    return false;
}
