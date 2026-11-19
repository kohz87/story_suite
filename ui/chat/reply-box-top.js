// Builds the top of a reply's card: (1) time · place · weather, (2) HP · MP · SP with short bars and this reply's change, (3) the reader's condition.
import { h } from '../kit/dom.js';

const NAMES = { hp: 'HP', mp: 'MP', sp: 'SP' };
const pct = (value, max) => `${Math.max(0, Math.min(100, (100 * value) / max))}%`;

function item(icon, text, cls) {
  return h('span', { class: ['it', cls] }, h('i', { 'aria-hidden': 'true' }, icon), ' ', text);
}

// One pool: its name, a short bar (the faint part is where it was before this reply), the value and the change beside it.
function pool(row) {
  const moved = Number.isFinite(row.before);
  const diff = moved ? row.value - row.before : 0;
  const label = `${NAMES[row.kind]} ${row.value} of ${row.max}${moved ? `, ${diff > 0 ? 'up' : 'down'} ${Math.abs(diff)} this reply` : ''}`;
  return h(
    'span',
    { class: ['vb', row.kind], role: 'img', 'aria-label': label, dataset: { pool: row.kind } },
    h('b', NAMES[row.kind]),
    h('span', { class: 'bar' }, moved ? h('u', { style: { width: pct(row.before, row.max) } }) : null, h('i', { style: { width: pct(row.value, row.max) } })),
    h('span', { class: 'v' }, `${row.value}/${row.max}`),
    moved && diff ? h('span', { class: ['d', diff > 0 ? 'up' : null] }, `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`) : null,
  );
}

/** The top lines of a reply's card from its `top` ({ date, time, place, weather, pools, condition }): each line only when it has something. */
export function replyBoxTop(top = {}) {
  const when = [top.date, top.time].filter(Boolean).join(' · ');
  const one = [when ? item('🕐', when, 'tm') : null, top.place ? item('📍', top.place, 'pl') : null, top.weather ? item('☁', top.weather, 'wx') : null].filter(Boolean);
  const pools = Array.isArray(top.pools) ? top.pools.filter(row => NAMES[row?.kind]) : [];
  return [
    one.length ? h('div', { class: 'ssrc-l1' }, one) : null,
    pools.length ? h('div', { class: 'ssrc-l2' }, pools.map(pool)) : null,
    top.condition ? h('div', { class: 'ssrc-l3' }, h('b', 'Condition:'), ' ', top.condition) : null,
  ].filter(Boolean);
}
