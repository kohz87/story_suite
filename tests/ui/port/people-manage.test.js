// F27: the dossier's Edit, Delete and Mark alive are answered through NPC State's public handle, and the port says it can.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manageCommand, MANAGE_NAMES } from '../../../ui/port/people-manage.js';
import { pageHandles } from '../../../modules/people/runtime/handles.js';
import { createSbPort } from '../../../ui/port/sb-port.js';

const sdk = { command: async () => ({ ok: true }), modules: () => [] };

test('the port answers npc.edit, npc.delete, npc.markAlive and npc.add itself, and still has nobody for Merge', async () => {
  const seen = [];
  pageHandles.deltaApi = { openEditor: id => { seen.push(['edit', id]); return true; }, deleteNpc: async id => { seen.push(['delete', id]); return true; },
    updateLifeState: async (id, choice, options) => { seen.push(['alive', id, choice, options.chatKey]); return true; }, uiStatus: () => ({ chatKey: 'chat-1' }), addNpc: name => { seen.push(['add', name]); } };
  try {
    const port = createSbPort({ sdk });
    for (const name of MANAGE_NAMES) assert.equal(port.can(name), true, name);
    assert.equal(port.can('npc.merge'), false);
    for (const name of MANAGE_NAMES) assert.deepEqual(await port.command(name, { personId: 'np_1' }), { ok: true });
    assert.deepEqual(seen, [['edit', 'np_1'], ['delete', 'np_1'], ['alive', 'np_1', 'alive', 'chat-1'], ['add', '']]);
  } finally { pageHandles.deltaApi = null; }
});

test('a refusal says why: no person, no NPC State, nothing found, a throw, no chat to change', async () => {
  const ok = { openEditor: () => false, deleteNpc: async () => false, updateLifeState: async () => false, uiStatus: () => ({ chatKey: 'c' }) };
  assert.equal((await manageCommand('npc.delete', {}, ok)).ok, false);
  assert.match((await manageCommand('npc.delete', { personId: 'a' }, null)).message, /not running/);
  assert.match((await manageCommand('npc.edit', { personId: 'a' }, ok)).message, /no NPC State dossier/);
  assert.match((await manageCommand('npc.delete', { personId: 'a' }, ok)).message, /could not be deleted/);
  assert.match((await manageCommand('npc.markAlive', { personId: 'a' }, ok)).message, /marked alive/);
  assert.match((await manageCommand('npc.markAlive', { personId: 'a' }, { ...ok, uiStatus: () => ({}) })).message, /marked alive/);
  assert.match((await manageCommand('npc.delete', { personId: 'a' }, { ...ok, deleteNpc: async () => { throw new Error('disk full'); } })).message, /disk full/);
});
