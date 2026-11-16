// Draws the feelings ring: four quarter arcs (trust, affection, desire, tension) sized by each meter, none for zero.
import { svgEl } from './dom.js';

export const FEELING_KEYS = Object.freeze(['trust', 'affection', 'desire', 'tension']);
const MAX_SWEEP = 90;

function point(r, deg) {
  const a = (deg * Math.PI) / 180;
  return [(50 + r * Math.sin(a)).toFixed(2), (50 - r * Math.cos(a)).toFixed(2)];
}

function arcPath(r, from, to) {
  const [x0, y0] = point(r, from);
  const [x1, y1] = point(r, to);
  return `M${x0} ${y0}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/** Builds the SVG ring for a meters object; a meter of 0 (or a missing one) draws no arc, a negative one is dashed. */
export function feelingsRing(meters = {}, { width = 6, pad = 1 } = {}) {
  const r = 50 - width / 2 - pad;
  const svg = svgEl(
    'svg',
    { viewBox: '0 0 100 100', class: 'ring', 'aria-hidden': 'true' },
    svgEl('circle', { cx: 50, cy: 50, r, fill: 'none', 'stroke-width': width, class: 'ring-track' }),
  );
  FEELING_KEYS.forEach((key, quarter) => {
    const value = Number(meters?.[key]);
    if (!Number.isFinite(value) || value === 0) return;
    const sweep = Math.sqrt(Math.min(Math.abs(value), 100) / 100) * MAX_SWEEP;
    const start = quarter * 90;
    svg.appendChild(svgEl('path', {
      d: arcPath(r, start, start + sweep),
      fill: 'none',
      'stroke-width': width,
      'stroke-linecap': value < 0 ? 'butt' : 'round',
      'stroke-dasharray': value < 0 ? `${width * 0.9} ${width * 0.7}` : null,
      class: `ring-arc f${quarter}`,
      'data-meter': key,
    }));
  });
  return svg;
}
