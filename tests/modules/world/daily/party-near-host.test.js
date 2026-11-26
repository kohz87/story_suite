// The party's region on the host: read from the stored scene place as the world note reads it, and replay == live (a swipe, a Re-read,
// a middle delete and a reload give the same fired events; a later move never re-judges an earlier day).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { partyRegionOf } from '../../../../modules/world/chronicle/world-daily/party-region.js';
import { agrees, dailyOf, newHost, reply, world } from './daily-host.helpers.js';
import { MAP } from './party-map.helpers.js';

const PACK = JSON.stringify({ id: 'world-near', version: '1.0.0', name: 'World near', format: 4, kind: 'world', requires: { suite: '^0.1' }, content: { places: MAP.places.map((place, n) => ({ ...place, x: n, y: n })), regions: MAP.regions, routes: MAP.routes.slice(0, 3).map(route => ({ ...route, kind: 'road' })), conditions: [{ ...MAP.conditions[0], means: 'Crowds in the streets.' }] } });
const beat = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'set-in-motion', where: ['Westport'], window: { after: 'start', within: '20 days' }, waits_for: 'near', ends_when: 'instant', summary: `${id}.`, ...extra });
const SPEC = { events: [beat('near-west'), beat('in-far', { waits_for: { in: ['far'] } })] };
const host = () => newHost(true, SPEC, undefined, PACK);
const DAY = ['! time +1d'];
const begin = (h, place) => h.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm', `~ place ${place}`]));
const region = h => partyRegionOf((name, args) => h.sdk.query(name, args));
const fired = h => Object.fromEntries(Object.entries(dailyOf(h).events).map(([id, row]) => [id, row.fired ?? null]));
const indexOf = (h, start) => h.ctx.chat.findIndex(message => message.mes.startsWith(start));

async function check(h, label) {
    assert.deepEqual(h.store.problems(), [], `${label}: no store problems`);
    await agrees(h, label);
}

test('the party region: a pack place, a sub-place, a place no pack names (the one it stands for), and none', async () => {
    const h = await host();
    assert.equal(region(h), '', 'no scene place');
    await begin(h, 'Farhaven');
    assert.equal(region(h), 'far');
    await h.send('Go.', reply('Docks.', ['~ place Westport / Docks']));
    assert.equal(region(h), 'west');
    await h.send('Drink.', reply('Warm.', ['~ place The Sled & Winch']));
    assert.equal(region(h), 'west', 'a place no pack names is read as the pack place it stands for (the last one visited in its region)');
    await h.send('Walk.', reply('Gate.', ['~ place Midford']));
    await h.send('In.', reply('Inside.', ['~ place Midford · The Back Room']));
    assert.equal(region(h), 'mid', 'or as its town');
    await h.send('Out.', reply('Road.', ['~ place Salt Road | region: Far Coast']));
    assert.equal(region(h), 'far', 'a region the story names, as the world note reads it');
    await check(h, 'party region');
    h.done();
    const lost = await host();
    await begin(lost, 'Nowhere At All');
    assert.equal(region(lost), '', 'a place nothing places on the map: no region');
    await lost.send('Day.', reply('Fog.', DAY));
    assert.deepEqual(fired(lost), { 'near-west': null, 'in-far': null });
    lost.done();
});

test('a beat fires on the reply that arrives and crosses the day; swipe, Re-read, middle delete and reload agree', async () => {
    const h = await host();
    await begin(h, 'Islet');
    await h.send('Day.', reply('Waiting.', DAY));
    assert.deepEqual(fired(h), { 'near-west': null, 'in-far': null }, 'away: both wait');
    await h.send('Sail.', reply('Arrived.', ['~ place Midford', ...DAY]));
    const arrived = dailyOf(h).day;
    assert.deepEqual(fired(h), { 'near-west': arrived, 'in-far': null }, 'the place the same reply writes counts');
    const live = world(h);
    for (const text of ['Arrived, grey.', 'Arrived, wet.']) {
        await h.swipe(reply(text, ['~ place Midford', ...DAY]));
        assert.equal(world(h), live, 'a swipe: the same events');
    }
    await check(h, 'swipes');
    await h.send('On.', reply('Coast.', ['~ place Farhaven', ...DAY]));
    assert.deepEqual(fired(h), { 'near-west': arrived, 'in-far': arrived + 1 });
    // The party has moved on: reading the earlier replies again does not judge their days from where it is now.
    const later = JSON.stringify(dailyOf(h));
    const waiting = indexOf(h, 'Waiting.');
    assert.equal((await h.sdk.reread(waiting)).ok, true);
    assert.equal(JSON.stringify(dailyOf(h)), later, 'Re-read of an earlier day: nothing re-judged');
    await check(h, 'Re-read of the waiting day');
    assert.equal((await h.sdk.reread(indexOf(h, 'Arrived'))).ok, true);
    assert.equal(JSON.stringify(dailyOf(h)), later, 'Re-read of the arriving day: the same events');
    await check(h, 'Re-read of the arrival');
    await h.st.deleteMessage(indexOf(h, 'Waiting.'));
    assert.deepEqual(fired(h), { 'near-west': arrived, 'in-far': arrived + 1 }, 'a middle delete keeps what later replies recorded');
    await check(h, 'middle delete');
    await h.st.loadChat(structuredClone(h.ctx.chat));
    assert.deepEqual(fired(h), { 'near-west': arrived, 'in-far': arrived + 1 }, 'a reload');
    await check(h, 'reload');
    h.done();
});

test('an edited Re-read of the last reply judges its own day from its new place', async () => {
    const h = await host();
    await begin(h, 'Islet');
    await h.send('Sail.', reply('Arrived.', ['~ place Midford', ...DAY]));
    const day = dailyOf(h).day;
    assert.equal(fired(h)['near-west'], day);
    const at = indexOf(h, 'Arrived');
    await h.st.editMessage(at, reply('Arrived.', ['~ place Islet', ...DAY]));
    assert.equal((await h.sdk.reread(at)).ok, true);
    assert.equal(fired(h)['near-west'], null);
    await check(h, 'edited Re-read');
    h.done();
});
