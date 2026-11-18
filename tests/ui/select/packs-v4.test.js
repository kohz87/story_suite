// Pack format 4, job S1: the Packs view-model (when the format 4 page appears, what the pickers hold, the pair's problems in words) and the Start rows' hints.
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPacks } from '../../../ui/select/packs.js';
import { pairLines } from '../../../ui/select/packs-pair.js';
import { selectYouStartRows } from '../../../ui/select/you-start.js';
import { selectSettings } from '../../../ui/select/settings.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../ui/contract/settings.js';
import { store, world, game, suggesting, months, packsView } from '../settings/packs-v4-helpers.js';

const err = (code, message, part) => ({ code, path: 'x', part, message });
const view = (errors, warnings = [], extra = {}) => ({ world: { name: 'Ersveil' }, game: { name: 'Tidewatch rules' }, date: { year: 611, month: 10, day: 1 }, errors, warnings, ...extra });

test('a start date, events, templates, birthdays and name lists become one counted line each, problems first', () => {
    const lines = pairLines(view([
        err('PAIR_EVENT_DATE', '"date:612-07-30": nope.', { kind: 'event', id: 'a' }),
        err('PAIR_START_DATE', 'The start date (month 10, day 1): the calendar has 8 months, not 10.', { kind: 'start', id: 'date' }),
        err('PAIR_EVENT_SEASON', '"season:winter": no.', { kind: 'template', id: 't' }),
    ], [
        err('PAIR_CULTURE', 'The names culture "salt" names no region of Ersveil (Saltreach). It is unused.', { kind: 'culture', id: 'salt' }),
        err('PAIR_BIRTHDAY', 'x', { kind: 'birthday', id: 'p' }),
    ]));
    assert.deepEqual(lines, [
        { level: 'error', text: 'Start date: Tidewatch rules has no month 10, so Ersveil starts on day 1 of month 1, 611.' },
        { level: 'error', text: '1 world event never fires: its date, day 30 of month 7, is not on this calendar.' },
        { level: 'error', text: '1 event template never fires: its season, winter, is not on this calendar.' },
        { level: 'warning', text: '1 birthday is dropped: its month is not on this calendar.' },
        { level: 'warning', text: '1 name list is unused: its region, Saltreach, is not in Ersveil.' },
    ]);
});

test('several of a kind are one line with the count; a day the month lacks says so; no problem gives no line', () => {
    const many = pairLines(view([1, 2, 3].map(n => err('PAIR_EVENT_DATE', `"date:612-0${n}-30": no.`, { kind: 'event', id: `e${n}` })), [1, 2].map(n => err('PAIR_CULTURE', `The names culture "c${n}" names no region of Ersveil (R${n}). It is unused.`, { kind: 'culture', id: `c${n}` }))));
    assert.deepEqual(many.map(l => l.text), ['3 world events never fire: their dates or seasons are not on this calendar.', '2 name lists are unused: their regions are not in Ersveil.']);
    const day = pairLines(view([err('PAIR_START_DATE', 'The start date: Frost has 30 days in X, so day 31 never comes. The chat starts', { kind: 'start', id: 'date' })], [], { date: { year: 5, month: 2, day: 31 } }));
    assert.equal(day[0].text, 'Start date: month 2 of Tidewatch rules has no day 31, so Ersveil starts on day 1 of month 1, 5.');
    assert.deepEqual(pairLines(view([])), []);
    assert.deepEqual(pairLines(null), []);
    assert.equal(pairLines(view([err('PAIR_START_DATE', 'x', {})], [], { game: null }))[0].text.startsWith('Start date: Built-in has no month 10'), true);
});

