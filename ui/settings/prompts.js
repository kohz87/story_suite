// The Tools page's Prompts card: each People prompt and the arc planner prompt, with Read and edit (a box to change it, Save or Cancel) and Reset to default.
import { h } from '../kit/dom.js';

/**
 * Builds the card from the `prompts` view ({ rows: [{ id, key, label, hint, text, own }] }, or null: no card).
 * `state` = { open (the id being edited, or null), draft ({ id: text typed so far }), busy, notes ({ id: the last answer }), setOpen(id | null), type(id, text), save(id), reset(id) }.
 */
export function renderPrompts(view, state) {
  if (!view?.rows?.length) return null;
  const rows = view.rows.flatMap(p => {
    const open = state.open === p.id;
    const note = state.notes?.[p.id] || `${p.hint}${p.own ? ' · your own text' : ''}`;
    const head = h('div', { class: 'srow', dataset: { key: p.key } },
      h('span', { class: 'lb' }, h('b', p.label), h('small', note)),
      h('span', { class: 'ctl' },
        h('button', { type: 'button', class: 'btn2', 'aria-expanded': open ? 'true' : 'false', onClick: () => state.setOpen(open ? null : p.id) }, open ? 'Close' : 'Read and edit'),
        h('button', { type: 'button', class: 'btn2', disabled: state.busy || !p.own, title: p.own ? 'Put the built-in text back' : 'This is the built-in text', onClick: () => state.reset(p.id) }, 'Reset to default')));
    if (!open) return [head];
    const draft = Object.hasOwn(state.draft ?? {}, p.id) ? state.draft[p.id] : p.text;
    const box = h('textarea', { class: 'txt2', rows: '12', spellcheck: 'false', 'aria-label': p.label, value: draft });
    box.addEventListener('input', () => state.type(p.id, box.value));
    const edit = h('div', { class: 'srow', dataset: { key: `${p.key}.edit` } },
      h('span', { class: 'lb' }, box),
      h('span', { class: 'ctl' },
        h('button', { type: 'button', class: 'btn2', disabled: state.busy, onClick: () => { state.type(p.id, box.value); state.save(p.id); } }, 'Save'),
        h('button', { type: 'button', class: 'btn2', onClick: () => state.setOpen(null) }, 'Cancel')));
    return [head, edit];
  });
  return h('div', { class: 'sgrp', dataset: { card: 'prompts' } }, h('div', { class: 'gt' }, 'Prompts'), rows);
}
