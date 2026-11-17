import test from 'node:test';
import assert from 'node:assert/strict';
import { packsCommand } from '../../../ui/port/packs.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { createInstalled } from '../../../packs/installed.js';
import { fakeSettings } from '../../packs/helpers/fake-settings.js';
import { sampleText } from '../../packs/helpers/fixtures.js';

const file = (name, text) => ({ name, size: text.length, text: async () => text });
const set = (key, value) => ({ key, value });

function make(rows = []) {
  const settings = fakeSettings();
  const packs = createInstalled({ settings });
  const sent = [];
  const sdk = { query: name => (name === 'dataModules.setup' ? rows : null), command: async (type, payload) => { sent.push([type, payload]); return { ok: true }; } };
  const handle = { packs, readLorebook: async () => ({ character: 'Mara', entries: [], problem: '' }) };
  return { packs, handle, sdk, sent, settings };
}

test('Import installs the picked pack file the way the old panel does and says so', async () => {
  const { handle, sdk, packs } = make();
  const done = await packsCommand(handle, sdk, 'settings.action', set('packs.import', [file('riverside.json', sampleText)]));
  assert.deepEqual([done.ok, done.text], [true, 'Installed Riverside Starter.']);
  assert.equal(packs.list().length, 1);
  const bad = await packsCommand(handle, sdk, 'settings.action', set('packs.import', [file('x.json', '{"nope":1}')]));
  assert.deepEqual([bad.ok, bad.text], [false, 'x.json was not imported.']);
  assert.equal((await packsCommand(handle, sdk, 'settings.action', set('packs.import', []))).ok, false);
});

test('the switch writes the pack\'s enabled flag the old switch writes; Remove takes the pack out', async () => {
  const { handle, sdk, packs } = make();
  await packsCommand(handle, sdk, 'settings.action', set('packs.import', [file('r.json', sampleText)]));
  const id = packs.list()[0].id;
  assert.deepEqual(await packsCommand(handle, sdk, 'settings.set', set(`packs.on.${id}`, false)), { ok: true });
  assert.equal(packs.list()[0].enabled, false);
  await packsCommand(handle, sdk, 'settings.set', set(`packs.on.${id}`, true));
  assert.equal(packs.list()[0].enabled, true);
  assert.equal((await packsCommand(handle, sdk, 'settings.set', set('packs.on.nope', true))).ok, false);
  const gone = await packsCommand(handle, sdk, 'settings.action', set('packs.remove', id));
  assert.equal(gone.text, 'Removed Riverside Starter.');
  assert.equal(packs.list().length, 0);
});

test('the lorebook button reads the character\'s lorebook through the same path', async () => {
  const { handle, sdk } = make();
  const done = await packsCommand(handle, sdk, 'settings.action', set('packs.lorebook'));
  assert.match(done.text, /No lorebook entry of Mara is tagged/);
});

test('a data module is used in this chat with dm.pin and the hashes read now; it has no way off', async () => {
  const row = { module: 'court', hash: 'h1', packHash: 'p1', pinned: false, available: true };
  const { handle, sdk, sent } = make([row]);
  assert.deepEqual(await packsCommand(handle, sdk, 'settings.set', set('packs.module.court', true)), { ok: true });
  assert.deepEqual(sent, [['dm.pin', { module: 'court', hash: 'h1', packHash: 'p1', subjects: [] }]]);
  assert.equal((await packsCommand(handle, sdk, 'settings.set', set('packs.module.court', false))).ok, false);
  assert.equal((await packsCommand(handle, make([{ ...row, pinned: true }]).sdk, 'settings.set', set('packs.module.court', true))).ok, false);
});

test('other commands are not the Packs page\'s, and the port routes the page\'s to the handle', async () => {
  const { handle, sdk } = make();
  assert.equal(await packsCommand(handle, sdk, 'settings.set', set('host.tailBudget', 1)), null);
  assert.equal(await packsCommand(handle, sdk, 'suite.go', {}), null);
  const port = createSbPort({ sdk: { ...sdk, command: async () => ({ ok: false }) }, packs: handle });
  const done = await port.command('settings.action', set('packs.import', [file('r.json', sampleText)]));
  assert.equal(done.text, 'Installed Riverside Starter.');
});
