// REVPF4 items 3 and 4: a chat that began with nothing selected keeps the built-in game when a world and game are installed later (its calendar, clock and
// money do not move), and a world played with the built-in game starts on its own date and era on the Gregorian calendar (February 29 only in a leap year).
// Replay == live: swipe, swipe back, an edited Re-read (grown and shrunk), a middle delete and a reload keep the seeded clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';

const FROST = [{ name: 'Frost', days: 30 }, { name: 'Bloom', days: 20 }];
const REQ = { suite: '^0.1' };
const DATE = { era: 'AE', year: 612, month: 2, day: 3, hour: 8, minute: 30 };
const world = (date = DATE, id = 'w1') => ({ id, format: 4, kind: 'world', version: '1.0.0', name: id, requires: REQ, content: { places: [{ id: 'dock', name: 'The Dock', x: 1, y: 1 }], items: [], start: { place: 'dock', date } } });
const game = () => ({ id: 'g1', format: 4, kind: 'game', version: '1.0.0', name: 'g1', requires: REQ, content: { calendar: { months: FROST }, currency: { name: 'mark', coins: [{ name: 'mark', value: 1 }] } } });
const said = (text, line = '+ coin 5 | from: Bob') => `${text}\n\n<Changes>\n${line}\n</Changes>`;
const plain = value => JSON.parse(JSON.stringify(value ?? null));

async function newHost(t, packs = []) {
    t.mock.method(console, 'warn', () => {});
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), query: (name, args) => host?.sdk.query(name, args), chat: () => host?.ctx.chat ?? [] } });
    host = await createHost({ modules: [module] });
    t.after(() => host.close());
    for (const pack of packs) assert.equal((await host.packs.packs.install(pack)).ok, true);
    return host;
}
const months = host => plain(host.sdk.query('director.calendar').months).map(month => month.name);
const clock = host => host.sdk.query('director.time');
const reread = async (host, index, text) => {
    await host.st.editMessage(index, text);
    const result = await host.sdk.reread(index);
    assert.equal(result.ok, true, result.message);
};

test('a chat begun with nothing selected: a world and game installed later move neither its calendar, its clock nor its money', async t => {
    const host = await newHost(t);
    await host.send('hi', said('R1.'));
    assert.equal(months(host)[0], 'January');
    await host.packs.packs.install(world());
    await host.packs.packs.install(game());
    assert.deepEqual(host.packs.packs.selected(), { world: 'w1', game: 'g1' });
    await host.send('more', said('R2.'));
    assert.equal(months(host)[0], 'January', 'the game installed later is not this chat\'s');
    assert.equal(clock(host).minutes, null, 'the world installed later does not start the clock');
    assert.equal(host.head().domains.frame.game, 'built-in');
    host.store.rebuild();
    assert.equal(months(host)[0], 'January');
});

test('a world with the built-in game starts on its date and era on the Gregorian calendar; a game installed later moves nothing', async t => {
    const host = await newHost(t, [world()]);
    await host.send('hi', said('R1.'));
    assert.equal(clock(host).text, 'AE 612, February 3, 08:30 am');
    assert.equal(host.sdk.query('director.calendar').era, 'AE', 'the world\'s era');
    assert.equal(host.sdk.query('director.calendar').preset, 'gregorian', 'the real Gregorian preset: weekdays and leap years');
    const at = clock(host).minutes;
    await host.packs.packs.install(game());
    await host.send('more', said('R2.', '! time +1d'));
    assert.equal(months(host)[0], 'January');
    assert.equal(clock(host).minutes, at + 1440);
});

test('February 29: kept in a leap year; in another year the chat starts on January 1 and Problems says so once', async t => {
    const leap = await newHost(t, [world({ ...DATE, year: 612, day: 29 })]);
    await leap.send('hi', said('R1.'));
    assert.equal(clock(leap).text, 'AE 612, February 29, 08:30 am');
    assert.deepEqual(leap.turn.problems().filter(({ code }) => /^PAIR_/.test(code)), []);
    const plainYear = await newHost(t, [world({ ...DATE, year: 611, day: 29 })]);
    await plainYear.send('hi', said('R1.'));
    assert.equal(clock(plainYear).text, 'AE 611, January 1, 08:30 am');
    const lines = plainYear.turn.problems().filter(({ code }) => code === 'PAIR_START_DATE');
    assert.equal(lines.length, 1, 'in Problems, as the world\'s lapsed events are');
    assert.equal(lines[0].quiet, true);
    assert.match(lines[0].message, /February has 28 days in 611 on the built-in Gregorian calendar.*The chat starts on day 1 of month 1 of year 611\./);
    await plainYear.swipe(said('R1 again.'));
    await plainYear.send('more', said('R2.'));
    assert.equal(plainYear.turn.problems().filter(({ code }) => code === 'PAIR_START_DATE').length, 1, 'the list keeps the one line: not again on a swipe or the next reply');
});

test('the seeded clock: swipe, swipe back, an edited Re-read (grown and shrunk), a middle delete and a reload keep it', async t => {
    const host = await newHost(t, [world()]);
    await host.send('a', said('R1.'));
    await host.send('b', said('R2.'));
    await host.send('c', said('R3.'));
    const before = plain(clock(host));
    await host.swipe(said('R3 again.'));
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.deepEqual(plain(clock(host)), before);
    await reread(host, 2, `A longer second reply.\n\n<Changes>\n+ coin 10 | from: Bob\n+ coin 20 | from: Bob\n</Changes>`);
    await reread(host, 2, 'Short.\n\n<Changes>\n+ coin 5 | from: Bob\n</Changes>');
    assert.deepEqual(plain(clock(host)), before);
    host.store.rebuild();
    assert.deepEqual(plain(clock(host)), before, 'a reload');
    await host.st.deleteMessage(4);
    await host.st.deleteMessage(3);
    assert.deepEqual(plain(clock(host)), before, 'a middle delete');
    assert.deepEqual(host.store.problems().map(({ code }) => code), []);
});
