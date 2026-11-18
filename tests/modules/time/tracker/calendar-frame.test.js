// Pack format 4, job T1: the chat's calendar is the game's, read from the chat's frame once it has one (a game swapped in Settings later does not
// move the chat's dates), the preset `game` (format 3's `pack` read as `game`), and the start date is the selected world's `start.date`.
// Replay == live: swipe, swipe back, an edited Re-read (grown and shrunk), a middle delete, a rewind and a reload leave the calendar and the clock as they were.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { GAME_PRESET, calendarConfig, calendarOf, packCalendarOf, settingsDefaults } from '../../../../modules/time/tracker/time.js';
import { packCalendarFields } from '../../../../modules/time/tracker/calendar-settings.js';

const FROST = [{ name: 'Frost', days: 30 }, { name: 'Bloom', days: 20 }];
const SUN = [{ name: 'Sun', days: 10 }];
const REQ = { suite: '^0.1' };
const DATE = { era: 'AE', year: 5, month: 2, day: 3, hour: 8, minute: 30 };
const world = () => ({ id: 'w1', format: 4, kind: 'world', version: '1.0.0', name: 'W', requires: REQ, content: { places: [{ id: 'dock', name: 'The Dock', x: 1, y: 1 }], items: [], start: { place: 'dock', date: DATE } } });
const game = (id, months, extra = {}) => ({ id, format: 4, kind: 'game', version: '1.0.0', name: id, requires: REQ, content: { calendar: { months, ...extra } } });
const said = (text, line = '+ coin 5 | from: Bob') => `${text}\n\n<Changes>\n${line}\n</Changes>`;
const plain = value => JSON.parse(JSON.stringify(value ?? null));

async function newHost(t) {
    t.mock.method(console, 'warn', () => {});
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), query: (name, args) => host?.sdk.query(name, args), chat: () => host?.ctx.chat ?? [] } });
    host = await createHost({ modules: [module] });
    t.after(() => host.close());
    const packs = host.packs.packs;
    for (const pack of [world(), game('g1', FROST, { era: 'GE', week: ['Mon', 'Tue'], leapYears: true })]) assert.equal((await packs.install(pack)).ok, true);
    return host;
}
async function swap(host) {
    assert.equal((await host.packs.packs.install(game('g2', SUN))).ok, true);
    assert.equal(await host.packs.packs.select('game', 'g2'), true);
}
const names = host => plain(host.sdk.query('director.calendar').months).map(month => month.name);
const clock = host => host.sdk.query('director.time');
const reread = async (host, index, text) => {
    await host.st.editMessage(index, text);
    const result = await host.sdk.reread(index);
    assert.equal(result.ok, true, result.message);
};

test('packCalendarOf: the frame\'s calendar when the chat has one, the live game\'s without; the built-in game in a frame is no calendar', () => {
    const live = { pack: 'g2', world: 'w1', era: '', months: SUN, start: { year: 5, month: 'Sun', day: 3, hour: 0, minute: 0 } };
    const framed = (game, calendar, world = { pack: 'w1' }) => ({ set: true, world, game, calendar });
    const query = frame => (name) => {
        if (name === 'packs.calendar') return structuredClone(live);
        if (name === 'packs.frame') return frame;
        throw new Error(`no ${name}`);
    };
    assert.deepEqual(packCalendarOf(query(null)).months, SUN, 'no frame: live');
    assert.deepEqual(packCalendarOf(query({ set: false })).months, SUN, 'a frame not written yet: live');
    const out = packCalendarOf(query(framed({ pack: 'g1' }, { era: 'GE', months: FROST })));
    assert.deepEqual([out.pack, out.era, out.months, out.start], ['g1', 'GE', FROST, null], 'the frame\'s; the live start is another game\'s, so none');
    assert.deepEqual(packCalendarOf(query(framed({ pack: 'g2' }, { months: SUN }))).start, live.start, 'the start of the selected world while the game is the chat\'s');
    assert.equal(packCalendarOf(query(framed({ pack: 'g2' }, { months: SUN }, { pack: 'w2' }))).start, null, 'another world than the chat began with gives no start');
    assert.equal(packCalendarOf(query(framed({ pack: 'g2' }, { months: SUN }, null))).start, null, 'a chat begun without a world is not started by one installed later');
    assert.equal(packCalendarOf(query(framed('built-in', null))), null, 'a built-in game stays Gregorian whatever is selected later');
    assert.equal(packCalendarOf(() => { throw new Error('none'); }), null);
    assert.equal(packCalendarOf(null), null);
});

