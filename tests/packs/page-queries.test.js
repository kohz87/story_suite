// Pack format 4, job S1: the Packs page's two answers: the selected pair's problems and suggestion, and the reader's own start values beside the game's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstalled } from '../../packs/installed.js';
import { pairingView, ownView } from '../../packs/index-parts/page-queries.js';
import { fakeSettings } from './helpers/fake-settings.js';

const REQ = { suite: '^0.1' };
const months = n => Array.from({ length: n }, (_, i) => ({ name: `M${i + 1}`, days: 30 }));
const world = (extra = {}, start = { date: { year: 611, month: 10, day: 1 } }) => ({ id: 'ersveil', format: 4, kind: 'world', version: '4.0.0', name: 'Ersveil', requires: REQ, ...extra, content: { start } });
const game = (id, content = {}, version = '1.0.0') => ({ id, format: 4, kind: 'game', version, name: `${id} rules`, requires: REQ, content });

async function setup(...packs) {
    const installed = createInstalled({ settings: fakeSettings() });
    for (const input of packs) assert.equal((await installed.install(input)).ok, true);
    return installed;
}

test('a start date the game\'s calendar lacks is an error of the pair; the built-in game takes the same date', async () => {
    const installed = await setup(world(), game('tide', { calendar: { months: months(8) } }));
    const view = pairingView(installed);
    assert.deepEqual([view.world.id, view.game.id, view.date.month], ['ersveil', 'tide', 10]);
    assert.deepEqual(view.errors.map(error => error.code), ['PAIR_START_DATE']);
    await installed.select('game', null);
    const builtIn = pairingView(installed);
    assert.deepEqual([builtIn.game, builtIn.errors.length], [null, 0], 'month 10 is on the built-in calendar');
});

test('no world selected: nothing to check', async () => {
    const installed = await setup(world(), game('tide', { calendar: { months: months(8) } }));
    await installed.select('world', null);
    const view = pairingView(installed);
    assert.deepEqual([view.world, view.errors, view.warnings, view.recommends], [null, [], [], null]);
});

test('the suggested game: installed (in range), not installed, out of range, and the one in use', async () => {
    const suggest = version => world({ recommends: { game: { id: 'ersveil-game', version } } });
    let installed = await setup(suggest('^1.0'), game('tide', { calendar: { months: months(8) } }));
    assert.deepEqual(pairingView(installed).recommends, { id: 'ersveil-game', version: '^1.0', name: 'ersveil-game', installed: false, selected: false });
    await installed.install(game('ersveil-game', { calendar: { months: months(12) } }));
    assert.deepEqual(pairingView(installed).recommends, { id: 'ersveil-game', version: '^1.0', name: 'ersveil-game rules', installed: true, selected: false });
    await installed.select('game', 'ersveil-game');
    assert.equal(pairingView(installed).recommends.selected, true);
    installed = await setup(suggest('^2.0'), game('ersveil-game', { calendar: { months: months(12) } }, '1.4.0'));
    assert.equal(pairingView(installed).recommends.installed, false, 'a game outside the suggested range is not the one suggested');
    installed = await setup(world(), game('tide', { calendar: { months: months(8) } }));
    assert.equal(pairingView(installed).recommends, null);
});

test('own: the reader\'s values and the selected game\'s, with its smallest coin; none for the built-in game', async () => {
    const installed = await setup(world(), game('g1', { you: { rank: { label: 'Guild rank' } }, currency: { name: 'copper', coins: [{ name: 'copper', value: 1 }, { name: 'silver', value: 10 }] }, start: { money: 40, items: [{ name: 'Rope' }] } }));
    await installed.setOwn('rankLabel', 'Mine');
    assert.deepEqual(ownView(installed), { own: { rankLabel: 'Mine', money: null, items: [] }, game: { name: 'g1 rules', rankLabel: 'Guild rank', money: 40, coin: 'copper', items: ['Rope'] } });
    await installed.select('game', null);
    assert.equal(ownView(installed).game, null);
});

test('refused values change nothing and are not saved', async () => {
    const installed = await setup(world(), game('g1', { calendar: { months: months(8) } }));
    assert.equal(await installed.setOwn('money', '2.5'), false);
    assert.equal(await installed.setOwn('nope', 'x'), false);
    assert.equal(installed.own.read().money, null);
});
