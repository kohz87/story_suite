// Builds the Coming up card: the next 30 days grouped overdue first, each row picking its day.
import { h } from '../../kit/dom.js';

const GROUPS = [['late', 'Overdue'], ['soon', 'Tomorrow'], ['week', 'This week']];

function laterLabel(journal) {
  const today = journal.calendar?.today?.month;
  const later = journal.upcoming.filter(u => u.group === 'later');
  return later.every(u => u.month === today) ? 'Later this month' : 'Later';
}

function upRow(u, onPick) {
  return h(
    'button',
    { type: 'button', class: 'up', dataset: { sel: `${u.month},${u.day}` }, onClick: () => onPick?.(u.month, u.day) },
    h('span', { class: ['ti', `tone-${u.tone}`] }, u.glyph),
    h('span', { class: 'upx' }, h('b', null, u.name), h('small', null, `${u.date} · ${u.kind}`)),
    h('span', { class: ['rel', u.group === 'soon' || u.group === 'late' ? u.group : null] }, u.rel),
  );
}

/** Builds the Coming up card, or null when nothing falls in the next 30 days; `onPick(month, day)` selects that day. */
export function comingUp(journal, { onPick } = {}) {
  if (!Array.isArray(journal?.upcoming) || !journal.upcoming.length) return null;
  const groups = [...GROUPS, ['later', laterLabel(journal)]];
  const parts = [];
  for (const [id, label] of groups) {
    const rows = journal.upcoming.filter(u => u.group === id);
    if (!rows.length) continue;
    parts.push(h('div', { class: 'ugrp' }, label), rows.map(u => upRow(u, onPick)));
  }
  return h(
    'section',
    { class: 'card glass', dataset: { card: 'coming-up' } },
    h('div', { class: 'ch' }, h('h3', null, 'Coming up'), h('span', { class: 'cnt' }, 'next 30 days')),
    parts,
  );
}
