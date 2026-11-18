// The Tools page's Save points card: this chat's named branches (name, message, date), Save point, Return here and Forget. Drawn only while the feature is on.
import { h } from '../kit/dom.js';

/**
 * Builds the card from the `savepoints` view (`{ rows, full, max }`, or null while the feature is off: no card).
 * `state` = { naming, busy, note, setNaming(bool), make(name), back(id), forget(id) }.
 */
export function renderSavePoints(view, state) {
  if (!view) return null;
  const rows = view.rows.map(p => h('div', { class: 'srow', dataset: { savepoint: p.id } },
    h('span', { class: 'lb' }, h('b', p.name), h('small', [Number.isInteger(p.reply) ? `Message ${p.reply}` : '', p.date].filter(Boolean).join(' · '))),
    h('span', { class: 'ctl' },
      p.here ? h('small', 'You are here') : h('button', { type: 'button', class: 'btn2', disabled: state.busy, title: 'Open the branch made at this save point', onClick: () => state.back(p.id) }, 'Return here'),
      h('button', { type: 'button', class: 'btn2 dng', disabled: state.busy, title: 'Take this save point off the list (the branch itself is kept in SillyTavern)', onClick: () => state.forget(p.id) }, 'Forget'))));
  const name = h('input', { type: 'text', class: 'txt2', maxlength: String(view.max.name), placeholder: `Save point ${view.rows.length + 1}`, 'aria-label': 'Save point name' });
  const submit = () => state.make(name.value);
  name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } else if (e.key === 'Escape') state.setNaming(false); });
  const form = state.naming ? h('div', { class: 'srow', dataset: { key: 'tools.savepoint.name' } }, h('span', { class: 'lb' }, name),
    h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2', disabled: state.busy, onClick: submit }, 'Save'), h('button', { type: 'button', class: 'btn2', onClick: () => state.setNaming(false) }, 'Cancel'))) : null;
  const head = h('div', { class: 'srow', dataset: { key: 'tools.savepoint.make' } },
    h('span', { class: 'lb' }, h('b', 'Keep this moment'), h('small', state.note || (view.full ? 'This chat has the most save points it keeps; forget one first.' : 'A named branch of this chat you can come back to'))),
    h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2', disabled: state.busy || state.naming || view.full, onClick: () => state.setNaming(true) }, 'Save point')));
  return h('div', { class: 'sgrp', dataset: { card: 'savepoints' } }, h('div', { class: 'gt' }, 'Save points'), head, form, rows.length ? rows : h('p', { class: 'fine' }, 'No save points in this chat yet.'));
}
