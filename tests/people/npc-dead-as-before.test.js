// An old chat with a dead person writes what it wrote before dead people's own notes could be opened: their stages and ladder are worked out again after
// the reader's edits, drift and the stage tick run on each reply, and no meter opens a note. The expected values are what the code before that change wrote.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE_DRIFT, FEATURE_STAGES } from '../../modules/people/meters/npc-meters.js';
import { createNpcRecord } from '../../modules/people/core/core.js';
import { suite } from './away.helpers.js';
import { seedPeople } from './helpers/seed-people.js';

const NOTE = { id: 'sec_dddddddd', title: 'The ledger', meter: 'trust', at: 40, text: 'Ana keeps a ledger.', from: 'pack' };
const SETTINGS = { customMeters: [{ name: 'Mood', min: -50, max: 50, start: 0, drift: 4, driftTo: 0 }], ladder: [{ name: 'Friend', needs: 'trust 20' }], demoteAfter: 2,
    stages: [{ meter: 'trust', at: 20, name: 'Friend' }, { meter: 'trust', at: 60, name: 'Confidant' }, { meter: 'trust', at: -30, name: 'Wary' }] };
const record = () => ({ ...createNpcRecord('Ana', []), id: 'npc_ana', present: true, secrets: [NOTE], relationship: { trust: 0, affection: 0, desire: 0, tension: 0 } });

test('a dead person: drift, stages, ladder and the receipts are as before, and no meter opens their note', async () => {
    const people = { npc_ana: record() };
    const s = await suite({ settings: SETTINGS, features: { [FEATURE_DRIFT]: true, [FEATURE_STAGES]: true }, people });
    await seedPeople(s.host.sdk, s.host.store, people);
    await s.say(['~ npc Ana | mood: +15 | trust: +15']);
    await s.say(['~ npc Ana | trust: +10']);
    Object.assign(people.npc_ana, { archived: true, present: false, lifeState: 'deceased', lifeStateCertainty: 'explicit' });
    await s.say();
    await seedPeople(s.host.sdk, s.host.store, { npc_ana: { ...people.npc_ana, archived: undefined } });   // (the stored record carries no archive flag)
    const ana = () => s.host.head().domains.people.bonds.npcs.npc_ana;
    const seen = [];
    const look = (label, out = null) => seen.push([label, ana().meters.mood, ana().meters.trust, ana().stages.trust ?? null, ana().rank ?? null, ana().low ?? null, ana().unlocked, out]);
    look('died');
    for (const trust of [80, -80]) {
        const out = await s.host.sdk.command('npc.set', { name: 'npc_ana', meters: { trust } });
        assert.equal(out.ok, true, JSON.stringify(out));
        const entry = s.host.store.receipts().at(-1);
        look(`set ${trust}`, [(entry.receipt ?? entry).narrate ?? null, (entry.receipt ?? entry).summary ?? null]);
    }
    await s.keys(undefined, 3 * 1440);
    await s.say();
    look('three days');
    await s.say();
    look('next reply');
    assert.deepEqual(seen, EXPECTED);
});

// [label, mood (drifts), trust, trust stage, rank, replies below the rank's needs, opened notes, [receipt narrates, receipt summary]]
const EXPECTED = [
    ['died', 15, 25, 'Friend', 'friend', null, [], null],
    ['set 80', 15, 80, 'Confidant', 'friend', null, [], [true, 'Ana: trust reached Confidant. Ana: trust 25 → 80.']],
    ['set -80', 15, -80, 'Wary', 'friend', null, [], [true, 'Ana: trust reached Wary. Ana: trust 80 → -80.']],
    ['three days', 3, -80, 'Wary', 'friend', 1, [], null],
    ['next reply', 3, -80, 'Wary', null, null, [], null],
];