test('the format 4 page appears only when a format 4 pack is installed; the older packs keep their lines', async () => {
    const none = selectPacks({ list: [{ id: 'old', name: 'Old', version: '1.0.0', enabled: true, counts: {}, extras: [], missing: [], problem: '' }], setup: [] });
    assert.equal('v4' in none, false);
    assert.equal(none.packs.length, 1);
    const installed = await store(world(), game('g1', 'Game one'));
    const both = selectPacks({ list: [...installed.list(), { id: 'old', name: 'Old', version: '1.0.0', enabled: true, counts: {}, extras: [], missing: [], problem: '' }], setup: [] });
    assert.deepEqual(both.packs.map(p => p.id), ['old'], 'the worlds and games are the page\'s own rows');
    assert.deepEqual(both.v4.installed.map(p => [p.id, p.tag]), [['ersveil', 'world'], ['g1', 'game']]);
});

test('pickers: add-ons are not game choices; the one in use is the value; a pack that cannot be used is not offered', async () => {
    const addon = { id: 'standing', format: 4, kind: 'game', version: '3.0.0', name: 'Faction standing', requires: { suite: '^0.1', capabilities: ['data-modules-v1'] }, content: { dataModules: [{ slug: 's', name: 'S', schema: 1, stateVersion: 1, scope: 'chat', kinds: {}, state: { a: { type: 'int', min: 0, max: 5, default: 0 } } }] } };
    const installed = await store(world(), game('g1', 'Game one'), addon, game('g2', 'Game two'));
    await installed.select('game', 'g2');
    const { v4 } = packsView(installed);
    assert.deepEqual(v4.game.options.map(o => o.value), ['', 'g1', 'g2']);
    assert.equal(v4.game.value, 'g2');
    assert.equal(v4.world.value, 'ersveil');
    assert.deepEqual(v4.addOns.map(a => [a.id, a.tag]), [['standing', 'add-on']]);
    assert.match(v4.addOns[0].desc, /1 data module; offered in every chat, beside any game$/);
    await installed.select('world', null);
    assert.equal(packsView(installed).v4.world.value, '');
});

test('what a world and a game hold, in the mock\'s words', async () => {
    const installed = await store(world({}, { date: { year: 1, month: 1, day: 1 } }), game('g1', 'Game one', { you: { rank: { label: 'Rank' } }, currency: { name: 'copper', coins: [{ name: 'copper', value: 1 }, { name: 'silver', value: 10 }] }, start: { money: 4 }, calendar: { months: months(12) } }));
    const { v4 } = packsView(installed);
    assert.match(v4.installed[0].desc, /^1 place$/);
    assert.equal(v4.installed[1].desc, 'a calendar · 2 coins · rank · your start');
});

test('data modules name the pack they come from, by its name on the format 4 page and by its id otherwise', async () => {
    const installed = await store(world(), game('g1', 'Game one'));
    const setup = [{ module: 'm', packId: 'g1', definition: { name: 'Standing' }, pinned: false, available: true, status: 'Ready' }];
    assert.equal(selectPacks({ list: installed.list(), setup }).modules[0].desc, 'from Game one · Ready');
    assert.equal(selectPacks({ list: [], setup }).modules[0].desc, 'from g1 · Ready');
});

test('the Start rows say what blank means for the game in use, and for the built-in game', async () => {
    const installed = await store(world(), game('g1', 'Game one', { you: { rank: { label: 'Guild rank' } }, start: { money: 40, items: [{ name: 'Rope' }, { name: 'Lantern' }] } }));
    const { ownView } = await import('../../../packs/index-parts/page-queries.js');
    const rows = selectYouStartRows(ownView(installed));
    assert.deepEqual(rows.map(r => [r.key, r.type, r.group]), [['packs.you.rankLabel', 'txt', 'You and your start'], ['packs.start.money', 'num', 'You and your start'], ['packs.start.items', 'lines', 'You and your start']]);
    assert.match(rows[1].hint, /^For new chats, in the smallest coin\. Blank: the game pack’s \(Game one: 40 gold\)$/);
    assert.match(rows[2].hint, /^For new chats; your list replaces/);
    assert.match(rows[2].hint, /\(Game one: Rope, Lantern\)$/);
    await installed.select('game', null);
    const built = selectYouStartRows(ownView(installed));
    assert.match(built[0].hint, /Blank: none \(the built-in game has none\)$/);
    assert.equal(built[1].unit, 'gold', 'the built-in game counts in gold');
    assert.equal(selectYouStartRows(ownView(installed), { coins: [{ name: 'penny', value: 1 }, { name: 'crown', value: 12 }], currency: 'gold' })[1].unit, 'penny', 'the reader\'s coins first: the smallest');
    assert.equal(selectYouStartRows(ownView(installed), { coins: [], currency: 'mark' })[1].unit, 'mark');
    assert.deepEqual(selectYouStartRows(null).map(r => r.value), ['', null, '']);
});

