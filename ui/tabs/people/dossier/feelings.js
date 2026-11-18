// Draws the dossier hero ring with its four corner numbers and builds the "With you" page (meters, stage, changes).
import { h } from '../../../kit/dom.js';
import { feelingsRing, FEELING_KEYS } from '../../../kit/ring.js';
import { portraitDisc } from '../person-card.js';
import { pageSection } from '../../../kit/page.js';

const CORNERS = Object.freeze(['c-tr', 'c-br', 'c-bl', 'c-tl']);
const cap = text => text[0].toUpperCase() + text.slice(1);
const signed = n => (n > 0 ? `+${n}` : String(n));

/** Builds the big portrait with the ring, the four corner numbers and the Profile › button; the dead get the portrait only. */
export function feelingsHero(d, { onProfile } = {}) {
  const dead = d.life !== 'alive';
  const disc = h('button', { type: 'button', class: 'bigph', 'aria-label': 'Profile', dataset: { act: 'profile' }, onClick: () => onProfile?.() },
    portraitDisc(d, 'ph'), h('span', { class: 'prof' }, 'Profile ›'));
  return h('div', { class: ['bigring', dead ? 'dead' : null] },
    dead ? null : feelingsRing(d.meters, { width: 2.6, pad: 4, ticks: true }),
    disc,
    dead ? null : FEELING_KEYS.map((key, i) => h('span', { class: ['ml', CORNERS[i], `f${i}`], dataset: { meter: key } },
      h('b', null, signed(Number(d.meters?.[key]) || 0)), key.toUpperCase())));
}

function meterRow(key, value, i, { label = cap(key), stage = null, min = -100, max = 100 } = {}) {
  const v = Number(value) || 0;
  // The built-in four run -100..+100 from the middle; a reader's own feeling fills from its lowest to its highest.
  const own = min !== -100 || max !== 100;
  const bar = own
    ? h('b', { class: `fill f${i % 4}`, style: { left: '0%', width: `${max > min ? Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100)) : 0}%` } })
    : h('b', { class: `fill f${i}`, style: { left: `${v < 0 ? 50 + v / 2 : 50}%`, width: `${Math.min(Math.abs(v), 100) / 2}%` } });
  return h('div', { class: ['mrow', own ? 'own' : null], dataset: { meter: key } }, h('span', { class: `f${i % 4}` }, label, stage ? h('small', { class: 'stg' }, stage) : null), h('i', null, bar), h('b', null, own ? String(v) : signed(v)));
}

function changeRow(c) {
  const i = Math.max(0, FEELING_KEYS.indexOf(c.meter));
  return h('div', { class: 'e', dataset: { meter: c.meter } }, h('span', null, c.date),
    h('span', null, h('b', { class: `f${i}` }, `${cap(c.meter)} ${signed(c.delta)}`), ` · ${c.why}`, c.heldBack ? h('small', { class: 'held' }, ' · held back') : null));
}

/** Builds the page body: the four meter bars (each with its stage word once reached) and the reader's own feelings, the stage with what it needs, and every change; `youName` words the title only. */
export function withPage(d) {
  const stage = d.stage;
  return [
    h('div', { class: 'mrows' }, [
      ...FEELING_KEYS.map((key, i) => meterRow(key, d.meters?.[key], i, { stage: d.axisStages?.[key] })),
      ...(d.extraMeters ?? []).map((m, i) => meterRow(m.key, m.value, FEELING_KEYS.length + i, m)),
    ]),
    stage ? pageSection(`Stage · ${stage.now}${stage.next ? ` → ${stage.next}` : ''}`, stage.needs ? h('p', { class: 'fine' }, `needs ${stage.needs}`) : null) : null,
    pageSection('Changes with you', d.changes?.length ? h('div', { class: 'tl2' }, d.changes.map(changeRow)) : h('p', { class: 'fine' }, 'Nothing has changed yet.')),
  ].filter(Boolean);
}
