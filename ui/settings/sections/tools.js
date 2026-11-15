// Renders the Tools section: the "what is sent" budget bars and sent text, the Inspector and Problems card, then prompts, chat data and diagnostics.
import { h } from '../../kit/dom.js';
import { sectionFrame } from './start.js';

const fmt = n => Number(n).toLocaleString('en-US');

function budgetBars(rows) {
  return h('div', { class: 'budget', style: 'padding:6px 0 10px' }, rows.map((r) => {
    const pct = r.cap ? Math.min(100, Math.round((r.used / r.cap) * 100)) : 60;
    return h('div', { class: 'brow2' }, h('span', r.label),
      h('i', h('b', { style: { width: `${pct}%`, background: r.color ?? 'var(--su-accent)' } })),
      h('span', fmt(r.used), r.cap ? ` / ${fmt(r.cap)}` : ''));
  }));
}

function sentCard(sent) {
  return h('div', { class: 'sgrp', dataset: { card: 'sent' } }, h('div', { class: 'gt' }, 'What is sent each reply'),
    sent.rows?.length ? budgetBars(sent.rows) : null,
    sent.text ? h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('b', 'The text sent with this reply')), h('pre', { class: 'sent' }, sent.text)) : null);
}

function inspectorCard(info, ctx) {
  const act = (key, label) => () => ctx.onAction?.(key, label, null);
  return h('div', { class: 'sgrp', dataset: { card: 'inspector' } }, h('div', { class: 'gt' }, 'Inspector and problems'),
    h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', 'Inspector'), h('small', 'Every change of a reply: lines, what code did, the state after; older and newer replies')),
      h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2', onClick: act('tools.inspector', 'Open') }, 'Open'))),
    h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', 'Problems'), info.problems ? h('small', info.problems) : null),
      h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2', onClick: act('tools.problems', 'Show') }, 'Show'))));
}

/** Returns the Tools page nodes; `ctx.settings.sent` ({ rows, text }) and `ctx.settings.problems` (a line) are optional and hide their card when missing. */
export function renderToolsSection(section, ctx) {
  const sent = ctx.settings?.sent;
  const before = [];
  if (sent && (sent.rows?.length || sent.text)) before.push(sentCard(sent));
  before.push(inspectorCard({ problems: ctx.settings?.problems ?? null }, ctx));
  return sectionFrame(section, ctx, { before });
}
