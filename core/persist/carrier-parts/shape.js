// Story Suite v2: the record shape check and the fault a damaged record gets.

import { KEY, isObject, isCarrier } from './identity.js';

const isState = value => isObject(value) && value.v === 2 && isObject(value.meta) && Number.isInteger(value.meta.rev)
    && isObject(value.domains);

export function wellFormed(record) {
    return isObject(record) && record.v === 2
        && Array.isArray(record.ops) && Array.isArray(record.receipts) && Array.isArray(record.narrated)
        && (record.checkpoint === undefined || isState(record.checkpoint));
}

/**
 * Why the record on this carrier cannot be used, or '' (none there, a good one, another swipe's copy, or
 * not a v2 record at all). The store lists these as Problems: a damaged record is skipped, never taken
 * as the state.
 */
export function recordFault(message) {
    if (!isCarrier(message)) return '';
    const record = message.extra?.[KEY];
    if (!isObject(record) || record.v !== 2 || wellFormed(record)) return '';
    if (!Array.isArray(record.ops) || !Array.isArray(record.receipts) || !Array.isArray(record.narrated)) {
        return 'its list of changes is damaged';
    }
    return 'its saved starting point (checkpoint) is damaged';
}
