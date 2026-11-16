// A host-confirmed death with no timeline participant (P3): NPC State marks the dossier of an `np_` identity dead the way the rules do and stores it as one people write
// for the head's reply; unknown ids, a moved head and a bad call change nothing; the same event again is acknowledged, another person is a CONFLICT; a failed write is not an ack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPeopleSync } from '../src/adapter/people-sync.js';
import { createNativeDeath } from '../src/adapter/native-death.js';
import { createIdentity } from '../src/adapter/identity.js';
import { peopleView, peopleState } from '../src/people/view.js';
import { hashJson } from '../src/storysuite-participant/hash.js';

function rig({ failWrite = false } = {}) {
    const fake = { state: { npcs: [{ id: 'npc_mira', name: 'Mira', aliases: [], lifeState: 'alive' }, { id: 'npc_tom', name: 'Tom', aliases: [], lifeState: 'alive' }], candidates: [], socialGraph: {}, turn: 1 }, head: 'h1', writes: 0 };
    fake.slice = peopleView(fake.state);
    const sdk = {
        query: name => (name === 'people.hash' ? hashJson(fake.slice) : undefined),
        view: () => ({ state: { domains: { people: fake.slice } } }),
        timeline: { head: async () => ({ ok: true, headHash: fake.head, source: { sid: 'a', swipeKey: 1, ordinal: 0 } }) },
        command: async (_type, payload) => { fake.writes += 1; if (failWrite) return { ok: false, code: 'INVALID', message: 'no' }; fake.slice = payload.view; return { ok: true }; },
    };
    const readState = () => fake.state;
    const install = keys => { fake.state = { ...fake.state, ...keys }; return true; };
    // The runtime's setPeopleRecord: one person's record set in place on the cache.
    const setRecord = record => { const at = fake.state.npcs.findIndex(item => item.id === record.id); if (at < 0) return false; fake.state.npcs[at] = structuredClone(record); return true; };
    const peopleSync = createPeopleSync({ sdk: () => sdk, view: peopleView, restore: peopleState, hash: hashJson, readState, install });
    const { queries } = createIdentity({ readState });
    const death = createNativeDeath({ sdk: () => sdk, peopleSync, identity: args => queries['npc.identity'](null, args), readState, setRecord, now: () => 5 });
    return { fake, peopleSync, death, id: name => queries['npc.identity'](null, { name }).id };
}

test('a confirmed death is deceased in the cache and in the store, and the same event again is acknowledged', async () => {
    const { fake, peopleSync, death, id } = rig();
    await peopleSync.hydrate();
    const out = await death.confirmDeath({ event: 'de_1', npc: id('Mira'), expectedHead: 'h1' });
    assert.equal(out.ok, true);
    assert.equal(fake.state.npcs[0].lifeState, 'deceased');
    assert.equal(fake.slice.npcs.npc_mira.lifeState, 'deceased');
    assert.equal(fake.slice.npcs.npc_tom.lifeState, 'alive');
    const writes = fake.writes;
    assert.equal((await death.confirmDeath({ event: 'de_1', npc: id('Mira'), expectedHead: 'h1' })).ack, true);
    assert.equal(fake.writes, writes, 'nothing is written twice');
    assert.equal((await death.confirmDeath({ event: 'de_1', npc: id('Tom'), expectedHead: 'h1' })).code, 'CONFLICT');
});

test('an unknown id (never a name), a moved head and a bad call change nothing; a failed write is not an acknowledgement', async () => {
    const { fake, peopleSync, death, id } = rig();
    await peopleSync.hydrate();
    for (const [input, code] of [[{ event: 'de_2', npc: 'np_missing0', expectedHead: 'h1' }, 'REFUSED'], [{ event: 'de_2', npc: 'Mira', expectedHead: 'h1' }, 'REFUSED'], [{ event: 'de_2', npc: id('Mira'), expectedHead: 'old' }, 'STALE'], [{ event: '', npc: id('Mira'), expectedHead: 'h1' }, 'INVALID']]) {
        assert.equal((await death.confirmDeath(input)).code, code);
    }
    assert.equal(fake.writes, 0);
    assert.equal(fake.slice.npcs.npc_mira.lifeState, 'alive');
    const broken = rig({ failWrite: true });
    await broken.peopleSync.hydrate();
    assert.equal((await broken.death.confirmDeath({ event: 'de_3', npc: broken.id('Mira'), expectedHead: 'h1' })).ok, false);
});
