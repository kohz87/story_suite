// Renders the Models section: three connection cards (choice, Test, used for), the call-order note, then the call rows.
import { h } from '../../kit/dom.js';
import { sectionFrame } from './start.js';

function card(conn, ctx) {
  const pick = conn.readOnly
    ? h('span', { class: 'sel2', style: 'display:flex;align-items:center;opacity:.8' }, `${conn.choice} · read-only`)
    : h('select', { class: 'sel2', 'aria-label': `${conn.name} connection` },
      [conn.choice, ...(conn.options ?? []).filter(o => o !== conn.choice)].map(o => h('option', { value: o, selected: o === conn.choice }, o)));
  if (!conn.readOnly) pick.addEventListener('change', () => ctx.onChange?.(`connections.${conn.id}.choice`, pick.value, null));
  const note = h('small', 'one tiny call');
  const test = h('button', { type: 'button', class: 'btn2', dataset: { test: conn.id }, onClick: () => {
    note.textContent = 'testing…';
    Promise.resolve(ctx.onAction?.(`connections.${conn.id}.test`, 'Test', null)).then((secs) => {
      note.textContent = typeof secs === 'number' ? `answered in ${secs} s` : 'one tiny call';
    });
  } }, 'Test');
  return h('div', { class: 'cn', dataset: { conn: conn.id } },
    h('b', conn.name), h('small', { class: 'cdesc' }, conn.desc), pick,
    h('span', { class: 'tst2' }, test, note),
    h('span', { class: 'usesw' }, h('span', { class: 'ul' }, 'Used for'), h('span', { class: 'uses' }, (conn.usedFor ?? []).map(u => h('span', u)))));
}

/** Returns the Models page nodes: one card per connection in `ctx.settings.connections`, the priority note, then the section's rows. */
export function renderModelsSection(section, ctx) {
  const conns = ctx.settings?.connections ?? [];
  const before = [];
  if (conns.length > 0) {
    before.push(h('div', { class: 'conn' }, conns.map(c => card(c, ctx))));
    before.push(h('div', { class: 'scope' }, h('span', 'Who goes first'),
      h('small', 'Calls the reply waits on (the check roll before the reply, fight set-up, cast moves) go ahead of planner work on the same connection, and arc plans never start while a reply is being sent. One call at a time per connection still holds.')));
  }
  return sectionFrame(section, ctx, { before });
}
