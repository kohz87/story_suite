// Your Holding's seat and the party's regions on the real host: the seat's region counts for `in:` / `near:` terms, never for a
// `waits_for` scene beat, which waits for the scene itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { partyRegionOf, seatRegionOf } from '../../../../modules/world/chronicle/world-daily/party-region.js';
import { agrees, dailyOf, newHost, reply } from './daily-host.helpers.js';
import { MAP } from './party-map.helpers.js';

const ID = 'pack.ersveil-game/holding';
const GAME = readFileSync(new URL('../../../../examples/packs/ersveil-game/pack.json', import.meta.url), 'utf8');
const PACK = JSON.stringify({ id: 'world-near', version: '1.0.0', name: 'World near', format: 4, kind: 'world', requires: { suite: '^0.1' }, content: { places: MAP.places.map((place, n) => ({ ...place, x: n, y: n })), regions: MAP.regions, routes: MAP.routes.slice(0, 3).map(route => ({ ...route, kind: 'road' })), conditions: [{ ...MAP.conditions[0], means: 'Crowds in the streets.' }] } });
const event = (id, extra) => ({ id, kind: 'one-off', certainty: 'set-in-motion', where: ['Westport'], severity: 'minor', window: { after: 'start', within: '20 days' }, ends_when: 'instant', summary: `${id}.`, ...extra });
// (the first two fire on the first stepped day their term holds; the beat is a waiting one)
const sure = { certainty: 'likely', chance: '100% over the window' };
const SPEC = { events: [event('in-far', { ...sure, requires: ['in:far'] }), event('near-far', { ...sure, requires: ['near:far'] }), event('beat', { waits_for: { in: ['far'] } })] };
const DAY = '! time +1d';
const fired = host => Object.fromEntries(Object.entries(dailyOf(host).events).map(([id, row]) => [id, row.fired ?? null]));

for (const [how, seat] of [['the region the seat line names', 'at: The Mill | region: Far Coast'], ['the seat place\'s own region', 'at: Farhaven']]) {
    test(`only the seat is in the region (${how}): in: and near: hold, waits_for keeps waiting for the scene`, async () => {
        const host = await newHost(true, SPEC, undefined, PACK);
        try {
            assert.equal((await host.packs.packs.install(GAME, { origin: 'game.json' })).ok, true);
            const offer = host.sdk.query('dataModules.offers').find(row => row.module === ID);
            assert.equal((await host.sdk.command('dm.pin', { module: ID, hash: offer.hash, packHash: offer.packHash })).ok, true);
            const query = (name, args) => host.sdk.query(name, args);
            await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm', '~ place Islet']));
            await host.send('On.', reply('Found.', ['+ dm holding — Founded | kind: found | type: fief | name: Ravenhold', DAY]));
            assert.deepEqual(fired(host), { 'in-far': null, 'near-far': null, beat: null }, 'no seat: nothing near');
            await host.send('On.', reply('Built.', [`~ dm holding — built | kind: seat | ${seat}`, DAY]));
            assert.deepEqual([partyRegionOf(query), seatRegionOf(query)], ['isle', 'far']);
            await host.send('On.', reply('Quiet.', [DAY]));
            const day = fired(host)['in-far'];
            assert.ok(day !== null && fired(host)['near-far'] !== null, JSON.stringify(fired(host)));
            assert.equal(fired(host).beat, null, 'the scene is on the isle: the beat waits');
            await agrees(host, 'seat only');
            await host.send('On.', reply('Sailed.', ['~ place Farhaven', DAY]));
            assert.ok(fired(host).beat > day, 'the beat fires when the scene arrives');
            await agrees(host, 'arrived');
        } finally { host.done(); }
    });
}
