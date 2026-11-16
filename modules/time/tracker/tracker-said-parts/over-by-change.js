// Determining whether a `~` or `!` op means a quest or job is over.

import { FAILED, OVER_VALUE, QUEST_OVER_TEXT } from './over-patterns.js';
import { QUEST_OVER_FIELDS, overStep } from './over-checks.js';
import { isJob, takesOnQuest } from './job-state.js';

// The labels such a value comes under: any record's status or outcome, and a quest's step or now.
const OVER_LABELS = ['status', 'state', 'outcome', 'result', 'progress'];

/** What a `~` (or a quest's `!`) says when it means the record is over, or null. */
export function overByChange(record, op) {
    if (op.op === '!') {
        // (0.9.27) An offer too, when the story says the job is done ("skins turned in"): what
        // happens to an offer that is not the reader's ("the bandits withdrew") is only news.
        if (record.kind !== 'quest' && !isJob(record)) return null;
        const said = [op.reason, ...Object.values(op.fields ?? {}), ...Object.values(op.extra ?? {})].map(value => String(value ?? '')).join(' ');
        return QUEST_OVER_TEXT.test(said) || (record.kind === 'quest' && FAILED.test(said)) ? (op.reason || said).trim() : null;
    }
    for (const label of OVER_LABELS) {
        const value = String(op.extra?.[label] ?? '').trim();
        if (OVER_VALUE.test(value)) return value;
    }
    if (record.kind === 'quest' || isJob(record) || takesOnQuest(record, op)) {
        for (const field of QUEST_OVER_FIELDS) {
            const value = String(op.fields?.[field] ?? '').trim();
            if (OVER_VALUE.test(value) || overStep(value, op)) return value;
        }
    }
    return null;
}
