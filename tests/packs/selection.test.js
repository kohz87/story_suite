// Pack format 4, job P5: the store keeps `kind`; the selected world and game (not an on/off list) decide what a chat reads; the trackers of every game pack are
// offered; the start reads the world's place and the game's money and items; format 3 keeps its enabled list byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstalled } from '../../packs/installed.js';
import { mergeStart, applyStart, calendarOf, weatherOf, contentOf } from '../../packs/content.js';
import { fakeSettings } from './helpers/fake-settings.js';
import { itemsPack } from './helpers/fixtures.js';

const REQ = { suite: '^0.1' };
const months = [{ name: 'Frost', days: 30 }, { name: 'Bloom', days: 20 }];
const world = (id, extra = {}) => ({ id, format: 4, kind: 'world', version: '1.0.0', requires: REQ, content: { places: [{ id: 'dock', name: 'The Dock', x: 1, y: 1 }], items: [{ name: 'Rope', kind: 'goods' }], start: { place: 'dock', date: { year: 5, month: 2, day: 3, hour: 7 } }, ...extra } });
const game = (id, content = {}) => ({ id, format: 4, kind: 'game', version: '1.0.0', requires: { ...REQ, capabilities: ['data-modules-v1'] }, content });
const preset = id => ({ id, title: `Preset ${id}`, meters: [{ id: 'regard', name: 'Regard', min: -100, max: 100, start: 0 }] });
const tracker = slug => ({ slug, name: slug, schema: 1, stateVersion: 1, scope: 'chat', kinds: {}, state: { a: { type: 'int', min: 0, max: 5, default: 0 } } });
const full = id => game(id, { calendar: { months, seasons: [{ name: 'cold', months: ['Frost'] }, { name: 'warm', months: ['Bloom'] }] }, currency: { name: 'mark', coins: [{ name: 'mark', value: 1 }] }, start: { money: 12, items: [{ name: 'rope', qty: 2 }, { name: 'Lantern' }] }, weather: { style: 'tables', tables: [{ climate: 'cold', season: 'cold', weather: ['snow'] }] }, meterPresets: [preset(`${id}-p`)] });

const setup = async (...packs) => {
    const settings = fakeSettings();
    const installed = createInstalled({ settings });
    for (const input of packs) { const result = await installed.install(input); assert.equal(result.ok, true, JSON.stringify(result.errors)); }
    return { settings, installed };
};
const ids = installed => installed.packs().map(pack => pack.id);

test('the store keeps kind, and the first world and game installed are selected', async () => {
    const { settings, installed } = await setup(world('w1'), full('g1'));
    assert.deepEqual(settings.root.packs.map(entry => entry.kind), ['world', 'game']);
    assert.deepEqual(installed.selected(), { world: 'w1', game: 'g1' });
    assert.deepEqual(ids(installed), ['w1', 'g1']);
    const [w, g] = installed.list();
    assert.deepEqual([w.kind, w.enabled, g.kind, g.enabled, g.addOn], ['world', true, 'game', true, false]);
});

test('the selection replaces the enabled list: a second world is installed but not read until it is selected', async () => {
    const { settings, installed } = await setup(world('w1'), world('w2', { places: [{ id: 'quay', name: 'The Quay', x: 2, y: 2 }], start: { place: 'quay' } }));
    assert.deepEqual(ids(installed), ['w1']);
    assert.equal(installed.list()[1].enabled, false);
    assert.equal(await installed.select('world', 'w2'), true);
    assert.deepEqual(ids(installed), ['w2']);
    assert.equal(mergeStart(installed.packs()).scene.place.name, 'The Quay');
    assert.deepEqual(settings.root.selected, { world: 'w2' });
    // none on purpose: stays none when another is installed
    assert.equal(await installed.select('world', null), true);
    await installed.install(world('w3'));
    assert.deepEqual(installed.selected(), { world: null, game: null });
    assert.deepEqual(ids(installed), []);
});

