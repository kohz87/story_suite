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
    dead ? null : feelingsRing(d.meters, { width: 6 }),
    disc,
    dead ? null : FEELING_KEYS.map((key, i) => h('span', { class: ['ml', CORNERS[i], `f${i}`], dataset: { meter: key } },
      h('b', null, signed(Number(d.meters?.[key]) || 0)), key.toUpperCase())));
}

function meterRow(key, value, i) {
  const v = Number(value) || 0;
  const bar = h('b', { class: `fill f${i}`, style: { left: `${v < 0 ? 50 + v / 2 : 50}%`, width: `${Math.min(Math.abs(v), 100) / 2}%` } });
  return h('div', { class: 'mrow', dataset: { meter: key } }, h('span', { class: `f${i}` }, cap(key)), h('i', null, bar), h('b', null, signed(v)));
}

function changeRow(c) {
  const i = Math.max(0, FEELING_KEYS.indexOf(c.meter));
  return h('div', { class: 'e', dataset: { meter: c.meter } }, h('span', null, c.date),
    h('span', null, h('b', { class: `f${i}` }, `${cap(c.meter)} ${signed(c.delta)}`), ` · ${c.why}`, c.heldBack ? h('small', { class: 'held' }, ' · held back') : null));
}

/** Builds the page body: four meter bars, the stage with what it needs, and every change; `youName` words the title only. */
export function withPage(d) {
  const stage = d.stage;
  return [
    h('div', { class: 'mrows' }, FEELING_KEYS.map((key, i) => meterRow(key, d.meters?.[key], i))),
    stage ? pageSection(`Stage · ${stage.now}${stage.next ? ` → ${stage.next}` : ''}`, stage.needs ? h('p', { class: 'fine' }, `needs ${stage.needs}`) : null) : null,
    pageSection('Changes with you', d.changes?.length ? h('div', { class: 'tl2' }, d.changes.map(changeRow)) : h('p', { class: 'fine' }, 'Nothing has changed yet.')),
  ].filter(Boolean);
}
