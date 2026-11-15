// Draws the three equal Health, Mana and Stamina bars and the thin EXP bar of the character card.
import { h } from './dom.js';

const LABELS = { hp: 'Health', mp: 'Mana', sp: 'Stamina' };

function pct(value, max) {
  const v = Number(value);
  const m = Number(max);
  if (!Number.isFinite(v) || !Number.isFinite(m) || m <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((v / m) * 100)));
}

function fill(kind, value, max) {
  return h('b', { class: `fill ${kind}`, style: { width: `${pct(value, max)}%` } });
}

/** Builds the grid of equal bars (kind hp, mp or sp), or null when there are none. */
export function bars(list) {
  const rows = Array.isArray(list) ? list.filter(b => b && LABELS[b.kind]) : [];
  if (!rows.length) return null;
  return h(
    'div',
    { class: 'bars3', role: 'group', 'aria-label': 'Health, mana and stamina' },
    rows.map(b => h(
      'div',
      { class: `bar-${b.kind}`, dataset: { kind: b.kind } },
      h('span', LABELS[b.kind], ' ', h('b', `${b.value}/${b.max}`)),
      h('i', fill(b.kind, b.value, b.max)),
    )),
  );
}

/** Builds the thin accent EXP bar, or null when there is no EXP data. */
export function expBar(exp) {
  if (!exp || !Number.isFinite(Number(exp.max)) || Number(exp.max) <= 0) return null;
  return h(
    'div',
    { class: 'xpbar', role: 'img', 'aria-label': `EXP ${exp.value} of ${exp.max}` },
    h('i', fill('exp', exp.value, exp.max)),
  );
}
