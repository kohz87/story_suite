import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleState, peopleView } from '../../modules/people/view.js';
import { validatePeople } from '../../modules/people/domain/validate.js';
import { normalizeGeneratedSecrets, normalizeSecrets } from '../../modules/people/meters/npc-meters-secrets.js';

// SOAKPEOPLE F47: a scan's hidden note "opens at Trust 2" lost its `at` on the way through the store (view.js took every numeric `at` for a clock),
// so after a hydrate the note had a meter and no threshold, normalizeSecrets dropped it and the Secrets page lost it once it opened.

test('F47: a hidden note keeps its meter threshold through view → store → hydrate', () => {
    const secrets = normalizeGeneratedSecrets([
        { title: 'Skims the tolls', text: 'Brisk pockets one coin in ten from the river-gate tolls.', meter: 'trust', at: 2 },
        { title: 'Ledger informer', text: 'Brisk sells the names of debtors to the Grey Ledger.', when: 'the Grey Ledger is named at the hearing' },
    ]);
    assert.equal(secrets.length, 2);
    const state = { npcs: [{ id: 'npc_brisk_hollen', name: 'Brisk Hollen', secrets, updatedAt: 99, createdAt: 5 }], turn: 4 };
    const view = peopleView(state);
    assert.deepEqual(validatePeople(view), []);
    const stored = view.npcs.npc_brisk_hollen;
    assert.equal(stored.secrets[0].at, 2, 'the threshold is stored');
    assert.equal(stored.updatedAt, undefined, 'clock fields are still dropped');
    const back = peopleState(JSON.parse(JSON.stringify(view)));
    const again = normalizeSecrets(back.npcs[0].secrets);
    assert.deepEqual(again.map(note => note.id), secrets.map(note => note.id), 'both notes survive the hydrate with their ids');
    assert.deepEqual(again[0], secrets[0]);
});

// SOAKPEOPLE F46 (one-pass on): a stub's fill-in (which also asks for its first hidden notes) is found by the stub's reply stamp (createdAt = index + 1),
// but the stamp was dropped as a clock on the way into NPC State's cache, so no fill-in was ever queued and no note was ever written.
test('F46: a stub\'s reply stamp reaches the cache, so its fill-in is queued; a clock createdAt is still dropped', async () => {
    const { newStubs } = await import('../../modules/people/adapter/stub-fills.js');
    const view = { v: 1, order: ['npc_tamsa', 'npc_scan'], npcs: {
        npc_tamsa: { id: 'npc_tamsa', name: 'Tamsa Vell', role: 'the clerk', createdAt: 5 },
        npc_scan: { id: 'npc_scan', name: 'Scan', createdAt: 1794869494082 },
    } };
    const cache = peopleState(view);
    assert.equal(cache.npcs[0].createdAt, 5);
    assert.equal(cache.npcs[1].createdAt, undefined, 'a clock is not kept');
    assert.deepEqual(newStubs(cache.npcs, 4), [{ id: 'npc_tamsa', name: 'Tamsa Vell' }], 'the reply at index 4 queues her fill-in');
    const back = peopleView({ npcs: cache.npcs, turn: 3 });
    assert.equal(back.npcs.npc_tamsa.createdAt, undefined, 'the cache\'s own write leaves the store as before (one way only)');
    assert.deepEqual(validatePeople(back), []);
});
