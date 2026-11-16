// The gate for one story line of a hosted run: turning its meter changes into a move, gating it and reporting the outcome.
import { isInt, isReply, METERS_GATED } from './shared-values.js';
import { normalizeApproachKind } from './kinds.js';
import { GATE_SOURCE, GATE_MODES } from './gate-rules.js';
import { gateSettingsOf } from './settings.js';
import { readApproachRing, approachRingText } from './ring-text.js';
import { describeGate } from './cue.js';
import { gateApproach } from './approach.js';

/** Problems with the gate part of a last-event item ({ mode, n, span }; absent is fine) ([] when fine). */
export function gateEventProblems(value) {
    if (value === undefined) return [];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ['is not a record'];
    const errors = [];
    if (!Object.hasOwn(GATE_MODES, value.mode)) errors.push('has no known mode');
    if (!isInt(value.n) || value.n < 1) errors.push('has no place in the window');
    if (!isInt(value.span) || value.span < 1) errors.push('has no span');
    if (Object.keys(value).some(key => !['mode', 'n', 'span'].includes(key))) errors.push('has an unknown field');
    return errors;
}

/**
 * The gate for one story line of a hosted run. `changes` are the line's meter changes ({ meter, mode: 'add' | 'set', value }), `cap` the points its impact tier allows (null: none),
 * `read(id)` a meter's value now, `stored` the record's `via` text. A change to trust, affection or tension is turned into the
 * move it asks (a `=N` is its distance from now) and gated as one; every other change is kept as it is.
 * → { changes, ring (text to store, or null when it is as stored), via, event ({ mode, n, span } or null), cue, receipt (the words) },
 *   or null when nothing is gated (no known approach, no story day, no reply).
 */
export function gateStoryLine({ changes, read, via, day, reply, name, settings, stored, cap = null }) {
    const kind = normalizeApproachKind(via);
    if (!kind || !isInt(day) || !isReply(reply)) return null;
    const asked = {};
    for (const change of changes) {
        if (METERS_GATED.includes(change.meter)) asked[change.meter] = (asked[change.meter] ?? 0) + (change.mode === 'add' ? change.value : change.value - read(change.meter));
    }
    // A rise is held to the tier's cap first, so "less" is a share of what the move would have given, not of a larger ask.
    if (isInt(cap)) for (const meter of METERS_GATED) if (asked[meter] > cap) asked[meter] = cap;
    const out = gateApproach({ source: GATE_SOURCE, via: kind, day, reply, name, trust: read('trust'), delta: asked, ring: readApproachRing(stored) ?? [], settings: gateSettingsOf(settings) });
    const kept = changes.filter(change => !METERS_GATED.includes(change.meter));
    const gated = METERS_GATED.filter(meter => out.delta[meter]).map(meter => ({ meter, mode: 'add', value: out.delta[meter] }));
    const text = approachRingText(out.ring);
    const event = out.gate ? { mode: out.gate.mode, n: out.gate.n, span: out.gate.span } : null;
    return {
        changes: out.mode === 'none' ? changes : [...kept, ...gated],
        ring: text === stored ? null : text,
        via: kind,
        event: event && !gateEventProblems(event).length ? event : null,
        cue: out.cue,
        receipt: describeGate(out.gate),
    };
}
