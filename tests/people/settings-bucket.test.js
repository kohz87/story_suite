import { test } from 'node:test';
import assert from 'node:assert/strict';
import { npcBucket, NPC_BUCKET_ID } from '../../modules/people/settings/bucket.js';

test('NPC State settings live in storySuite.modules[npc-state-delta]; the old root key is never read or made', () => {
    const es = { npc_state_delta: { scanEvery: 9 } };
    assert.equal(NPC_BUCKET_ID, 'npc-state-delta');
    assert.equal(npcBucket(es), null);
    const bucket = npcBucket(es, { create: true });
    bucket.scanEvery = 2;
    assert.equal(es.storySuite.schema, 1);
    assert.equal(es.storySuite.modules['npc-state-delta'].scanEvery, 2);
    assert.equal(npcBucket(es), bucket);
    assert.deepEqual(es.npc_state_delta, { scanEvery: 9 });
});

test('an existing tree is used as it is', () => {
    const es = { storySuite: { schema: 1, modules: { 'npc-state-delta': { a: 1 } } } };
    assert.deepEqual(npcBucket(es), { a: 1 });
    assert.equal(npcBucket(null, { create: true }), null);
});
