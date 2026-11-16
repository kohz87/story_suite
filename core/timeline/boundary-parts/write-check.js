// The write-time checks of a span's clock markers: the markers it holds and the prefix they were captured on.
import { stateHash } from '../host-block.js';
import { markerProblem } from './marker.js';
export function clockWriteProblem(span) {
    if (span?.clockBoundaries === undefined) return '';
    if (!Array.isArray(span.clockBoundaries)) return 'clock markers are not a list';
    const seen = new Set();
    for (const marker of span.clockBoundaries) {
        const bad = markerProblem(marker);
        if (bad) return bad;
        if (marker.source.sid !== span.source?.sid || marker.source.swipeKey !== span.source?.swipeKey || marker.source.evidence !== span.source?.evidence) return 'a clock marker belongs to another source';
        if (seen.has(marker.cursor.block)) return 'two clock markers have the same identity';
        seen.add(marker.cursor.block);
        const proof = span.evidence?.find(item => item.id === marker.proof);
        if (proof?.owner !== 'story-director' || proof.kind !== 'event' || proof.payload?.clockBoundary !== marker.minute || proof.payload?.prefixHash !== marker.prefixHash) return 'a marker has no matching clock proof';
    }
    return '';
}

// Prefix-only host check: no captured state may survive on a different transaction input.
export function markerPrefixProblem(span, state) {
    return span?.clockBoundaries?.some(marker => marker.baseHash !== stateHash(state))
        ? 'the clock marker was captured on another root prefix; Re-read its clock reply' : '';
}