test('Settings carries the format 4 page and the Start rows to the contract shape, and without a format 4 pack has neither', async () => {
    const installed = await store(suggesting('g2'), game('g1', 'Game one'));
    const { pairingView, ownView } = await import('../../../packs/index-parts/page-queries.js');
    const on = selectSettings({ features: [], packsAnswers: { list: installed.list(), setup: [], pairing: pairingView(installed), own: ownView(installed) } });
    assert.deepEqual(checkShape(on, SETTINGS_SHAPE), []);
    assert.equal(on.sections.find(s => s.id === 'start').rows.length, 3);
    assert.equal(on.sections.find(s => s.id === 'packs').desc, 'Your world and game, add-on packs, data modules and your trackers.');
    const off = selectSettings({ features: [], packsAnswers: { list: [], setup: [] } });
    assert.deepEqual([off.sections.find(s => s.id === 'start').rows, off.sections.find(s => s.id === 'packs').desc], [[], 'Content packs, data modules and your trackers.']);
});

test('a world that cannot be used is listed under worlds and games with its problem, not as an older pack and not as a choice', () => {
    const rows = [{ id: 'bad', name: 'bad', version: '1.0.0', kind: 'world', addOn: false, enabled: true, counts: {}, extras: [], missing: [], problem: 'a route needs a kind' }, { id: 'old', name: 'Old', version: '1', enabled: true, counts: {}, extras: [], missing: [], problem: '' }];
    const vm = selectPacks({ list: rows, setup: [] });
    assert.deepEqual(vm.packs.map(p => p.id), ['old']);
    assert.deepEqual(vm.v4.installed.map(p => [p.id, p.problem]), [['bad', 'Not usable: a route needs a kind']]);
    assert.deepEqual(vm.v4.world.options.map(o => o.value), ['']);
    assert.equal(vm.v4.world.value, '');
});

test('a format 3 entry stored before X1: the one kind-less row, under Packs alone or under Older packs beside a world, marked Not usable with the converter named', async () => {
    const { createPacksPart } = await import('../../../packs/index-parts/build.js');
    const { fakeSettings } = await import('../../packs/helpers/fake-settings.js');
    const { sample } = await import('../../packs/helpers/fixtures.js');   // (the frozen format 3 copy)
    const made = createPacksPart({ settings: fakeSettings({ packs: [{ id: 'riverside-starter', version: '3.0.0', enabled: true, source: 'file', pack: sample() }] }) });
    await made.packs.ready({ force: true });
    const alone = selectPacks({ list: made.packs.list(), setup: [] });
    assert.equal(alone.v4, undefined, 'no world or game: the page without pickers');
    assert.deepEqual(alone.packs.map(row => row.id), ['riverside-starter']);
    assert.match(alone.packs[0].problem, /format 3; this suite reads format 4 only.*scripts\/packs\/convert-3to4\.mjs/);
    assert.match(alone.packs[0].desc, /Not usable: /);
    assert.equal((await made.packs.install({ id: 'w1', format: 4, kind: 'world', version: '1.0.0', requires: { suite: '^0.1' }, content: {} })).ok, true);
    const beside = selectPacks({ list: made.packs.list(), setup: [] });
    assert.deepEqual(beside.v4.installed.map(row => row.id), ['w1']);
    assert.deepEqual(beside.packs.map(row => row.id), ['riverside-starter'], 'the Older packs (format 3) group');
    assert.ok(beside.packs[0].problem);
});
