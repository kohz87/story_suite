// The four-segment Health mini-bar and how many segments a value lights.
import { h, text } from '../../../view/widgets/dom.js';
import { numberOr } from './shared-values.js';

export const SEGMENTS = 4;
const TONES = Object.freeze(['good', 'warn', 'bad']);
const toneOf = tone => (TONES.includes(tone) ? tone : 'neutral');
/** Lit segments of a bar: the share of blocks left, rounded up so any block left lights one segment. */
export function litSegments(value, max) {
    if (!(max > 0)) return 0;
    const share = Math.min(1, Math.max(0, numberOr(value) / max));
    return Math.ceil(share * SEGMENTS - 1e-9);
}

/** The Health mini-bar: four segments in the chip's tone, lit by the blocks left (`max` 0 or less: all dark). */
export function healthMiniBar(doc, { value, max, tone } = {}) {
    const bar = h(doc, 'span', `rpg-mini rpg-mini-${toneOf(tone)}`);
    const lit = litSegments(value, max);
    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-label', 'Health');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(max > 0 ? max : 0));
    bar.setAttribute('aria-valuenow', String(max > 0 ? Math.min(max, Math.max(0, numberOr(value))) : 0));
    for (let at = 0; at < SEGMENTS; at++) bar.appendChild(h(doc, 'i', at < lit ? 'lit' : 'off'));
    return bar;
}
