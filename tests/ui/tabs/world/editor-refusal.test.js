// The World editor (W2): a refused edit keeps the sheet open and shows the engine's reason; a kept one closes it and redraws.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { openWorldEditor } from '../../../../ui/tabs/world/editor.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

function open(answer) {
  installFakeDom();
  const sent = [];
  let refreshed = 0;
  const ctx = { command: (type, payload) => { sent.push([type, payload]); return Promise.resolve(answer); }, refresh: () => { refreshed += 1; } };
  const sheet = openWorldEditor(ctx, { kind: 'faction', id: 'f1', current: { name: 'Salt Guild' } });
  const form = sheet.body.querySelector('.wsheet');
  form.querySelector('input').value = 'Iron Guild';
  form.querySelector('.save').click();
  return { sent, form, refreshed: () => refreshed };
}

test('a refused edit stays open and says why; nothing is redrawn', async () => {
  const { sent, form, refreshed } = open({ ok: false, message: 'There is already a faction called Iron Guild.' });
  await flush();
  assert.deepEqual(sent, [['chronicle.edit', { id: 'f1', name: 'Iron Guild' }]]);
  const note = form.querySelector('.err');
  assert.equal(note.hasAttribute('hidden'), false);
  assert.equal(note.textContent, 'There is already a faction called Iron Guild.');
  assert.equal(refreshed(), 0);
});

test('a kept edit closes the sheet and redraws', async () => {
  const { form, refreshed } = open({ ok: true });
  await flush();
  assert.equal(form.querySelector('.err').hasAttribute('hidden'), true);
  assert.equal(refreshed(), 1);
});
