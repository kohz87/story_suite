// WEALIGN, seam audit E33/E34 on the host: what the daily step fires and ends becomes one chronicle entry per occurrence (by
// `event:world.<id>`, with its reach, dated on its own day, a fixed id), so news can carry it (spec §4). Swipe, swipe back, an edited
// Re-read (grown and shrunk), a middle delete, a rewind and a reload all give the state a rebuild gives, with no second entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, chronicle, newHost, reply } from './daily-host.helpers.js';

const DAY = 1440;
const levies = host => Object.values(chronicle(host).events).filter(event => event.by === 'event:world.levy');
const firedDay = host => chronicle(host).daily?.[0]?.events?.levy?.fired ?? null;

test('E33/E34: the levy fires and ends as one entry (fixed id, its day, its reach); swipes, Re-reads, a middle delete, a rewind and a reload keep one', async () => {
    const host = await newHost();
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    // The levy is set in motion over two days: it has fired by the second day, whatever the seed.
    const fired = firedDay(host);
    assert.ok(Number.isInteger(fired));
    const [entry] = levies(host);
    assert.equal(levies(host).length, 1);
    assert.deepEqual([entry.state, entry.reach, entry.place, entry.since, entry.updated], ['ongoing', 'regional', 'Highmark', fired * DAY, fired * DAY]);
    assert.match(entry.name, /^The lord calls a levy · June [34], 1200$/);
    assert.match(entry.id, /^ev_[0-9a-z]{8}$/);
    await agrees(host, 'fired');
    const middle = host.ctx.chat.length - 1;
    // A swipe of this reply fires it the same day again (seeded), so it writes the same entry (its id is fixed by the event and the day).
    await host.swipe(reply('Dawn, grey.', ['! time +1d']));
    assert.deepEqual(levies(host).map(event => event.id), [entry.id]);
    await agrees(host, 'swipe');
    await host.st.swipeTo(middle, 0);
    assert.deepEqual(levies(host).map(event => event.id), [entry.id]);
    await agrees(host, 'swipe back');
    await host.send('Later.', reply('Days pass.', ['! time +4d']));
    const [ended] = levies(host);
    assert.deepEqual([ended.id, ended.state, ended.since], [entry.id, 'resolved', fired * DAY], 'the end resolves the same entry');
    assert.equal(ended.updated, (fired + 3) * DAY, 'ends_when for 3 days: the end is dated on its own day');
    await agrees(host, 'ended');
    // An edited Re-read of the middle reply, grown (+2d) then shrunk (+1h): the later reply keeps what it recorded; never two entries.
    for (const [text, line] of [['Dawn, later.', '! time +2d'], ['Dawn, soon.', '! time +1h']]) {
        await host.st.editMessage(middle, reply(text, [line]));
        assert.equal((await host.sdk.reread(middle)).ok, true, `Re-read (${line})`);
        assert.ok(levies(host).length <= 1, `Re-read (${line}): at most one levy entry`);
        assert.deepEqual(host.store.problems(), []);
        await agrees(host, `Re-read ${line}`);
    }
    await host.st.deleteMessage(middle);
    assert.ok(levies(host).length <= 1, 'middle delete: at most one levy entry');
    assert.deepEqual(host.store.problems(), []);
    await agrees(host, 'middle delete');
    while (host.ctx.chat.length > 2) await host.st.deleteMessage(host.ctx.chat.length - 1);
    await agrees(host, 'rewind');
    host.done();
});

test('E33/E34: with the switch off no entry is written; the heard news of an entry is fact at its own place', async () => {
    const off = await newHost(false);
    await off.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await off.send('Day.', reply('Dawn.', ['! time +1d']));
    assert.deepEqual(levies(off), []);
    off.done();
    const host = await newHost();
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    const heard = host.sdk.query('world.heardHere', { place: 'Highmark' }).filter(event => event.by === 'event:world.levy');
    assert.deepEqual(heard.map(event => [event.tag, event.via]), [['fact', 'tier']]);
    host.done();
});
