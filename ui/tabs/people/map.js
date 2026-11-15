// Draws People > Map: everyone known placed around you by a feeling lens, tie lines between them and a card for the picked person.
import { h, svgEl } from '../../kit/dom.js';
import { segmented } from '../../kit/controls.js';
import { portraitDisc } from './person-card.js';

export const LENSES = Object.freeze([
  ['warmth', 'Warmth', 'cold · hostile'],
  ['trust', 'Trust', 'distrust'],
  ['affection', 'Affection', 'dislike'],
  ['desire', 'Desire', 'aversion'],
  ['tension', 'Tension', 'at ease'],
]);
const TIE_CLASS = { friend: 'ok', kin: 'ok', rival: 'bad', owes: 'gold' };
const TIE_LEGEND = [['ok', 'friend or kin'], ['bad', 'rival'], ['gold', 'owes']];
const TITLES = /^(Sister|Captain|Old) /;

const shortName = p => p.name.replace(TITLES, '').replace(/ Varr$/, '');
const signed = v => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');

/** The lens value for a person: warmth is the mean of trust and affection, others are one meter. */
export function lensValue(person, lens) {
  const m = person.meters ?? {};
  if (lens === 'warmth') return Math.round(((m.trust ?? 0) + (m.affection ?? 0)) / 2);
  return Number(m[lens]) || 0;
}

// Positive values pull in faster than negative values push out (centre 0, dashed outer ring = the lens's negative word).
const radius = v => (v >= 0 ? 31.4 - v * 0.237 : 31.4 - v * 0.147);

/** Places people on a 0-100 square around the centre (50, 50): angle by position in the list, distance by the lens. */
export function placePeople(people, lens) {
  const n = people.length || 1;
  const out = {};
  people.forEach((p, i) => {
    const angle = ((((i * 3) % n) / n) * 360 + 20) * (Math.PI / 180);
    const d = Math.max(0, Math.min(46, radius(lensValue(p, lens))));
    out[p.personId] = [50 + d * Math.sin(angle), 50 - d * Math.cos(angle)];
  });
  return out;
}

/** Finds the spot on the dashed outer ring farthest from every face (skipping the far left and right), where its word is written. */
function ringLabelSpot(pos) {
  const spots = Object.values(pos);
  let best = null;
  for (let a = 0; a < 360; a += 10) {
    const r = (a * Math.PI) / 180;
    const x = 50 + 43 * Math.sin(r);
    const y = 50 - 43 * Math.cos(r);
    if (x < 14 || x > 86) continue;
    const dm = spots.length ? Math.min(...spots.map(q => Math.hypot(q[0] - x, (q[1] - y) * 1.2))) : 99;
    if (!best || dm > best.dm) best = { x, y, dm };
  }
  return best ?? { x: 50, y: 7 };
}

function tieLines(ties, pos, sel, focus) {
  return (ties ?? [])
    .filter(t => pos[t.a] && pos[t.b] && (!focus || t.a === focus || t.b === focus))
    .map((t) => {
      const on = Boolean(focus) || (sel && (t.a === sel || t.b === sel));
      return svgEl('line', {
        x1: pos[t.a][0], y1: pos[t.a][1], x2: pos[t.b][0], y2: pos[t.b][1],
        class: `tie-line ${TIE_CLASS[t.kind] ?? 'ok'}${on ? ' on' : ''}`,
        'stroke-width': on ? 2.4 : 1.2,
        'stroke-dasharray': on ? null : '4 3',
        'vector-effect': 'non-scaling-stroke',
        'data-a': t.a, 'data-b': t.b,
      });
    });
}

