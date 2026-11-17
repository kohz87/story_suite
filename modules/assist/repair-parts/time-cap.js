// A repaired time stretch capped: more than a day needs the reply to say a day or more passed. Pure.

import { parseChanges } from '../../../core/capture.js';

export const MAX_STRETCH_MINUTES = 24 * 60;
const UNIT = { m: 1, h: 60, d: 1440 };
// What a reply says when more than a day went by: "the next morning", "by the next evening", "two days later", "after three days of hard riding", "for a week",
// "after a fortnight", "on the third day", "overnight", "slept". An ordinal below the third ("the second day") or a distance ("two full days of road still lay ahead") says nothing passed.
const COUNT = '(?:an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|several|few|many|\\d+)(?:\\s+(?:full|whole|long|hard|more|solid|good))?';
const SAID = new RegExp([
    '\\b(?:next|following) (?:day|morning|dawn|afternoon|evening|night|week)\\b', '\\bovernight\\b', '\\btomorrow\\b', '\\bthe (?:day|night) after\\b', '\\bslept\\b',
    '\\b(?:days?|nights?|weeks?|fortnights?|months?) (?:later|passed|went by|slipped by)\\b', '\\b(?:for|after|in) (?:days|weeks|months)\\b',
    '\\b(?:an?|one) (?:week|fortnight|month)\\b', '\\bfortnight\\b', '\\b(?:third|fourth|fifth|sixth|seventh|eighth|ninth|tenth) (?:day|night)\\b',
    `\\b${COUNT}\\s+(?:days?|nights?|weeks?|fortnights?|months?)\\b`,
].join('|'), 'ig');
const DISTANCE = /\b(?:still|yet) (?:lay|lie|lies|ahead|to go)\b|\blay (?:between|ahead)\b|\bahead of\b|\bremain(?:ed|s)?\b|\bto go\b|\baway\b|\bfrom (?:here|now)\b|\bbetween you\b/i;
const ONE = /^(?:an?|one) (?:day|night)\b/i;

/** True when `story` names a stretch longer than a day that went by (a duration, not a distance still to cover). */
export function statesLongStretch(story) {
    const text = String(story ?? '');
    for (const match of text.matchAll(SAID)) {
        if (ONE.test(match[0])) continue;
        const tail = text.slice(match.index + match[0].length).split(/[.!?\n]/)[0];
        if (DISTANCE.test(tail)) continue;
        return true;
    }
    return false;
}

/** The minutes of a repaired `! time +N<m|h|d>` line, or null for any other line. */
function stretch(raw) {
    const line = parseChanges(`<Changes>\n${raw}\n</Changes>`).lines[0];
    const match = line && line.op === '!' && line.kind === 'time' ? /^\+(\d{1,6})\s*([mhd])$/i.exec(String(line.name).trim()) : null;
    return match ? Number(match[1]) * UNIT[match[2].toLowerCase()] : null;
}

/**
 * `lines` (the repair's raw change lines) with each `! time` stretch over a day cut to `! time +24h` unless `story` names a stretch longer than a day;
 * { lines, cut: [{ line, why }] } where `cut` holds what was cut, for a Problems note on the reply.
 */
export function capStretch(lines, story) {
    const said = statesLongStretch(story);
    const cut = [];
    const kept = lines.map(raw => {
        const minutes = stretch(raw);
        if (said || minutes === null || minutes <= MAX_STRETCH_MINUTES) return raw;
        cut.push({ line: raw, why: 'the reply does not say a day or more passed, so the time was cut to ! time +24h' });
        return '! time +24h';
    });
    return { lines: kept, cut };
}
