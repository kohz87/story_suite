// The shape of the savepoints domain: its schema number, its check, a fresh one, and the day before the newest.

import { isHash } from '../../replay.js';
import { GENESIS_EPOCH } from '../gate.js';
import { isObject } from '../util.js';

export const SCHEMA = 2;

/** The sentences that say why a savepoints domain is not whole; [] when it is. */
export function savepointsProblems(domain) {
    if (!isObject(domain)) return ['The savepoints are not a record.'];
    const out = [];
    if (domain.schema !== SCHEMA) out.push('The savepoints are not schema 2.');
    if (typeof domain.epoch !== 'string' || !domain.epoch) out.push('The savepoints name no epoch.');
    for (const key of ['points', 'dayStarts', 'returns', 'ruleSettings']) if (!isObject(domain[key])) out.push(`The savepoints' ${key} are not a record.`);
    if (domain.previousDay !== null && typeof domain.previousDay !== 'string') out.push('The savepoints\' previousDay is not an id or null.');
    for (const [id, point] of Object.entries(isObject(domain.points) ? domain.points : {})) {
        if (!isObject(point) || point.id !== id || !isHash(point.payloadHash)) out.push(`The save point ${id} is not whole.`);
    }
    return out;
}

/** A fresh savepoints domain: schema 2, the given epoch, no points, no returns. */
export const initialSavepoints = (epoch = GENESIS_EPOCH) => ({ schema: SCHEMA, epoch, points: {}, dayStarts: {}, previousDay: null, returns: {}, ruleSettings: {} });

/** The start of the day before the newest day that has one (contract §8 step 1), else null. `dayStarts` is day -> snapshot id. */
export function previousDayOf(dayStarts) {
    const days = Object.keys(isObject(dayStarts) ? dayStarts : {}).map(Number).filter(Number.isSafeInteger);
    if (!days.length) return null;
    const before = dayStarts[String(Math.max(...days) - 1)];
    return typeof before === 'string' ? before : null;
}
