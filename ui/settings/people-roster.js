// Settings › People › People in this chat: NPC State's roster as a list. Open goes to the person's dossier, Re-read runs NPC State's Refresh for them. Removing a person stays on the dossier's ⋯ menu (it asks twice there).
import { h } from '../kit/dom.js';

const state = person => [person.present ? 'in the scene' : null, person.followed ? 'followed' : null, person.dormant ? 'dormant' : null, person.deceased ? 'deceased' : null].filter(Boolean).join(' · ');

/**
 * Builds the group. `roster` = the `roster` view ({ people }) or null; `ctx` = the overlay's { onAction, repaint }; `note` = the last Re-read's answer.
 * Open asks `people.open` ({ id, name }), Re-read asks `people.reread` ({ name }); the page is drawn again with the answer in `note`.
 */
export function renderRoster(roster, ctx, note = { text: '', set: () => {} }) {
  const people = roster?.people ?? [];
  const ask = (key, value) => Promise.resolve(ctx.onAction?.(key, value));
  const reread = person => {
    note.set(`Re-reading the recent story for ${person.name}…`);
    ctx.repaint?.();
    ask('people.reread', { name: person.name }).then(answer => note.set(answer?.ok === false ? String(answer.message ?? 'It did not run.') : String(answer?.message ?? 'Re-read.')),
      error => note.set(String(error?.message ?? error))).finally(() => ctx.repaint?.());
  };
  return h('div', { class: 'sgrp', dataset: { card: 'roster' } }, h('div', { class: 'gt' }, 'People in this chat'),
    people.length === 0
      ? h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('small', 'Nobody yet. People appear here once the story has named them.')))
      : people.map(person => h('div', { class: 'srow', dataset: { person: person.id } },
        h('span', { class: 'lb' }, h('b', person.name), state(person) ? h('small', state(person)) : null),
        h('span', { class: 'ctl' },
          h('button', { type: 'button', class: 'btn2', dataset: { act: 'open' }, onClick: () => ask('people.open', { id: person.id, name: person.name }) }, 'Open'),
          h('button', { type: 'button', class: 'btn2', dataset: { act: 'reread' }, onClick: () => reread(person) }, 'Re-read')))),
    note.text ? h('div', { class: 'srow', dataset: { note: 'roster' } }, h('span', { class: 'lb' }, h('small', note.text))) : null);
}
