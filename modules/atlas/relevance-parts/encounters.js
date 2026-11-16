// Collects planned encounters from a relevance selection.

import { DEFAULTS } from './defaults.js';
import { isNumber, reachedBy } from './shared-dates.js';

function encounterText(record) {
    return String(record?.fields?.encounter ?? '').trim();
}

// When the fight comes: a clock fires at its due, everything else at its on. A quest's due
// is a deadline, not a fight, so a quest's fight is soon only by its on.
function fightDate(record) {
    const fields = record.fields ?? {};
    return record.kind === 'clock' ? fields.due || fields.on || '' : fields.on || '';
}

/**
 * The planned fights a Selection holds: due ones first, then arriving ones (both
 * `status: 'due'`), then relevant ones whose date falls within `dueSoonDays` (`'soon'`).
 * Each is `{ key, id, kind, encounter, place, on, status }`, `on` being the date as written.
 * Story Director never resolves a fight; it only says which ones the story has reached.
 */
export function encountersIn(selection, { calendar = null, now = null, dueSoonDays = DEFAULTS.dueSoonDays, message = null } = {}) {
    const out = [];
    const listed = new Set();
    // (0.9.18) `reached`: the reply at `message` fired the record (`! Key — …`): the scene got to
    // the fight. Due is the world's schedule; a fight the reader's character is not there for
    // happens off-screen and comes in as news, so only a reached one should become a fight.
    const reachedIn = record => isNumber(message) && (record.history ?? []).some(entry => entry?.message === message && entry?.op === '!');
    const add = (record, status, on) => {
        const encounter = encounterText(record);
        if (!encounter || listed.has(record.id)) return;
        listed.add(record.id);
        out.push({ key: record.key, id: record.id, kind: record.kind, encounter, place: String(record.fields?.place ?? '').trim(), on: String(on ?? '').trim(), status, reached: reachedIn(record) });
    };
    // A fight fired in this reply first: firing clears its date, so it may be due no longer.
    for (const record of ['due', 'arriving', 'relevant', 'dormant'].flatMap(list => (selection?.[list] ?? []).map(entry => entry?.record ?? entry))) {
        if (record && reachedIn(record)) add(record, 'due', fightDate(record) || record.fields?.due || record.fields?.on);
    }
    for (const record of selection?.due ?? []) add(record, 'due', fightDate(record) || record.fields?.due);
    for (const record of selection?.arriving ?? []) add(record, 'due', record.fields?.arrive);

    if (calendar && isNumber(now)) {
        const days = Number(dueSoonDays) >= 0 ? Number(dueSoonDays) : DEFAULTS.dueSoonDays;
        const limit = calendar.addDays(now, days);
        // The soonest first: that is the fight the story reaches next.
        const soon = [];
        for (const { record } of selection?.relevant ?? []) {
            const on = fightDate(record);
            if (!on || !encounterText(record)) continue;
            const parsed = calendar.parse(on, { reference: now });
            if (reachedBy(parsed, limit, calendar)) soon.push({ record, on, at: parsed.abs });
        }
        soon.sort((a, b) => a.at - b.at);
        for (const { record, on } of soon) add(record, 'soon', on);
    }
    return out;
}