test('select refuses what is not installed, of the wrong kind, or an add-on', async () => {
    const { installed } = await setup(world('w1'), game('addon', { dataModules: [tracker('guild')] }));
    assert.equal(await installed.select('world', 'nope'), false);
    assert.equal(await installed.select('game', 'w1'), false);
    assert.equal(await installed.select('game', 'addon'), false);
    assert.equal(await installed.select('colour', 'w1'), false);
    assert.deepEqual(installed.selected(), { world: 'w1', game: null }, 'an add-on is not auto-selected');
    assert.equal(installed.list()[1].addOn, true);
    assert.equal(installed.list()[1].enabled, true, 'an add-on is always offered');
});

test('setEnabled on a format 4 pack selects or clears it; removing the selected pack clears the choice', async () => {
    const { settings, installed } = await setup(world('w1'), world('w2'));
    assert.equal(await installed.setEnabled('w2', true), true);
    assert.deepEqual(installed.selected().world, 'w2');
    assert.equal(await installed.setEnabled('w1', false), true, 'w1 is not the selected one: nothing changes');
    assert.equal(installed.selected().world, 'w2');
    assert.equal(await installed.setEnabled('w2', false), true);
    assert.equal(installed.selected().world, null);
    await installed.select('world', 'w1');
    await installed.remove('w1');
    assert.equal(Object.hasOwn(settings.root.selected, 'world'), false);
});

test('trackers (data modules, meter presets) come from every game pack; nothing else of an unselected game does', async () => {
    const { installed } = await setup(world('w1'), full('g1'), full('g2'), game('addon', { dataModules: [tracker('guild')] }));
    assert.deepEqual(installed.selected(), { world: 'w1', game: 'g1' });
    const packs = installed.packs();
    assert.deepEqual(contentOf(packs, 'meterPresets').map(record => record.id).sort(), ['pack.g1/g1-p', 'pack.g2/g2-p']);
    assert.deepEqual(packs.flatMap(pack => pack.content.dataModules ?? []).map(module => module.slug), ['guild']);
    assert.equal(calendarOf(packs).pack, 'g1');
    assert.equal(weatherOf(packs).pack, 'g1');
    assert.equal(mergeStart(packs).inventory.money, 12, 'only the selected game pays');
    assert.deepEqual(contentOf(packs, 'currency').map(record => record.pack), ['g1']);
    await installed.select('game', 'g2');
    assert.equal(calendarOf(installed.packs()).pack, 'g2');
    await installed.select('game', null);
    assert.equal(calendarOf(installed.packs()), null, 'built-in game: no pack calendar');
    assert.deepEqual(contentOf(installed.packs(), 'meterPresets').length, 2);
});

test('the start: world place and world state, game money and items (world items by name, others made up)', async () => {
    const { installed } = await setup(world('w1'), full('g1'));
    const start = mergeStart(installed.packs());
    assert.deepEqual(start.scene.place, { name: 'The Dock', kind: '', region: '' });
    assert.equal(start.inventory.money, 12);
    assert.deepEqual(start.inventory.items.map(line => [line.def.id, line.qty]), [['pack.w1/rope', 2], ['story/lantern', 1]]);
    assert.deepEqual(start.packs, ['w1', 'g1']);
    let n = 0;
    const state = applyStart({ domains: { scene: { place: null, present: [] }, inventory: {} } }, start, { id: prefix => `${prefix}_${++n}`, coin: 'coin' });
    assert.equal(state.domains.scene.place.name, 'The Dock');
    assert.equal(state.domains.inventory.wallets.party.coin, 12);
    assert.deepEqual(Object.values(state.domains.inventory.stacks).map(stack => [stack.def, stack.qty]), [['pack.w1/rope', 2], ['story/lantern', 1]]);
    // the built-in game: the world alone still places the chat, and nothing is given
    await installed.select('game', null);
    const alone = mergeStart(installed.packs());
    assert.equal(alone.scene.place.name, 'The Dock');
    assert.equal(alone.inventory.items.length, 0);
});

