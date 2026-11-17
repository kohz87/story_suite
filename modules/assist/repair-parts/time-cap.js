// A repaired time stretch capped: more than a day needs the reply to say a day or more passed. Pure.

import { parseChanges } from '../../../core/capture.js';

export const MAX_STRETCH_MINUTES = 24 * 60;
const UNIT = { m: 1, h: 60, d: 1440 };
// What a reply says when a day or more went by: "the next morning", "two days later", "overnight". An ordinal ("the second day") or a distance ("two full days of road still lay ahead") says nothing passed.
const SAID = /\b(?:next|following) (?:day|morning|dawn)\b|\bovernight\b|\btomorrow\b|\bthe (?:day|night) after\b|\b(?:days?|nights?|weeks?) (?:later|passed|went by|slipped by)\b|\bslept\b/i;

/** The minutes of a repaired `! time +N<m|h|d>` line, or null for any other line. */
function stretch(raw) {
    const line = parseChanges(`<Changes>\n${raw}\n</Changes>`).lines[0];
    const match = line && line.op === '!' && line.kind === 'time' ? /^\+(\d{1,6})\s*([mhd])$/i.exec(String(line.name).trim()) : null;
    return match ? Number(match[1]) * UNIT[match[2].toLowerCase()] : null;
}

/**
 * `lines` (the repair's raw change lines) with each `! time` stretch over a day cut to `! time +24h` unless `story` says a day or more passed;
 * { lines, cut: [{ line, why }] } where `cut` holds what was cut, for a Problems note on the reply.
 */
export function capStretch(lines, story) {
    const said = SAID.test(String(story ?? ''));
    const cut = [];
    const kept = lines.map(raw => {
        const minutes = stretch(raw);
        if (said || minutes === null || minutes <= MAX_STRETCH_MINUTES) return raw;
        cut.push({ line: raw, why: 'the reply does not say a day or more passed, so the time was cut to ! time +24h' });
        return '! time +24h';
    });
    return { lines: kept, cut };
}
