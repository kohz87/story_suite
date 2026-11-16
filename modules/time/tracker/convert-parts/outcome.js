// Story Director v2, tracker part (convert): tells how a closed v1 record ended, in v2's words.

import { questOutcome } from '../../../tracker.js';
import { text } from './shared-text.js';

const DECLINED = /\b(?:declin|refus|turned down|passed on)/i;

/** How a closed record ended, in v2's words. */
export function outcomeOf(record) {
    if (record.status === 'superseded') return 'superseded';
    const reason = text(record.resolved?.reason);
    if (DECLINED.test(reason)) return 'declined';
    return questOutcome({ kind: 'quest', status: 'resolved', resolved: { reason } }) ?? 'done';
}
