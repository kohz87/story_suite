// Draws the dossier hero ring with its four corner numbers and builds the "With you" part (the last changes with their reply and date, then the meters and stage).
import { h } from '../../../kit/dom.js';
import { feelingsRing, FEELING_KEYS } from '../../../kit/ring.js';
import { portraitDisc } from '../person-card.js';
import { pageSection } from '../../../kit/page.js';
import { eventRow } from './reply-words.js';

const CORNERS = Object.freeze(['c-tr', 'c-br', 'c-bl', 'c-tl']);
const cap = text => text[0].toUpperCase() + text.slice(1);
const signed = n => (n > 0 ? `+${n}` : String(n));

/** Builds the big portrait with the ring, the four corner numbers and the Profile › button; a tap on the portrait opens the Profile too (where a tablet or desktop window shows the portrait full size in its column: owner, 20 Nov); the dead get the portrait only. */
export function feelingsHero(d, { onProfile } = {}) {
  const dead = d.life !== 'alive';
  const prof = h('span', { class: 'prof', role: 'button', tabindex: '0', dataset: { act: 'profile' }, onClick: e => { e.stopPropagation?.(); onProfile?.(); },
    onKeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault?.(); e.stopPropagation?.(); onProfile?.(); } } }, 'Profile ›');
  const disc = h('button', { type: 'button', class: 'bigph', 'aria-label': `${d.name}: Profile`, dataset: { act: 'profile' }, onClick: () => onProfile?.() },
    portraitDisc(d, 'ph'), prof);
  return h('div', { class: ['bigring', dead ? 'dead' : null] },
    dead ? null : feelingsRing(d.meters, { width: 2.6, pad: 2, ticks: true }),
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

// One change: "Trust +2 · why"; a held-back move in amber ("Desire +1 held back") with the recorded Why under it when there is one.
function changeRow(c) {
  const i = Math.max(0, FEELING_KEYS.indexOf(c.meter));
  const move = `${cap(c.meter)} ${signed(c.delta)}`;
  const row = eventRow(c.reply, c.date, c.heldBack ? h('span', { class: 'held' }, `${move} held back`) : h('b', { class: `f${i}` }, move), c.why ? ` · ${c.why}` : null,
    c.note ? h('span', { class: 'why' }, h('b', null, 'Why:'), ` ${c.note}`) : null);
  row.dataset.meter = c.meter;
  return row;
}

/** Builds the part: every change (newest first) with its date and reply, then the four meter bars (each with its stage word once reached), the reader's own feelings, and the stage with what it needs. */
export function withPage(d) {
  const stage = d.stage;
  return [
    pageSection('Last changes', d.changes?.length ? h('div', { class: 'evs' }, d.changes.map(changeRow)) : h('p', { class: 'fine' }, 'Nothing has changed yet.')),
    pageSection('Feelings', h('div', { class: 'mrows' }, [
      ...FEELING_KEYS.map((key, i) => meterRow(key, d.meters?.[key], i, { stage: d.axisStages?.[key] })),
      ...(d.extraMeters ?? []).map((m, i) => meterRow(m.key, m.value, FEELING_KEYS.length + i, m)),
    ])),
    stage ? pageSection(`Stage · ${stage.now}${stage.next ? ` → ${stage.next}` : ''}`, stage.needs ? h('p', { class: 'fine' }, `needs ${stage.needs}`) : null) : null,
  ].filter(Boolean);
}
