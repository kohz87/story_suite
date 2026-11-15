// Checks a metadata span and its boundary cursors are well formed.

import { isObject } from './shared-object.js';
import { isHash, isRecordId, hasPrefix } from './id-forms.js';
import { isPlainJson } from './canonical.js';
import { sourceProblem, guardProblem } from './source-guard.js';

/** True for a span written by a guarded transaction (a legacy span is `{ n, story }` only). */
export const isMetaSpan = span => isObject(span) && typeof span.id === 'string';

export function cursorProblem(cursor) {
    if (!isObject(cursor)) return 'a boundary has no cursor';
    if (!isRecordId(cursor.sid) || !isRecordId(cursor.swipeKey) || !isRecordId(cursor.block)) return 'a boundary cursor names no source or block';
    if (!Number.isInteger(cursor.op) || cursor.op < 0 || !Number.isInteger(cursor.rev) || cursor.rev < 0) return 'a boundary cursor has no op or rev';
    return '';
}

/** '' when a metadata span is well formed (the fields of contract §6 P12), else why not. */
export function spanProblem(span) {
    if (!isMetaSpan(span)) return 'it has no block id';
    if (!hasPrefix(span.id, 'bl')) return 'its block id is not bl_xxxxxxxx';
    if (typeof span.module !== 'string' || !span.module) return 'it names no module';
    const source = sourceProblem(span.source);
    if (source) return source;
    if (span.guard !== null) {
        const guard = guardProblem(span.guard);
        if (guard) return guard;
    }
    if (!Array.isArray(span.claims) || span.claims.some(key => typeof key !== 'string' || !key)) return 'its claims are not a list of keys';
    if (!Array.isArray(span.evidence)) return 'its evidence is not a list';
    if (!Array.isArray(span.boundaries) || !span.boundaries.length) return 'it has no boundary';
    for (const boundary of span.boundaries) {
        const bad = isObject(boundary) ? cursorProblem(boundary.cursor) : 'a boundary is not a record';
        if (bad) return bad;
        if (!isHash(boundary.prefixHash) || !isHash(boundary.payloadHash)) return 'a boundary has no prefix or payload hash';
    }
    if (!isObject(span.operation) || typeof span.operation.type !== 'string' || !span.operation.type || !Object.hasOwn(span.operation, 'payload')) return 'it has no operation';
    if (!isPlainJson(span.operation.payload) || !isPlainJson(span.recorded ?? null) || !isPlainJson(span.result ?? null)) return 'its operation, recorded inputs or result are not plain JSON';
    if (span.replan !== null && span.replan !== undefined) {
        const replan = span.replan;
        if (!isObject(replan) || typeof replan.type !== 'string' || !replan.type || !isPlainJson(replan.payload) || !Number.isInteger(replan.seed)) return 'its replan is not { type, payload, seed }';
    }
    return '';
}
