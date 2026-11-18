// REVPF4 items 5 and 12: the Problems lines a chat's start gives for its world and game (a start date that falls back, a dropped birthday, an unused
// names culture: each in the pairing check's words, once), and the "changed since this chat began" note given once, not again with every swipe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { frameHost, frameOf, said, world } from './frame.helpers.js';

const REQ = { suite: '^0.1' };
const months = [{ name: 'Frost', days: 30 }, { name: 'Bloom', days: 20 }];
const pairWorld = () => ({ ...world(), content: { ...world().content, start: { place: 'dock', date: { year: 5, month: 3, day: 1 } },
    regions: [{ id: 'north', name: 'The North' }],
    cast: [{ kind: 'companion', id: 'mara', name: 'Mara', role: 'A friend.', birthday: 'Bloom 25' }] } });
const pairGame = () => ({ id: 'g1', format: 4, kind: 'game', version: '1.0.0', name: 'Rules', requires: REQ, content: { calendar: { months }, names: { coast: { regions: ['south'], given: ['Ana', 'Bo'], family: ['Reed'] } } } });
const lines = host => host.turn.problems().filter(entry => /^PAIR_/.test(entry.code)).map(entry => [entry.code, entry.message, entry.quiet]);

test('the first reply lists the start date that falls back, the dropped birthday and the unused culture in Problems, quietly, once', async t => {
    const host = await frameHost(t, { selected: false });
    for (const pack of [pairWorld(), pairGame()]) { const done = await host.packs.packs.install(pack); assert.equal(done.ok, true, JSON.stringify(done.errors)); }
    await host.send('hi', said('R1.'));
    assert.deepEqual(lines(host), [
        ['PAIR_START_DATE', 'The start date (month 3, day 1): Rules\'s calendar has 2 months, not 3. The chat starts on day 1 of month 1 of year 5.', true],
        ['PAIR_BIRTHDAY', 'Mara\'s birthday "Bloom 25": Bloom has 20 days in Rules\'s calendar, so day 25 never comes. The birthday is dropped.', true],
        ['PAIR_CULTURE', 'The names culture "coast" names no region of Ersveil (south). It is unused.', true],
    ]);
    await host.swipe(said('R1 again.'));
    await host.send('more', said('R2.'));
    assert.equal(lines(host).length, 3, 'not again on a swipe or the next reply');
    assert.equal(frameOf(host).game.pack, 'g1');
});

test('a pair that fits gives no lines; nothing selected gives none', async t => {
    const none = await frameHost(t, { selected: false });
    await none.send('hi', said('R1.'));
    assert.deepEqual(lines(none), []);
    const fits = await frameHost(t);
    await fits.send('hi', said('R1.'));
    assert.deepEqual(lines(fits), []);
});

test('"changed since this chat began" comes once: a swipe after it does not give it again (REVPF4 12)', async t => {
    const host = await frameHost(t);
    await host.send('hi', said('R1.'));
    assert.equal((await host.packs.packs.install(world('1.1.0'))).ok, true);
    const notes = () => host.turn.problems().filter(entry => entry.code === 'PACK_CHANGED').length;
    await host.swipe(said('R1 again.'));
    assert.equal(notes(), 1);
    await host.swipe(said('R1 a third time.'));
    await host.swipe(said('R1 a fourth time.'));
    assert.equal(notes(), 1, 'once, not on every swipe');
});
