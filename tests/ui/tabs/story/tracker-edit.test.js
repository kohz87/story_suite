import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { createBackStack } from '../../../../ui/runtime/back-stack.js';
import { createFakePort } from '../../../../ui/port/fake-port.js';
import { buildStory } from '../../../../ui/fixtures/story.js';
import { trackersView } from '../../../../ui/tabs/story/trackers.js';
import { trackerPatch } from '../../../../ui/tabs/story/tracker-edit.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const open = () => globalThis.document.body.querySelector('.sh-ov');
const sent = port => port.recorded.map(r => [r.type, r.payload]);
function setup() {
  installFakeDom();
  const port = createFakePort();
  const refreshed = [];
  const ctx = { command: (t, p) => port.command(t, p), backStack: createBackStack(), refresh: () => refreshed.push(1) };
  const view = trackersView(buildStory(), ctx);
  const card = id => view.querySelectorAll('[data-card="tracker"]').find(c => c.dataset.trackerId === id);
  return { port, refreshed, card };
}

test('Edit opens a sheet with the editable fields; Save sends only the changed values', async () => {
  const { port, card, refreshed } = setup();
  card('ships-stores').querySelector('[data-act="edit"]').click();
  assert.equal(open().querySelectorAll('.ef').length, 2);
  open().querySelector('[data-field="water"] input').value = '9';
  open().querySelector('.save').click();
  await flush();
  assert.deepEqual(sent(port), [['tracker.set', { id: 'ships-stores', fields: { water: 9 } }]]);
  assert.equal(open(), null);
  assert.equal(refreshed.length, 1);
});

test('Save with nothing changed sends nothing; a number outside its limits stays open with a message', async () => {
  const { port, card } = setup();
  card('ships-stores').querySelector('[data-act="edit"]').click();
  open().querySelector('.save').click();
  await flush();
  assert.deepEqual(sent(port), []);
  assert.equal(open(), null);
  card('ships-stores').querySelector('[data-act="edit"]').click();
  open().querySelector('[data-field="water"] input').value = '11';
  open().querySelector('.save').click();
  await flush();
  assert.match(open().textContent, /Water must be a whole number from 0 to 10/);
  assert.deepEqual(sent(port), []);
});

test('Remove asks first, then sends tracker.remove; a pack tracker has no Remove', async () => {
  const { port, card } = setup();
  card('ships-stores').querySelector('[data-act="edit"]').click();
  assert.equal(open().querySelector('.cfm').hasAttribute('hidden'), true);
  open().querySelector('.remove').click();
  assert.equal(open().querySelector('.cfm').hasAttribute('hidden'), false);
  open().querySelector('.remove-yes').click();
  await flush();
  assert.deepEqual(sent(port), [['tracker.remove', { id: 'ships-stores' }]]);
  card('chapel-debt').querySelector('[data-act="edit"]').click();
  assert.equal(open().querySelector('.remove'), null);
});

test('trackerPatch compares a choice and text with the stored value', () => {
  const t = { fields: [{ key: 'm', label: 'M', edit: 'choice', raw: 'a' }, { key: 't', label: 'T', edit: 'text', raw: 'x' }] };
  assert.deepEqual(trackerPatch(t, { m: 'a', t: 'x' }), { fields: {} });
  assert.deepEqual(trackerPatch(t, { m: 'b', t: 'y' }), { fields: { m: 'b', t: 'y' } });
});

test('Add from a template lists the templates and sends tracker.add; a refusal keeps the sheet open', async () => {
  const { port, card } = setup();
  installFakeDom();
  const p2 = createFakePort();
  const ctx = { command: async (t, p) => (t === 'tracker.add' && p.template === 'reputation' ? { ok: false, message: 'Full.' } : p2.command(t, p)), backStack: createBackStack(), refresh() {} };
  const view = trackersView(buildStory(), ctx);
  view.querySelector('[data-act="add"]').click();
  assert.equal(open().querySelectorAll('[data-template]').length, 3);
  open().querySelector('[data-template="reputation"] .add').click();
  await flush();
  assert.match(open().textContent, /Full\./);
  open().querySelector('[data-template="quest-log"] .add').click();
  await flush();
  assert.deepEqual(sent(p2), [['tracker.add', { template: 'quest-log' }]]);
  assert.equal(open(), null);
  assert.ok(port && card);
});
