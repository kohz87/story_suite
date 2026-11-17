import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleCardCommand } from '../../../ui/port/module-cards.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { createHost } from '../../../testkit/index.js';
import { BUILTIN_MODULES } from '../../../core/modules-list.js';

const wiresOf = host => ({ settings: { set: (id, key, v) => host.settings.set(id, key, v) }, features: { set: (id, on) => host.features.set(id, on) } });
const onMap = host => Object.fromEntries(host.sdk.features().map(f => [f.id, f.on]));

test('the RPG switch and a Story Director switch are stored in the feature store, as the old view stores them', async t => {
  t.mock.method(console, 'warn', () => {});
  const old = await createHost({ core: true, modules: BUILTIN_MODULES }); const now = await createHost({ core: true, modules: BUILTIN_MODULES });
  t.after(() => { old.close(); now.close(); });
  const port = createSbPort({ sdk: now.sdk, writes: wiresOf(now) });
  const director = now.sdk.features().find(f => f.moduleId === 'story-director');
  for (const [id, value] of [['story-block.rpg', true], [director.id, !director.on], ['story-block.rpg', false]]) {
    old.features.set(id, value);
    const module = now.sdk.features().find(f => f.id === id).moduleId;
    assert.equal((await port.command('settings.set', { key: `modules.chat.${module}.${id}`, value })).ok, true);
    assert.deepEqual(onMap(now), onMap(old), id);
  }
});

test('a module switch turns its features off, and on again to the ones that start on; other modules stay', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ core: true, modules: BUILTIN_MODULES });
  t.after(() => host.close());
  const port = createSbPort({ sdk: host.sdk, writes: wiresOf(host) });
  const before = onMap(host);
  await port.command('settings.set', { key: 'modules.chat.story-director', value: false });
  const off = host.sdk.features();
  assert.ok(off.filter(f => f.moduleId === 'story-director').every(f => !f.on));
  assert.deepEqual(off.filter(f => f.moduleId !== 'story-director').map(f => [f.id, f.on]), Object.entries(before).filter(([id]) => !id.startsWith('story-director.') && off.find(f => f.id === id)?.moduleId !== 'story-director'));
  await port.command('settings.set', { key: 'modules.chat.story-director', value: true });
  assert.ok(host.sdk.features().filter(f => f.moduleId === 'story-director').every(f => f.on === (f.default !== false)));
});

test('Reset to Standard puts every switch back to its default', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ core: true, modules: BUILTIN_MODULES });
  t.after(() => host.close());
  const port = createSbPort({ sdk: host.sdk, writes: wiresOf(host) });
  const start = onMap(host);
  for (const f of host.sdk.features()) host.features.set(f.id, !f.on);
  assert.notDeepEqual(onMap(host), start);
  assert.equal((await port.command('settings.action', { key: 'modules.reset', value: 'standard' })).ok, true);
  for (const f of host.sdk.features()) assert.equal(f.on, f.default !== false, f.id);
});

test('NPC State\'s card (its features, a dotted id) is answered by the same handler', () => {
  const stored = [];
  const writes = { features: { set: (id, on) => (stored.push([id, on]), on) } };
  const features = () => [{ id: 'npc-state-delta.mood-pull', moduleId: 'npc-state-delta', default: true }, { id: 'npc-state-delta.notes', moduleId: 'npc-state-delta', default: false }];
  assert.deepEqual(moduleCardCommand('settings.set', { key: 'modules.chat.npc-state-delta.npc-state-delta.notes', value: true }, writes, features), { ok: true, value: true });
  assert.deepEqual(stored, [['npc-state-delta.notes', true]]);
  moduleCardCommand('settings.set', { key: 'modules.chat.npc-state-delta', value: true }, writes, features);
  assert.deepEqual(stored.slice(1), [['npc-state-delta.mood-pull', true], ['npc-state-delta.notes', false]]);
});

test('New chats is refused (per-chat sets are not built); unknown switches and other commands', () => {
  const features = () => [{ id: 'a.b', moduleId: 'a' }];
  const writes = { features: { set: (id, on) => on } };
  assert.equal(moduleCardCommand('settings.set', { key: 'modules.newChats.a', value: true }, writes, features).ok, false);
  assert.equal(moduleCardCommand('settings.set', { key: 'modules.chat.a.nope', value: true }, writes, features).ok, false);
  assert.equal(moduleCardCommand('settings.set', { key: 'modules.chat.zzz', value: true }, writes, features).ok, false);
  assert.equal(moduleCardCommand('settings.set', { key: 'host.tailBudget', value: 1 }, writes, features), null);
  assert.equal(moduleCardCommand('settings.action', { key: 'settings.reset' }, writes, features), null);
});
