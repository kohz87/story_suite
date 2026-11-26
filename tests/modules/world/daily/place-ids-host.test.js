// An installed pack's events name places by their file ids ("deep-hold"), while the host reads each place with the id "pack.<pack>/<slug>":
// the daily step must still find the place, in an event's effects and in the pack's start world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGeo, resolveRef } from '../../../../modules/world/daily/geo.js';
import { runner, world } from './helpers.js';

const installed = { name: 'Deepmantle Hold', id: 'pack.sample/deep-hold', slug: 'deep-hold', region: 'Valegard', kind: 'town' };

test('a place resolves by the file id an installed pack kept as its slug', () => {
    const geo = buildGeo(world({ places: [installed] }));
    assert.equal(resolveRef(geo, 'deep-hold')?.name, 'Deepmantle Hold');
});

test("another place's name wins over a slug that spells it", () => {
    const geo = buildGeo(world({ places: [installed, { name: 'deep-hold', region: 'Valegard', kind: 'town' }] }));
    assert.equal(resolveRef(geo, 'deep-hold')?.name, 'deep-hold');
});

test('an event sets a condition on a place it names by that id', () => {
    const event = { id: 'riot', certainty: 'set-in-motion', where: ['deep-hold'], window: { within: '1 day' }, ends_when: 'instant', effects: { set: ['unrest@deep-hold: 10 days'] }, summary: 'A riot.' };
    const run = runner(world({ places: [installed], events: [event] })).to(1);
    assert.deepEqual(Object.keys(run.table), ['unrest@Deepmantle Hold']);
});
