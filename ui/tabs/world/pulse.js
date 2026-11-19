// The map's you-are-here ring: an HTML overlay sized and placed from the map's viewBox, so it pulses on the compositor (transform + opacity), with no per-frame layout.
import { h } from '../../kit/dom.js';

// Map units. The mock's ring is r 14 to 30 with a 3-unit stroke, so its outer edge runs 15.5 to 31.5. A scale animation also scales the border,
// so the ring is drawn at the full size with a 4.6-unit border and starts at scale .483: the border is then 2.2 to 4.6 (about 3 where the ring is
// brightest) and the outer edge 15.6 to 32.3 (within a unit of the mock).
const R = 32.3;
const BORDER = 4.6;

/** Moves the ring to the place's spot for the current viewBox; px = box pixels per map unit. Zoomed in past one px a unit, the ring keeps its size. */
export function placePulse(el, here, vb, px) {
  const k = Math.min(px, 1);
  const d = 2 * R * k;
  el.style.width = `${d}px`;
  el.style.height = `${d}px`;
  el.style.borderWidth = `${BORDER * k}px`;
  el.style.left = `${(here.x - vb.x) * px - R * k}px`;
  el.style.top = `${(here.y - vb.y) * px - R * k}px`;
}

/** Builds the ring for the place you are at. */
export function pulseRing(here, vb, px) {
  const el = h('div', { class: 'pulse you', 'aria-hidden': 'true', dataset: { pulse: 'you' } });
  placePulse(el, here, vb, px);
  return el;
}
