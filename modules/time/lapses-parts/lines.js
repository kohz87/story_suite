// Story Director: formatting and reading back lapse closing lines.
import { LAPSED_REASON, SLIPPED_REASON } from './constants.js';

/** The change lines that close them: "- Key — slipped", "- Key — offer lapsed". */
export function lapseLines({ slipped = [], lapsed = [] } = {}) {
    return [
        ...slipped.map(record => `- ${record.key} — ${SLIPPED_REASON}`),
        ...lapsed.map(record => `- ${record.key} — ${LAPSED_REASON}`),
    ];
}

/**
 * What the reply at `message` closed this way, for the next note: `{ slipped, lapsed }`, each
 * `[{ key, on, giver }]` plain copies (`on` the beat's date as written, `giver` the offer's).
 * Read by reason, so the story's own `- Key — slipped` counts too.
 */
export function lapsesIn(tracker, message) {
    const at = Number(message);
    const out = { slipped: [], lapsed: [] };
    if (!Number.isInteger(at)) return out;
    const reason = record => String(record.resolved?.reason ?? '').trim().toLowerCase();
    const text = value => String(value ?? '').trim();
    for (const record of tracker?.records ?? []) {
        if (record?.status !== 'resolved' || record.resolved?.message !== at) continue;
        if (record.kind === 'beat' && reason(record) === SLIPPED_REASON) {
            out.slipped.push({ key: record.key, on: text(record.fields?.on) || text(record.fields?.due), giver: '' });
        } else if (record.kind !== 'quest' && reason(record) === LAPSED_REASON) {
            out.lapsed.push({ key: record.key, on: '', giver: text(record.fields?.giver) });
        }
    }
    return out;
}
