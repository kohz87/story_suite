// An opted-in pack's events name places by their file ids ("deep-hold"), while the host reads each place with the id "pack.<pack>/<slug>":
// the daily step must still find the place. The places of a pack that did not opt in are never found that way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGeo, resolveRef } from '../../../../modules/world/daily/geo.js';
import { runner, world } from './helpers.js';

const installed = { name: 'Deepmantle Hold', id: 'pack.sample/deep-hold', slug: 'deep-hold', pack: 'sample', region: 'Valegard', kind: 'town' };
const opted = extra => world({ placeIdPacks: ['sample'], ...extra });

test('a place resolves by the file id an installed pack kept as its slug', () => {
    const geo = buildGeo(opted({ places: [installed] }));
    assert.equal(resolveRef(geo, 'deep-hold')?.name, 'Deepmantle Hold');
});

test("another place's name wins over a slug that spells it", () => {
    const geo = buildGeo(opted({ places: [installed, { name: 'deep-hold', region: 'Valegard', kind: 'town' }] }));
    assert.equal(resolveRef(geo, 'deep-hold')?.name, 'deep-hold');
});

test('an event sets a condition on a place it names by that id', () => {
    const event = { id: 'riot', certainty: 'set-in-motion', where: ['deep-hold'], window: { within: '1 day' }, ends_when: 'instant', effects: { set: ['unrest@deep-hold: 10 days'] }, summary: 'A riot.' };
    const run = runner(opted({ places: [installed], events: [event] })).to(1);
    assert.deepEqual(Object.keys(run.table), ['unrest@Deepmantle Hold']);
});

test('beside an opted-in pack, the file id of a pack that did not opt in never resolves', () => {
    const other = { name: 'Saltfen', id: 'pack.plain/saltfen', slug: 'saltfen', pack: 'plain', region: 'Valegard', kind: 'town' };
    const geo = buildGeo(opted({ places: [installed, other] }));
    assert.equal(resolveRef(geo, 'deep-hold')?.name, 'Deepmantle Hold');
    assert.equal(resolveRef(geo, 'saltfen')?.name, 'Saltfen', 'its name, in any letter case, as before');
    const spelled = buildGeo(opted({ places: [installed, { ...other, name: 'Salt Fen' }] }));
    assert.equal(resolveRef(spelled, 'saltfen'), null);
    const events = ['deep-hold', 'saltfen'].map(ref => ({ id: `riot-${ref}`, certainty: 'set-in-motion', where: ['Deepmantle Hold'], window: { within: '1 day' }, ends_when: 'instant', effects: { set: [`unrest@${ref}: 10 days`] }, summary: 'A riot.' }));
    const run = runner(opted({ places: [installed, { ...other, name: 'Salt Fen' }], events })).to(1);
    assert.deepEqual(Object.keys(run.table), ['unrest@Deepmantle Hold']);
});

test('with no opted-in pack on the map, no file id resolves', () => {
    for (const placeIdPacks of [undefined, [], ['another']]) {
        const geo = buildGeo(world({ places: [installed], placeIdPacks }));
        assert.equal(resolveRef(geo, 'deep-hold'), null);
        assert.equal(geo.slugs, false);
    }
});
