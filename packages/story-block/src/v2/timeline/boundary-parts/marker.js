// A logical clock marker: the clock commands, the marker's hash and the check that it is valid.
import { hashJson, sourceProblem, cursorProblem, isHash, isPlainJson } from '../../replay.js';
export const CLOCK_COMMANDS = Object.freeze(['capture.time', 'director.seed', 'time.settle', 'director.advance']);
export const markerHash = marker => hashJson({ minute: marker.minute, source: { sid: marker.source.sid, swipeKey: marker.source.swipeKey, evidence: marker.source.evidence }, cursor: { ...marker.cursor, rev: 0 }, entry: marker.entry, baseHash: marker.baseHash });
export function markerProblem(marker) {
    if (!marker || !Number.isSafeInteger(marker.minute) || marker.minute % 1440 !== 0 || sourceProblem(marker.source) || cursorProblem(marker.cursor)) return 'a clock marker has no valid midnight, source or cursor';
    if (!isHash(marker.baseHash) || !isPlainJson(marker.entry) || !marker.entry?.payload || !isHash(marker.pin) || typeof marker.proof !== 'string' || !isHash(marker.prefixHash)) return 'a clock marker has no captured prefix';
    return markerHash(marker) === marker.prefixHash ? '' : 'a clock marker no longer hashes to its captured prefix';
}
