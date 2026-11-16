// The meter's marks: stage ticks, the stage reached, the critical-band warning and the change text.

import { fmt, str } from '../dom.js';
import { oneLine } from '../../../../../core/text.js';
import { meterRatio } from './ratio.js';
import { numberOr } from './shared-number.js';

const MAX_TICKS = 16;

const TICK_LABEL = 40;

/**
 * The stage marks inside [min, max], in value order: [{ at, ratio, label }] (at most 16; a label is one
 * line of up to 40 characters, '' when not given). Entries without a number `at` are dropped.
 */
export function meterTicks(ticks, min, max) {
    if (!Array.isArray(ticks) || !(max > min)) return [];
    const out = [];
    for (const tick of ticks) {
        if (out.length >= MAX_TICKS) break;
        const at = numberOr(tick && typeof tick === 'object' ? tick.at : null);
        if (at === null || at < min || at > max) continue;
        out.push({ at, ratio: meterRatio(at, min, max), label: oneLine(typeof tick.label === 'string' ? tick.label : str(tick.label), TICK_LABEL) });
    }
    return out.sort((a, b) => a.at - b.at);
}

/** The stage reached: the last tick at or below `value` (null below the first). */
export function meterStage(ticks, value) {
    let stage = null;
    for (const tick of ticks) if (tick.at <= value) stage = tick;
    return stage;
}

/**
 * Where the value stands against the critical bands: 'low' (below `warnBelow`), 'high' (above
 * `warnAbove`) or null. A bound that is not a number is no band.
 */
export function meterWarning(value, warnBelow, warnAbove) {
    const low = numberOr(warnBelow);
    const high = numberOr(warnAbove);
    if (low !== null && value < low) return 'low';
    if (high !== null && value > high) return 'high';
    return null;
}

/** The change since the last reply as shown: '▲3', '▼5', or '' for none (0, not a number). */
export function deltaText(delta) {
    const n = numberOr(delta);
    if (n === null || fmt(n) === '0') return '';
    return `${n > 0 ? '▲' : '▼'}${fmt(Math.abs(n))}`;
}
