// Checks the Source and Guard shapes a guarded block's span carries.

import { isObject } from './shared-object.js';
import { isHash, isRecordId, hasPrefix } from './id-forms.js';
import { isPlainJson } from './canonical.js';

const SAFE_ORDINAL = value => Number.isInteger(value) && value >= 0 && value <= 1000000;

/** '' when `source` is a Source ({ sid: sr_, swipeKey: sw_, evidence: ev_, ordinal }), else why not. */
export function sourceProblem(source) {
    if (!isObject(source)) return 'its source is not a record';
    if (!hasPrefix(source.sid, 'sr')) return 'its source has no canonical sid (sr_xxxxxxxx)';
    if (!hasPrefix(source.swipeKey, 'sw')) return 'its source has no swipe key (sw_xxxxxxxx)';
    if (!hasPrefix(source.evidence, 'ev')) return 'its source has no evidence id (ev_xxxxxxxx)';
    if (!SAFE_ORDINAL(source.ordinal)) return 'its source ordinal is not a whole number from 0 to 1000000';
    return '';
}

/** '' when `guard` is a Guard ({ owner, version: 2, epoch, rulesHash, inputHash, predicate }), else why not. */
export function guardProblem(guard) {
    if (!isObject(guard)) return 'a guard is a record';
    if (typeof guard.owner !== 'string' || !guard.owner) return 'a guard names its owner module';
    if (guard.version !== 2) return 'a guard is version 2';
    if (!isRecordId(guard.epoch)) return 'a guard names its epoch (an id like ep_k3f9a2qz)';
    if (guard.rulesHash !== null && !isHash(guard.rulesHash)) return 'a guard\'s rulesHash is null or a 64-character hash';
    if (!isHash(guard.inputHash)) return 'a guard\'s inputHash is a 64-character hash';
    if (!Object.hasOwn(guard, 'predicate') || !isPlainJson(guard.predicate)) return 'a guard\'s predicate is plain JSON';
    if (guard.replyBound !== undefined && typeof guard.replyBound !== 'boolean') return 'a guard\'s replyBound is true or false';
    return '';
}
