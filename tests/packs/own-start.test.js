// Pack format 4, job S1: the reader's own rank label and starting money and items come before the selected game's; blank means the game's; format 3 is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstalled } from '../../packs/installed.js';
import { createPacksPart } from '../../packs/index-parts/build.js';
import { parseItems, itemsText, createOwn } from '../../packs/own.js';
import { withOwnStart } from '../../packs/content-parts/own-start.js';
import { mergeStart, youRankOf } from '../../packs/content.js';
import { fakeSettings } from './helpers/fake-settings.js';
import { sample } from './helpers/fixtures.js';

const REQ = { suite: '^0.1' };
const world = { id: 'w1', format: 4, kind: 'world', version: '1.0.0', requires: REQ, content: { items: [{ name: 'Rope', kind: 'goods' }] } };
const game = { id: 'g1', format: 4, kind: 'game', version: '1.0.0', requires: REQ, content: { you: { rank: { label: 'Guild rank' } }, start: { money: 40, items: [{ name: 'Lantern' }] } } };

async function part(...packs) {
    const settings = fakeSettings();
    const made = createPacksPart({ settings });
    for (const input of packs) assert.equal((await made.packs.install(input)).ok, true);
    return { settings, made, query: (name, args) => made.part.queries[name](null, args, {}) };
}

test('the editor text and the stored list round-trip; a bad line is skipped and a quantity is kept to 1-999', () => {
    assert.deepEqual(parseItems('Rope x3\n\n  Lantern \nrope X0\nTorch x5000'), [{ name: 'Rope', qty: 3 }, { name: 'Lantern', qty: 1 }, { name: 'rope', qty: 1 }, { name: 'Torch', qty: 999 }]);
    assert.equal(itemsText([{ name: 'Rope', qty: 3 }, { name: 'Lantern', qty: 1 }]), 'Rope x3\nLantern');
    assert.equal(parseItems('x'.repeat(200).concat('\n'.repeat(3)))[0].name.length, 60);
    assert.equal(parseItems(Array.from({ length: 40 }, (_, n) => `item${n}`).join('\n')).length, 20);
});

test('own values are read back clean: a whole money from 0, a trimmed label, blank clears', () => {
    const root = {};
    const own = createOwn(() => root);
    assert.deepEqual(own.read(), { rankLabel: '', money: null, items: [] });
    assert.equal(own.set('money', '25'), true);
    assert.equal(own.set('rankLabel', '  Standing  '), true);
    assert.equal(own.set('items', 'Rope x2'), true);
    assert.deepEqual(own.read(), { rankLabel: 'Standing', money: 25, items: [{ name: 'Rope', qty: 2 }] });
    assert.equal(own.set('money', '1.5'), false);
    assert.equal(own.set('money', -3), false);
    assert.equal(own.set('colour', 'red'), false);
    assert.equal(own.read().money, 25, 'a refused value changes nothing');
    own.set('money', ''); own.set('rankLabel', ''); own.set('items', '');
    assert.deepEqual(own.read(), { rankLabel: '', money: null, items: [] });
    assert.deepEqual(root.you, {}); assert.equal(root.start.money, undefined);
    assert.deepEqual(own.read(), { rankLabel: '', money: null, items: [] });
});

test('withOwnStart: nothing set returns the very same start; money and a list replace the game\'s; names match the world\'s items', async () => {
    const { made } = await part(world);
    const worldItems = made.packs.packs()[0].content.items;
    const start = { scene: { place: null, present: [] }, inventory: { items: [], money: 40 }, currency: null, packs: ['g1'], problems: [] };
    assert.equal(withOwnStart(start, { money: null, items: [] }), start);
    const out = withOwnStart(start, { money: 5, items: [{ name: 'rope', qty: 2 }, { name: 'Boots', qty: 1 }] }, worldItems);
    assert.equal(out.inventory.money, 5);
    assert.deepEqual(out.inventory.items.map(line => [line.def.name, line.qty]), [['Rope', 2], ['Boots', 1]]);
    assert.deepEqual(out.packs, ['g1', 'settings']);
    assert.equal(start.inventory.money, 40, 'the merged start is not changed');
    assert.equal(withOwnStart(start, { money: 0, items: [] }).inventory.money, 0, 'a start of 0 is a choice');
});

