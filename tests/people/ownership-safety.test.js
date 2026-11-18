import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQualifiedChatKey, getCharacterOwnerId, getChatIdentityFromContext } from '../../modules/people/core/identity.js';
import { applyCanonicalOwnershipMove } from '../../modules/people/core/hardening-core.js';
import { readNpcStateDataFile, retireNpcStateDataFile, writeNpcStateDataFile } from '../../modules/people/storage/storage.js';


test('durable character ownership never falls back to numeric characterId', () => {
  const ctx = { characterId: 4, characters: [], chatId: 'Adventure' };
  assert.equal(getCharacterOwnerId(ctx), '');
  assert.equal(getChatIdentityFromContext(ctx).key, 'chat-pending:Adventure');
});

test('rename-back supersedes only the verified destination tombstone', () => {
  const a = buildQualifiedChatKey('chat', 'card.png', 'A');
  const b = buildQualifiedChatKey('chat', 'card.png', 'B');
  const settings = { dataFiles: { [b]: { path: '/b' } }, sidecarTombstones: { [a]: { reason: 'old' } }, recoveryFiles: {}, branchIndex: {} };
  applyCanonicalOwnershipMove(settings, { oldKey: b, newKey: a, newPointer: { path: '/a2' }, reason: 'chat-renamed' });
  assert.equal(settings.sidecarTombstones[a], undefined);
  assert.ok(settings.sidecarTombstones[b]);
});

function fileHarness() {
  const files = new Map();
  const fetchFn = async (url, options = {}) => {
    if (url === '/api/files/upload') {
      const body = JSON.parse(options.body);
      const path = `/files/${body.name}`;
      files.set(path, Buffer.from(body.data, 'base64').toString('utf8'));
      return { ok: true, status: 200, json: async () => ({ path }) };
    }
    if (files.has(url)) return { ok: true, status: 200, text: async () => files.get(url) };
    return { ok: false, status: 404, text: async () => '' };
  };
  return { fetchFn };
}

test('stale writer and stale retirement both fail closed on revision conflict', async () => {
  const { fetchFn } = fileHarness();
  const first = await writeNpcStateDataFile({ chatKey: 'chat:a:x', state: { value: 1 }, fetchFn });
  const second = await writeNpcStateDataFile({ chatKey: 'chat:a:x', state: { value: 2 }, pointer: first, fetchFn });
  await assert.rejects(writeNpcStateDataFile({ chatKey: 'chat:a:x', state: { value: 3 }, pointer: first, fetchFn }), e => e?.code === 'NPC_STATE_WRITE_CONFLICT');
  await assert.rejects(retireNpcStateDataFile({ chatKey: 'chat:a:x', pointer: first, fetchFn }), e => e?.code === 'NPC_STATE_WRITE_CONFLICT');
  const live = await readNpcStateDataFile(second, { fetchFn, expectedChatKey: 'chat:a:x' });
  assert.equal(live.revision, 2);
});

