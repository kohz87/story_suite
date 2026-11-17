import test from 'node:test';
import assert from 'node:assert/strict';
import { trackerCommand } from '../../../ui/port/trackers.js';
import { createSbPort } from '../../../ui/port/sb-port.js';

function sdk(rows) {
  const calls = [];
  return { calls, query: name => (name === 'dataModules.setup' ? rows : null), command: async (type, payload) => { calls.push([type, payload]); return { ok: true }; } };
}
const ROWS = [
  { module: 'debt', pinned: true, packId: 'chat', pinnedDefinition: { id: 'chat:debt', pack: 'chat', name: 'Chapel debt', scope: 'chat', show: { tab: true, card: false, tabName: 'Debt', icon: 'x' }, state: {} }, definition: { name: 'offer' } },
  { module: 'stock', pinned: true, packId: 'pack', pinnedDefinition: { name: 'Stock', scope: 'chat', state: {} } },
];

test('Show on Now redefines the pinned block with show.card set and the tab kept', async () => {
  const s = sdk(ROWS);
  await trackerCommand(s, 'tracker.pin', { id: 'debt', on: true });
  const [type, payload] = s.calls[0];
  assert.equal(type, 'dm.redefine');
  assert.equal(payload.module, 'debt');
  assert.deepEqual(payload.definition.show, { tab: true, card: true, tabName: 'Debt', icon: 'x' });
  assert.equal('id' in payload.definition, false);
  await trackerCommand(s, 'tracker.pin', { id: 'stock', on: false });
  assert.equal(s.calls[1][1].definition.show.card, false);
  assert.equal(s.calls[1][1].definition.show.tab, false);
});

test('set writes the fields in one dm.set; remove only for a block this chat made', async () => {
  const s = sdk(ROWS);
  await trackerCommand(s, 'tracker.set', { id: 'debt', fields: { owed: 5 } });
  assert.deepEqual(s.calls[0], ['dm.set', { module: 'debt', fields: { owed: 5 } }]);
  await trackerCommand(s, 'tracker.remove', { id: 'debt' });
  assert.deepEqual(s.calls[1], ['dm.remove', { module: 'debt' }]);
  assert.equal((await trackerCommand(s, 'tracker.remove', { id: 'stock' })).ok, false);
  assert.equal(s.calls.length, 2);
});

test('add builds the starter under a free slug, hidden from Now and tabs; unknown template refused', async () => {
  const s = sdk([{ module: 'reputation', pinned: true, packId: 'chat', pinnedDefinition: {} }]);
  assert.equal((await trackerCommand(s, 'tracker.add', { template: 'nope' })).ok, false);
  const answer = await trackerCommand(s, 'tracker.add', { template: 'reputation' });
  assert.equal(answer.ok, true);
  const [type, { definition }] = s.calls[0];
  assert.equal(type, 'dm.define');
  assert.notEqual(definition.slug, 'reputation');
  assert.equal(definition.show.card, false);
  assert.equal(definition.show.tab, false);
});

test('the port routes tracker.* here, tells listeners, and leaves other commands alone', async () => {
  const s = sdk(ROWS);
  const port = createSbPort({ sdk: s });
  let heard = 0;
  port.on('interaction', () => { heard += 1; });
  await port.command('tracker.set', { id: 'debt', fields: { a: 1 } });
  assert.equal(heard, 1);
  assert.equal(await trackerCommand(s, 'quest.edit', {}), null);
  assert.equal((await trackerCommand({}, 'tracker.pin', {})).ok, false);
});