function pickedCard(person, ties, people, ctx, handlers, focus) {
  if (!person) {
    return h('div', { class: 'mcard' }, h('span', { class: 'mhint' }, 'Tap a face to see how they feel about you, then Open dossier or Focus.'));
  }
  const names = new Map(people.map(p => [p.personId, shortName(p)]));
  const tieText = (ties ?? [])
    .filter(t => t.a === person.personId || t.b === person.personId)
    .map(t => `${t.kind} ${names.get(t.a === person.personId ? t.b : t.a) ?? ''}`.trim());
  const m = person.meters ?? {};
  return h('div', { class: 'mcard', dataset: { picked: person.personId } },
    h('div', { class: 'who' }, portraitDisc(person, 'cm'),
      h('span', null, h('b', null, person.name),
        h('small', null, `${person.here ? 'here' : 'away'} · ${person.mood || 'no mood yet'}`))),
    h('div', { class: 'fine' }, [`warmth ${signed(lensValue(person, 'warmth'))}`, `trust ${signed(m.trust ?? 0)}`,
      `tension ${signed(m.tension ?? 0)}`, ...tieText].join(' · ')),
    h('div', { class: 'acts' },
      h('button', { type: 'button', class: 'btn2', dataset: { act: 'open' }, onClick: () => ctx.go?.('people', { personId: person.personId }) }, 'Open dossier ›'),
      focus === person.personId ? null
        : h('button', { type: 'button', class: 'btn2', dataset: { act: 'focus' }, onClick: () => handlers.focus(person.personId) }, 'Focus')));
}

/**
 * Builds the map. `people` are cards with `here` set; `state` = { lens, sel, focus }; `handlers` = { lens(id), pick(id), focus(id|null) }.
 * ctx.go(tab, args) opens a dossier; `you` = { portrait, name } is drawn in the centre.
 */
export function castMap({ people = [], ties = [], state = {}, handlers = {}, ctx = {}, you = { name: 'You' } } = {}) {
  const lens = LENSES.find(l => l[0] === state.lens) ?? LENSES[0];
  const pos = placePeople(people, lens[0]);
  const sel = people.find(p => p.personId === state.sel) ?? null;
  const focus = people.some(p => p.personId === state.focus) ? state.focus : null;
  const near = id => !focus || id === focus
    || (ties ?? []).some(t => (t.a === focus && t.b === id) || (t.b === focus && t.a === id));
  const spot = ringLabelSpot(pos);
  const lensName = lens[0] === 'warmth' ? 'warmer' : `higher ${lens[0]}`;
  const ring = (pct, cold) => h('div', { class: ['ring2', cold ? 'cold' : null], style: { width: `${pct}%`, height: `${pct}%` } });

  return h('div', { class: 'castmap', dataset: { lens: lens[0] } },
    h('div', { class: 'mapctl' },
      segmented({ items: LENSES.map(l => [l[0], l[1]]), value: lens[0], label: 'Lens', className: 'seg2', onChange: v => handlers.lens?.(v) }),
      focus ? h('button', { type: 'button', class: 'fchip', onClick: () => handlers.focus?.(null) },
        `Focus: ${shortName(people.find(p => p.personId === focus))} ✕`) : null),
    h('p', { class: 'fine' }, `Closer to ${you.name ?? 'you'} = ${lensName} · the dashed outer ring = ${lens[2]}`),
    h('div', { class: 'cmap' },
      ring(39.2), ring(62.8), ring(92.2, true),
      h('span', { class: 'rw', style: { left: `${spot.x}%`, top: `${spot.y}%` } }, lens[2]),
      svgEl('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, tieLines(ties, pos, sel?.personId, focus)),
      h('span', { class: 'cm you', style: { left: '50%', top: '50%' } }, portraitDisc(you, 'cm-face')),
      people.map(p => h('button', {
        type: 'button',
        class: ['cmw', p.here ? 'here' : 'away'],
        style: { left: `${pos[p.personId][0]}%`, top: `${pos[p.personId][1]}%` },
        'aria-pressed': String(p.personId === state.sel),
        'aria-label': `${p.name}, ${lens[0]} ${signed(lensValue(p, lens[0]))}, ${p.here ? 'here' : 'away'}`,
        dataset: { personId: p.personId, dim: near(p.personId) ? '0' : '1' },
        onClick: () => handlers.pick?.(p.personId),
      }, h('span', { class: 'cm' }, portraitDisc(p, 'cm-face'), h('i', { class: `hm ${p.here ? 'here' : 'away'}` })),
      h('b', null, shortName(p)), h('small', null, signed(lensValue(p, lens[0])))))),
    h('div', { class: 'mleg' }, TIE_LEGEND.map(([cls, text]) => h('span', { class: `leg-${cls}` }, h('i'), text)), h('span', null, '● here  ○ away')),
    pickedCard(sel, ties, people, ctx, handlers, focus));
}
