// Renders the Tools page's "What is sent each reply" card (budget bars and the text sent) and the Inspector and problems card; its two buttons open those through `open`.
import { h } from '../kit/dom.js';
import { renderRow } from './fields.js';

const fmt = n => Number(n).toLocaleString('en-US');

function bar(b) {
  const pct = b.cap ? Math.min(100, (b.used / b.cap) * 100) : 60;
  return h('div', { class: 'brow2' }, h('span', b.name), h('i', h('b', { style: { width: `${pct}%`, background: b.color } })),
    h('span', `${fmt(b.used)}${b.cap ? ` / ${fmt(b.cap)}` : ''}`));
}

/** Builds the two Tools cards from the `sent` view-model; `numbers` are the three budget rows, `ctx` the row context, `open` = { Inspector(), Problems() }. */
export function renderSent(sent, numbers, ctx, open = {}) {
  const card = h('div', { class: 'sgrp' }, h('div', { class: 'gt' }, 'What is sent each reply'),
    h('div', { class: 'budget', style: { padding: '6px 0 10px' } }, sent.budget.map(bar)),
    numbers.map(r => renderRow(r, ctx)),
    h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('b', 'The text sent with this reply')), h('pre', { class: 'sent' }, sent.text)));
  const tools = h('div', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Inspector and problems'),
    sent.tools.map(t => h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', t.label), h('small', t.hint)),
      h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2', onClick: () => open[t.label]?.() }, t.button)))));
  return [card, tools];
}
