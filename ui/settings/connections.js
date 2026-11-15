// Renders the Models page's three connection cards (Story, Quick helpers, Background) and the "Who goes first" note.
import { h } from '../kit/dom.js';

function card(c, tested, onTest, onPick) {
  const picker = c.readOnly
    ? h('span', { class: 'sel2', style: { display: 'flex', 'align-items': 'center', opacity: '.8' } }, `${c.choice} · read-only`)
    : h('select', { class: 'sel2', 'aria-label': `${c.name} connection`, onChange: e => onPick(c.id, e.target.value) }, h('option', c.choice));
  const note = tested ? (c.testSeconds ? `answered in ${c.testSeconds} s` : 'answered') : 'one tiny call';
  return h('div', { class: 'cn' }, h('b', c.name), h('small', { class: 'cdesc' }, c.desc), picker,
    h('span', { class: 'tst2' }, h('button', { type: 'button', class: 'btn2', onClick: () => onTest(c.id) }, 'Test'), h('small', note)),
    h('span', { class: 'usesw' }, h('span', { class: 'ul' }, 'Used for'), h('span', { class: 'uses' }, c.usedFor.map(u => h('span', u)))));
}

/** Builds the Models page body: `state` = { connections, tested: Set, test(id), pick(id, value) }. */
export function renderConnections(state) {
  const { connections, tested, test, pick } = state;
  return [
    h('div', { class: 'conn' }, connections.map(c => card(c, tested.has(c.id), test, pick))),
    h('div', { class: 'scope' }, h('span', 'Who goes first'),
      h('small', 'Calls the reply waits on (the check roll before the reply, fight set-up, cast moves) go ahead of planner work on the same connection, and arc plans never start while a reply is being sent. One call at a time per connection still holds.')),
  ];
}
