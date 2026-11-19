// Builds one slim person card for a reply's Here tab: the portrait inside the feelings ring, and the name; a tap opens that person's page.
import { h, svgEl } from '../kit/dom.js';

const METERS = [['trust', '#5aa0ff', 'Trust'], ['affection', '#ff7aa8', 'Affection'], ['desire', '#c08aff', 'Desire'], ['tension', '#f0b84a', 'Tension']];

function point(r, deg) {
  const a = (deg * Math.PI) / 180;
  return [(50 + r * Math.sin(a)).toFixed(2), (50 - r * Math.cos(a)).toFixed(2)];
}

function arc(r, a0, a1) {
  const [x0, y0] = point(r, a0);
  const [x1, y1] = point(r, a1);
  return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

// The four feelings as quarter arcs round the portrait, each as long as its value (0-100).
function ring(meters) {
  const w = 6;
  const r = 50 - w / 2 - 1;
  const kids = [svgEl('circle', { cx: 50, cy: 50, r, fill: 'none', stroke: 'var(--SmartThemeBorderColor)', 'stroke-width': w })];
  METERS.forEach(([key, color], q) => {
    const v = Math.max(0, Math.min(100, Number(meters?.[key]) || 0));
    if (!v) return;
    const z = q * 90;
    kids.push(svgEl('path', { d: arc(r, z + 4, z + 4 + (82 * v) / 100), fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' }));
  });
  return svgEl('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' }, kids);
}

const safeUrl = src => (typeof src === 'string' && src && !/["'()\\\s]/.test(src) ? src : null);

function face(person) {
  const url = safeUrl(person.portrait);
  const el = h('span', { class: 'ph' }, url ? null : (person.name || '?').slice(0, 1));
  if (url) el.style.setProperty('background-image', `url("${url}")`);
  return el;
}

/** One person of a reply's Here tab ({ personId, name, portrait, meters }); `onOpen(id, name)` hears a tap (or Enter / Space). */
export function hereCard(person, onOpen) {
  const go = () => onOpen?.(person.personId, person.name);
  const feelings = METERS.map(([key, , label]) => `${label} ${Number(person.meters?.[key]) || 0}`).join(', ');
  return h(
    'div',
    {
      class: 'pc2', role: 'button', tabindex: '0', title: `Open ${person.name}’s page`, 'aria-label': `${person.name}. Open their page`,
      onClick: go,
      onKeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault?.(); go(); } },
    },
    h('span', { class: 'rg2', role: 'img', 'aria-label': `Feelings: ${feelings}` }, ring(person.meters), face(person)),
    h('b', person.name),
  );
}
