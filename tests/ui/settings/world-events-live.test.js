// The World events rows on the World and time page, on a live host: the switch is the feature (off by default), Tempo is the engine's setting
// (0.25-4 held, text like the map's scales), the Director calls count is read only; a reset puts them back; nothing else on the page moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { storyDirectorModule } from '../../../modules/director/module.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../ui/contract/settings.js';
import { WORLD_IDS } from '../../../ui/port/world-keys.js';

async function live(t) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ modules: [storyDirectorModule] });
  t.after(() => host.close());
  const writes = { settings: { set: (id, key, value) => host.settings.set(id, key, value) }, features: { set: (id, on) => host.features.set(id, on) } };
  const port = createSbPort({ sdk: host.sdk, writes, selectors: buildSelectors(() => null, host.sdk) });
  const rows = () => port.view('settings').sections.find(s => s.id === 'world').rows;
  return { host, port, rows, by: key => rows().find(r => r.key === key) };
}

test('off (the default): one switch row with its help line; Tempo and the count are not drawn', async t => {
  const { port, rows, by } = await live(t);
  assert.deepEqual(checkShape(port.view('settings'), SETTINGS_SHAPE), []);
  assert.equal(by('world.worldEvents').type, 'sw');
  assert.equal(by('world.worldEvents').value, false);
  assert.match(by('world.worldEvents').hint, /^Same switch as Director › World events\. The world keeps its own news/);
  assert.equal(by('world.tempo'), undefined);
  assert.equal(by('world.directorCalls'), undefined);
  assert.equal(rows().filter(r => r.group === 'Time' && /^world\.(worldEvents|tempo|directorCalls)$/.test(r.key)).length, 1);
});

test('the switch turns the feature on; then Tempo (1 by default) and the Director calls count (0) show', async t => {
  const { host, port, by } = await live(t);
  assert.deepEqual(await port.command('settings.set', { key: 'world.worldEvents', value: true }), { ok: true, value: true });
  assert.equal(host.sdk.features().find(f => f.id === WORLD_IDS.events).on, true);
  assert.equal(by('world.worldEvents').value, true);
  assert.equal(by('world.tempo').type, 'num');
  assert.equal(by('world.tempo').value, 1);
  assert.equal(by('world.tempo').hint, 'How fast the world moves: 2 = seasons last twice as long');
  assert.equal(by('world.directorCalls').type, 'info');
  assert.equal(by('world.directorCalls').value, '0');
  assert.equal((await port.command('settings.set', { key: 'world.worldEvents', value: false })).ok, true);
  assert.equal(host.sdk.features().find(f => f.id === WORLD_IDS.events).on, false);
});

test('Tempo stores the engine\'s setting as text, 0.25-4 only; a bad value stores nothing; Reset puts the switch and Tempo back', async t => {
  const { host, port, by } = await live(t);
  await port.command('settings.set', { key: 'world.worldEvents', value: true });
  assert.equal((await port.command('settings.set', { key: 'world.tempo', value: 2 })).ok, true);
  assert.equal(host.sdk.settings('story-director')['chronicle.tempo'], '2');
  assert.equal(by('world.tempo').value, 2);
  for (const value of [0.1, 5, 'fast', Number.NaN]) assert.equal((await port.command('settings.set', { key: 'world.tempo', value })).ok, false, String(value));
  assert.equal(host.sdk.settings('story-director')['chronicle.tempo'], '2');
  assert.equal((await port.command('settings.set', { key: 'world.tempo', value: 0.25 })).ok, true);
  assert.equal(host.sdk.settings('story-director')['chronicle.tempo'], '0.25');
  assert.equal((await port.command('settings.action', { key: 'settings.reset', value: 'Reset World and time to defaults' })).ok, true);
  assert.equal(host.sdk.settings('story-director')['chronicle.tempo'], '1');
  assert.equal(host.sdk.features().find(f => f.id === WORLD_IDS.events).on, false);
});
