// Story Director v2, tracker part (scene): splits relevant threads into what fits the scene and the rest.

import { lineKey } from '../../../world/changes.js';
import { looksFinished, waitsForPay } from '../tracker.js';
import { MIN_NAME } from './shared-limits.js';
import { flat, normalize } from './shared-text.js';
import { namesPerson, wholeWord as names } from './names.js';
import { dueWithin } from './dates.js';

// v1's place rule (relevance.js placeMatches): "Auvoth" matches "Auvoth, Canal Street" and the other way round.
function placeTied(record, here) {
    const at = normalize(here);
    if (at.length < MIN_NAME) return false;
    const fields = record.fields ?? {};
    return [fields.place, fields.now, fields.leg].some(value => {
        const there = normalize(value);
        return there.length >= MIN_NAME && (there.includes(at) || at.includes(there));
    });
}


// The beat a beat waits on (`after:`), when it is still open.
function waitsOnOpen(record, open) {
    const after = lineKey(flat(record.extra?.after ?? record.fields?.after));
    return Boolean(after) && open.has(after);
}

/**
 * Splits the classified relevant entries (`[{ record, reason, priority }]`, best first) into what fits the
 * scene and the rest, keeping their order: `{ here, elsewhere }`. `threads` maps a record to its thread
 * (for `ready`); `records`: every record (for beats' `after:`); `said`: the reader's message.
 */
export function splitByScene(relevant, { scene, calendar = null, now = null, dueSoonDays = 3, threads = new Map(), records = [] } = {}) {
    if (!scene?.known) return { here: [...relevant], elsewhere: [] };
    const openBeats = new Set(records.filter(record => record.status === 'active' && record.kind === 'beat').map(record => lineKey(record.key)));
    const here = [];
    const elsewhere = [];
    for (const entry of relevant) {
        (fits(entry, { scene, calendar, now, dueSoonDays, threads, openBeats }) ? here : elsewhere).push(entry);
    }
    return { here, elsewhere };
}

function fits({ record, reason }, { scene, calendar, now, dueSoonDays, threads, openBeats }) {
    if (record.kind === 'beat' && waitsOnOpen(record, openBeats)) return false;
    if (reason === 'mentioned' || reason === 'shown') return true;
    if (record.kind === 'quest' && (threads.get(record)?.ready || waitsForPay(record) || looksFinished(record))) return true;
    if (placeTied(record, scene.place) || placeTied(record, scene.region)) return true;
    if (scene.people.some(person => namesPerson(record, person))) return true;
    if (dueWithin(record, { calendar, now, days: dueSoonDays })) return true;
    if (record.kind === 'beat') {
        // Its prerequisite ended: it is the next turn of the story.
        if (lineKey(flat(record.extra?.after ?? record.fields?.after))) return true;
        const reach = normalize(record.fields?.reach);
        if (reach && [scene.place, scene.region].some(name => normalize(name).length >= MIN_NAME && reach.includes(normalize(name)))) return true;
        if (reach && scene.people.some(person => person.names.some(name => names(reach, name)))) return true;
    }
    return false;
}