test('youRankOf: the reader\'s label comes first; blank gives the pack\'s; no pack and no label is no Rank', () => {
    const packs = [{ id: 'g1', content: { you: { rank: { label: 'Guild rank' } } } }];
    assert.deepEqual(youRankOf(packs), { pack: 'g1', label: 'Guild rank' });
    assert.deepEqual(youRankOf(packs, '  '), { pack: 'g1', label: 'Guild rank' });
    assert.deepEqual(youRankOf(packs, 'Standing'), { pack: null, label: 'Standing' });
    assert.equal(youRankOf([]), null);
});

test('the packs part answers with the reader\'s own values over the game\'s, and falls back to the game\'s when they are cleared', async () => {
    const { made, query } = await part(world, game);
    assert.deepEqual(query('packs.youRank'), { pack: 'g1', label: 'Guild rank' });
    assert.equal(query('packs.start').inventory.money, 40);
    await made.packs.setOwn('rankLabel', 'Standing');
    await made.packs.setOwn('money', '7');
    await made.packs.setOwn('items', 'Rope x2');
    assert.deepEqual(query('packs.youRank'), { pack: null, label: 'Standing' });
    const start = query('packs.start');
    assert.equal(start.inventory.money, 7);
    assert.deepEqual(start.inventory.items.map(line => [line.def.name, line.qty]), [['Rope', 2]]);
    await made.packs.setOwn('rankLabel', ''); await made.packs.setOwn('money', ''); await made.packs.setOwn('items', '');
    assert.deepEqual(query('packs.youRank'), { pack: 'g1', label: 'Guild rank' });
    assert.equal(query('packs.start').inventory.money, 40);
});

test('replay: a reload over the same settings, and a swap of the selection and back, give the same rank and start', async () => {
    const { settings, made, query } = await part(world, game);
    await made.packs.setOwn('money', '9');
    const again = createPacksPart({ settings });
    await again.packs.ready({ force: true });
    assert.deepEqual(again.part.queries['packs.start'](null, {}, {}), query('packs.start'));
    await made.packs.select('game', null);
    assert.equal(query('packs.start').inventory.money, 9, 'the reader\'s money stays when the game is Built-in');
    await made.packs.select('game', 'g1');
    assert.deepEqual(again.part.queries['packs.start'](null, {}, {}), query('packs.start'));
});

test('format 3 is unchanged: with nothing set the start and the rank are what the packs give, and no key is written', async () => {
    const settings = fakeSettings();
    const made = createPacksPart({ settings });
    assert.equal((await made.packs.install(sample())).ok, true);
    const before = JSON.stringify(settings.root);
    assert.deepEqual(made.startState(), mergeStart(made.packs.packs()));
    assert.equal(made.part.queries['packs.youRank'](null, {}, {}), youRankOf(made.packs.packs()));
    assert.equal(JSON.stringify(settings.root), before);
    assert.equal(Object.hasOwn(settings.root, 'you') || Object.hasOwn(settings.root, 'start'), false);
});

test('a pack added, removed or switched leaves the reader\'s own values alone, and install keeps them', async () => {
    const { settings, made } = await part(world, game);
    await made.packs.setOwn('money', '3');
    await made.packs.remove('g1');
    assert.equal(settings.root.start.money, 3);
    assert.equal(createInstalled({ settings }).own.read().money, 3);
});

test('the reader\'s own values count only while a format 4 world or game is installed: after the last is removed the start and the rank are the packs\'', async () => {
    const { settings, made, query } = await part(world, game);
    assert.equal((await made.packs.install(sample())).ok, true);
    await made.packs.setOwn('rankLabel', 'Standing'); await made.packs.setOwn('money', '7'); await made.packs.setOwn('items', 'Rope');
    assert.equal(query('packs.youRank').label, 'Standing');
    await made.packs.remove('w1'); await made.packs.remove('g1');
    assert.deepEqual(made.packs.own.read(), { rankLabel: '', money: null, items: [] });
    assert.deepEqual(made.startState(), mergeStart(made.packs.packs()), 'only a format 3 pack is left: its start as it is');
    assert.equal(query('packs.youRank'), youRankOf(made.packs.packs()));
    assert.equal(made.startState().packs.includes('settings'), false);
    for (const entry of [...settings.root.packs]) await made.packs.remove(entry.id);
    assert.deepEqual(made.startState(), mergeStart([]), 'no pack at all: no start');
    assert.equal(query('packs.youRank'), null);
    await made.packs.install(world);
    assert.equal(made.packs.own.read().money, 7, 'the values were kept: a format 4 pack again brings them back');
});