test('the preset is game: format 3\'s pack reads as game; leap years and the week of the game calendar are used', () => {
    assert.equal(settingsDefaults().calendar.preset, GAME_PRESET);
    const calendar = { pack: 'g1', era: 'GE', months: FROST, leapYears: true, week: ['Mon', 'Tue'] };
    for (const preset of ['game', 'pack']) {
        const config = calendarConfig({ calendar: { ...settingsDefaults().calendar, preset } }, calendar);
        assert.deepEqual([config.era, config.months.length, config.leapYears, config.week], ['GE', 2, true, ['Mon', 'Tue']], preset);
    }
    assert.equal(calendarConfig({ calendar: { preset: 'gregorian' } }, calendar).preset, 'gregorian');
    assert.deepEqual(packCalendarFields(calendar), { era: 'GE', months: FROST, leapYears: true, week: 'Mon, Tue' });
    assert.equal(calendarOf({}, calendar).config.leapYears, true);
});

test('the first reply starts the clock on the world\'s date on the game\'s calendar; a game swapped later moves neither', async t => {
    const host = await newHost(t);
    await host.send('hi', said('R1.'));
    const frame = host.head().domains.frame;
    assert.equal(frame.calendar.era, 'AE', 'the world\'s era comes before the game calendar\'s');
    assert.deepEqual(names(host), ['Frost', 'Bloom']);
    const at = clock(host);
    assert.equal(at.text, 'AE 5, Bloom 3, 08:30 am', 'the world start.date, month 2 of the game calendar');
    assert.equal(host.sdk.query('director.calendar').era, 'AE');
    await swap(host);
    assert.deepEqual(plain(host.packs.part.queries['packs.calendar']().months), SUN, 'Settings read the new game live');
    assert.deepEqual(names(host), ['Frost', 'Bloom'], 'the chat keeps the frame\'s calendar');
    await host.send('again', said('R2.', '! time +1d'));
    assert.deepEqual(names(host), ['Frost', 'Bloom']);
    assert.equal(clock(host).minutes, at.minutes + 1440, 'the clock moves on the frame\'s calendar');
});

test('swipe, swipe back, an edited Re-read (grown and shrunk), a middle delete and a reload keep the calendar', async t => {
    const host = await newHost(t);
    await host.send('a', said('R1.'));
    await host.send('b', said('R2.'));
    await host.send('c', said('R3.'));
    const before = plain(clock(host));
    await swap(host);
    await host.swipe(said('R3 again.'));
    assert.deepEqual(names(host), ['Frost', 'Bloom']);
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.deepEqual(names(host), ['Frost', 'Bloom']);
    await reread(host, 2, `A longer first reply.\n\n<Changes>\n+ coin 10 | from: Bob\n+ coin 20 | from: Bob\n</Changes>`);
    assert.deepEqual(names(host), ['Frost', 'Bloom']);
    await reread(host, 2, 'Short.\n\n<Changes>\n+ coin 5 | from: Bob\n</Changes>');
    assert.deepEqual(names(host), ['Frost', 'Bloom']);
    host.store.rebuild();
    assert.deepEqual(names(host), ['Frost', 'Bloom'], 'a reload');
    assert.deepEqual(plain(clock(host)), before, 'the clock is where it was');
    await host.st.deleteMessage(4);
    await host.st.deleteMessage(3);
    assert.deepEqual(names(host), ['Frost', 'Bloom'], 'a middle delete');
    assert.deepEqual(host.store.problems().map(({ code }) => code), []);
});

test('a rewind before the frame drops it, and the next reply takes the game selected then', async t => {
    const host = await newHost(t);
    await host.send('a', said('R1.'));
    await swap(host);
    await host.st.deleteMessage(2);
    await host.st.deleteMessage(1);
    await host.st.deleteMessage(0);
    await host.send('fresh', said('R1.'));
    assert.deepEqual(names(host), ['Sun'], 'the frame that began the chat again');
});