test('the calendar start comes from the world start.date; a month or day the calendar lacks falls back to day 1 of month 1', async () => {
    const { installed } = await setup(world('w1'), full('g1'));
    assert.deepEqual(calendarOf(installed.packs()).start, { year: 5, month: 'Bloom', day: 3, hour: 7, minute: 0 });
    await installed.install(world('w1', { start: { place: 'dock', date: { year: 9, month: 2, day: 25 } } }));
    assert.deepEqual(calendarOf(installed.packs()).start, { year: 9, month: 'Frost', day: 1, hour: 0, minute: 0 });
    await installed.install(world('w1', { start: { place: 'dock', date: { year: 9, month: 3, day: 1 } } }));
    assert.deepEqual(calendarOf(installed.packs()).start, { year: 9, month: 'Frost', day: 1, hour: 0, minute: 0 });
});

test('a stored selection naming a pack that is gone or of the other kind reads as none', async () => {
    const settings = fakeSettings();
    const first = createInstalled({ settings });
    await first.install(world('w1'));
    settings.root.selected = { world: 'gone', game: 'w1' };
    const again = createInstalled({ settings });
    await again.ready({ force: true });
    assert.deepEqual(again.selected(), { world: null, game: null });
    assert.deepEqual(again.packs(), []);
});

test('format 3 keeps its enabled list, and mixes with format 4 without change', async () => {
    const { settings, installed } = await setup(itemsPack('old', [{ name: 'Axe', kind: 'equipment' }]), world('w1'));
    assert.deepEqual(ids(installed), ['old', 'w1']);
    assert.equal(Object.hasOwn(settings.root.packs[0], 'kind'), false, 'a format 3 entry has no kind');
    assert.equal(Object.hasOwn(installed.list()[0], 'kind'), false);
    await installed.setEnabled('old', false);
    assert.deepEqual(ids(installed), ['w1']);
    assert.equal(Object.hasOwn(settings.root, 'selected'), true);
    const { settings: plain, installed: onlyOld } = await setup(itemsPack('old', [{ name: 'Axe', kind: 'equipment' }]));
    assert.equal(Object.hasOwn(plain.root, 'selected'), false, 'no format 4 pack: nothing new is written');
    assert.deepEqual(ids(onlyOld), ['old']);
});

test('weather of a selected game: only season-only tables of style "tables" go to the region-keyed reader; climate tables wait apart', async () => {
    const tables = [{ season: 'cold', weather: ['snow'] }, { climate: 'cold', season: 'cold', weather: ['sleet'] }];
    const { installed } = await setup(world('w1'), game('g1', { calendar: { months, seasons: [{ name: 'cold', months: ['Frost'] }] }, weather: { style: 'tables', tables } }));
    const got = weatherOf(installed.packs());
    assert.deepEqual(got.tables.map(table => table.weather[0]), ['snow']);
    assert.deepEqual(got.climateTables.map(table => table.weather[0]), ['sleet']);
    assert.deepEqual(got.seasons.map(season => season.name), ['cold']);
    await installed.install(game('g1', { calendar: { months }, weather: { style: 'climate', tables } }));
    assert.deepEqual(weatherOf(installed.packs()).tables, [], 'a climate game gives the region-keyed reader nothing to match everywhere');
    await installed.install(game('g1', { calendar: { months }, weather: { style: 'story', tables: [{ season: 'cold', weather: ['x'] }] } }));
    assert.deepEqual([weatherOf(installed.packs()).tables, weatherOf(installed.packs()).climateTables], [[], []]);
});

test('the start place carries the region name; reloading the settings reads the same packs and start', async () => {
    const regions = [{ id: 'the-march', name: 'The March' }];
    const { settings, installed } = await setup(world('w1', { regions, places: [{ id: 'dock', name: 'The Dock', x: 1, y: 1, region: 'the-march' }] }), full('g1'));
    assert.equal(mergeStart(installed.packs()).scene.place.region, 'The March');
    const again = createInstalled({ settings: fakeSettings(settings.root) });
    await again.ready({ force: true });
    assert.deepEqual(again.packs(), installed.packs());
    assert.deepEqual(mergeStart(again.packs()), mergeStart(installed.packs()));
    assert.deepEqual(again.selected(), installed.selected());
});
