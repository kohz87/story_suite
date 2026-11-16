// The helpers P7 moved out of the removed participant folder: the hash, the identity lookup and the confirmed-death record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalJson, hashJson, sha256 } from '../../modules/people/adapter/hash.js';
import { resolveIdentity } from '../../modules/people/adapter/identity-resolve.js';
import { confirmedDeath } from '../../modules/people/adapter/death-record.js';
import { createIdentity, npIdOf } from '../../modules/people/adapter/identity.js';
import { isTerminalNpcDeath } from '../../modules/people/core/terminal-lifecycle.js';

test('the hash is the platform\'s SHA-256 of the normalized JSON', () => {
    for (const text of ['', 'abc', 'a'.repeat(64), 'é☃🙂'.repeat(30)]) assert.equal(sha256(text), createHash('sha256').update(text).digest('hex'));
    assert.equal(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
    assert.equal(hashJson({ b: 1, a: [2, { d: 1, c: 2 }] }), sha256('{"a":[2,{"c":2,"d":1}],"b":1}'));
    assert.throws(() => hashJson({ a: undefined }));
});

const npcs = [{ id: 'npc_mira', name: 'Mira', aliases: ['The Fox'] }, { id: 'npc_bo', name: 'Bo' }, { id: 'npc_bo2', name: 'Bo' }];

test('resolveIdentity: one selector, by id or by name or alias; unknown, ambiguous, malformed and both selectors are null', () => {
    const { queries } = createIdentity({ readState: () => ({ npcs }) });
    const ask = args => queries['npc.identity'](null, args);
    const mira = npIdOf('npc_mira');
    assert.deepEqual(ask({ id: mira }), { id: mira, nativeKey: 'npc_mira', name: 'Mira' });
    assert.deepEqual(ask({ name: ' the  FOX ' }), { id: mira, nativeKey: 'npc_mira', name: 'Mira' });
    assert.equal(ask({ name: 'Bo' }), null);
    assert.equal(ask({ name: 'Nobody' }), null);
    assert.equal(ask({ id: 'np_zzzzzzzz' }), null);
    assert.equal(ask({ id: mira, name: 'Mira' }), null);
    assert.equal(ask({}), null);
    assert.equal(resolveIdentity({ map: {}, byKey: {} }, npcs, { id: mira }), null);
    assert.equal(resolveIdentity({ map: { [mira]: { nativeKey: 'npc_mira', archived: true } }, byKey: {} }, npcs, { id: mira }), null);
});

test('confirmedDeath: a terminal deceased record whose reason names the event', () => {
    const dead = confirmedDeath({ id: 'npc_mira', name: 'Mira' }, { event: 'ev-1', now: 5 });
    assert.equal(isTerminalNpcDeath(dead), true);
    assert.match(dead.lifeStateReason, /event ev-1/);
});
