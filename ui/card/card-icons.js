// Draws the card's chip and status glyphs (the mock's own shapes); unknown status ids fall back to the shared set.
import { svgEl } from '../kit/dom.js';
import { glyph } from '../kit/glyphs.js';

const SOAK = { attrs: { fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2 }, shapes: [['path', { d: 'M12 2.5l8 3v6c0 5.5-3.5 9-8 11-4.5-2-8-5.5-8-11v-6z' }]] };
const PACE = {
  attrs: { fill: 'currentColor' },
  shapes: [['path', { d: 'M8 2.5c2 0 3 2 3 4.5s-1 5-3 5-3-2.5-3-5 1-4.5 3-4.5zM6 13.5h4.2l-.4 2.5c-.3 1.6-1.6 2.5-2.2 2.5S6 17.6 6 16zM16 6.5c2 0 3 2 3 4.5s-1 5-3 5-3-2.5-3-5 1-4.5 3-4.5zM14 17.5h4.2l-.4 2.5c-.3 1.6-1.6 2.5-2.2 2.5s-1.6-.9-1.6-2.5z' }]],
};
const STATUS = {
  'shadow-step': { attrs: { fill: 'currentColor' }, shapes: [['path', { d: 'M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z' }]] },
  bleeding: { attrs: { fill: 'currentColor' }, shapes: [['path', { d: 'M12 2c3 4.5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7.5 6-12z' }]] },
  winded: { attrs: { fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, shapes: [['path', { d: 'M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8' }]] },
};

function draw({ attrs, shapes }) {
  return svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', ...attrs }, shapes.map(([tag, a]) => svgEl(tag, a)));
}

/** Returns the soak (shield) glyph. */
export const soakIcon = () => draw(SOAK);
/** Returns the pace (footprints) glyph. */
export const paceIcon = () => draw(PACE);
/** Returns the glyph for a status id, or the buff/debuff fallback from the shared set. */
export function statusIcon(id, tone) {
  return STATUS[id] ? draw(STATUS[id]) : glyph(tone === 'buff' ? 'stance' : 'warn');
}
