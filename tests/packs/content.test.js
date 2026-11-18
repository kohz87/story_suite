// Lookups over enabled packs: item resolution precedence, content by kind, start states.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStart, contentOf, itemDef, mergeStart, resolveItemIn } from '../../packs/content.js';
import { validatePack } from '../../packs/validate.js';
import { readFileSync } from 'node:fs';
import { itemsPack, pack } from './helpers/fixtures.js';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const riverside = () => fixture('riverside-starter.json');
const riversideGame = () => fixture('riverside-starter.game.json');
// A world pack with a place to start in, and a game pack with its start: the two halves of a format 4 start.
const world = (id, items, place, extra = {}) => pack({ id, content: { items, places: [{ id: place.toLowerCase(), name: place, kind: 'settlement', x: 0, y: 0 }], placeKinds: { settlement: 'town' }, start: { place: place.toLowerCase() }, ...extra } });
const game = (id, content) => ({ id, format: 4, kind: 'game', version: '1.0.0', requires: { suite: '^0.1' }, content });

const normalized = (...packs) => packs.map(input => {
    const result = validatePack(input);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    return result.pack;
});

test('a resolved item is an inventory def (SPEC §7) and a fresh copy', () => {
    const [side] = normalized(riverside());
    const def = resolveItemIn([side], 'Minor Healing Draught');
    assert.deepEqual(def, {
        id: 'pack.riverside-starter/minor-healing-draught', name: 'Minor Healing Draught', kind: 'consumable', rarity: 'common',
        value: 60, stack: true, slot: null, stats: {}, effect: { heal: 20 }, tags: [], note: '',
    });
    def.effect.heal = 999;
    assert.equal(resolveItemIn([side], 'Minor Healing Draught').effect.heal, 20);
    assert.deepEqual(Object.keys(itemDef(side.content.items[0])), ['id', 'name', 'kind', 'rarity', 'value', 'stack', 'slot', 'stats', 'effect', 'tags', 'note']);
});

test('item resolution precedence', () => {
    const packs = normalized(
        itemsPack('alpha', [{ name: 'Rope', value: 3 }, { name: 'Lantern Oil', slug: 'oil' }]),
        itemsPack('beta', [{ name: 'Rope', value: 9 }, { name: 'Coil', aliases: ['hemp rope'] }, { name: 'Iron Sword' }, { name: 'Lamp Oil', slug: 'lamp-oil', aliases: ['oil'] }]),
    );
    const id = name => resolveItemIn(packs, name)?.id ?? null;
    assert.equal(id('Rope'), 'pack.alpha/rope', 'the earlier pack wins a shared name');
    assert.equal(id('  ROPE '), 'pack.alpha/rope', 'case and spaces do not matter');
    assert.equal(id('Ｒope'), 'pack.alpha/rope', 'nor full-width letters');
    assert.equal(id('pack.beta/rope'), 'pack.beta/rope', 'a full ID names exactly that item');
    assert.equal(id('pack.gamma/rope'), null);
    assert.equal(id('hemp rope'), 'pack.beta/coil', 'an alias');
    assert.equal(id('oil'), 'pack.beta/lamp-oil', 'a name or alias beats an earlier pack\'s slug');
    assert.equal(id('Iron-Sword!'), 'pack.beta/iron-sword', 'the slug as a last resort');
    assert.equal(id('Lantern-Oil'), null, 'the slug is the item\'s slug, not its name\'s');
    assert.equal(id('Moonveil Trout'), null);
    assert.equal(id(''), null);
    assert.equal(id('???'), null);
    assert.equal(id(undefined), null);
    assert.equal(resolveItemIn([], 'Rope'), null);
});

test('content by kind, in pack order, with full IDs', () => {
    const packs = normalized(riverside(), pack({ id: 'extra', content: { foes: [{ name: 'Mire Toad', tier: 'minion' }] } }));
    assert.deepEqual(contentOf(packs, 'foes').map(record => [record.id, record.pack, record.tier]), [['pack.riverside-starter/weir-rat', 'riverside-starter', 'mob'], ['pack.extra/mire-toad', 'extra', 'minion']]);
    assert.deepEqual(contentOf(packs, 'foes', { pack: 'extra' }).map(record => record.name), ['Mire Toad']);
    // (the kinds nothing reads any more, and the format 3 events, theme, layouts and screens, answer nothing)
    for (const kind of ['quests', 'creatures', 'shops', 'recipes', 'races', 'talents', 'layouts', 'screens', 'events', 'theme', 'spells']) assert.deepEqual(contentOf(packs, kind), [], kind);
    assert.throws(() => { contentOf(packs, 'foes')[0].name = 'Changed'; }, TypeError);
    assert.equal(contentOf(packs, 'foes')[0].name, 'Weir Rat', 'callers get the pack\'s frozen records');
});

test('start states merge in pack order: the world gives the place, the games give money and items', () => {
    const packs = normalized(
        world('a', [{ name: 'Rope' }, { name: 'Torch' }], 'Bluewatch'),
        world('b', [{ name: 'Rope' }], 'Elsewhere'),
        game('g1', { currency: { name: 'Gil' }, start: { money: 50, items: [{ name: 'rope' }, { name: 'Torch', qty: 2, note: 'oiled' }] } }),
        game('g2', { start: { money: 27, items: [{ name: 'Rope', qty: 2 }, { name: 'Lamp' }] } }),
        pack({ id: 'quiet', content: { items: [{ name: 'Rope' }] } }),
    );
    const start = mergeStart(packs);
    assert.deepEqual(start.scene, { place: { name: 'Bluewatch', kind: 'settlement', region: '' }, present: [] }, 'the first pack that names a place');
    assert.deepEqual(start.inventory.items.map(line => [line.def.id, line.qty, line.note]), [
        ['pack.a/rope', 3, ''], ['pack.a/torch', 2, 'oiled'], ['story/lamp', 1, ''],
    ], 'a name is matched to the first world\'s item; an unknown name is a story item; the same def and note add up');
    assert.equal(start.inventory.money, 77);
    assert.deepEqual(start.currency, { name: 'Gil', short: '' });
    assert.deepEqual(start.packs, ['a', 'g1', 'g2']);
    assert.deepEqual(start.problems, []);
    assert.deepEqual(mergeStart([]), { scene: { place: null, present: [] }, inventory: { items: [], money: 0 }, currency: null, packs: [], problems: [] });
    // Without world a, its items are not there to match: the same names are the other world's item and plain story items.
    const later = mergeStart(packs.slice(1));
    assert.deepEqual(later.inventory.items.map(line => line.def.id), ['pack.b/rope', 'story/torch', 'story/lamp']);
    assert.equal(later.scene.place.name, 'Elsewhere');
});

test('the sample pair\'s start', () => {
    const start = mergeStart(normalized(riverside(), riversideGame()));
    assert.deepEqual(start.scene, { place: { name: 'Bluewatch Village', kind: 'settlement', region: 'the Lowmere' }, present: [] });
    // the game pack names the rod by its slug, which is not a name or alias of the world's item: a plain story item
    assert.deepEqual(start.inventory.items.map(line => [line.def.id, line.qty]), [['story/willow-rod', 1], ['pack.riverside-starter/hemp-line', 3], ['pack.riverside-starter/minor-healing-draught', 1]]);
    assert.deepEqual(start.inventory.items[2].aliases, ['healing draught']);
    assert.equal(start.inventory.money, 50);
    assert.deepEqual(start.currency, { name: 'pennies', short: 'p' });
    assert.equal(start.inventory.items[1].def.stack, true, 'a material stacks');
});

test('applyStart writes the merged start into an initial state', () => {
    const packs = normalized(world('a', [{ name: 'Rope', aliases: ['cord'] }, { name: 'Torch', stack: false }], 'Bluewatch'), game('g', { start: { money: 5, items: [{ name: 'Rope', qty: 3 }, { name: 'Torch', qty: 2 }] } }));
    const initial = {
        v: 2, meta: { rev: 0, claims: {} },
        domains: {
            scene: { place: { name: '', kind: '', region: '' }, present: ['hollis'] },
            inventory: { defs: {}, stacks: {}, wallets: { party: { copper: 1 } }, aliases: { cord: 'story/cord' } },
            party: { actors: {} },
        },
    };
    let n = 0;
    const id = prefix => `${prefix}_${String(++n).padStart(8, '0')}`;
    const next = applyStart(initial, mergeStart(packs), { id, coin: 'copper' });
    assert.notEqual(next, initial);
    assert.equal(initial.domains.inventory.defs['pack.a/rope'], undefined, 'the input is not changed');
    assert.deepEqual(next.domains.scene, { place: { name: 'Bluewatch', kind: 'settlement', region: '' }, present: ['hollis'] });
    assert.deepEqual(Object.keys(next.domains.inventory.defs), ['pack.a/rope', 'pack.a/torch']);
    assert.deepEqual(next.domains.inventory.aliases, { cord: 'story/cord', rope: 'pack.a/rope', torch: 'pack.a/torch' }, 'a taken alias is kept');
    assert.deepEqual(Object.values(next.domains.inventory.stacks), [
        { id: 'it_00000001', def: 'pack.a/rope', qty: 3, owner: 'party', equipped: null, note: '', from: '' },
        { id: 'it_00000002', def: 'pack.a/torch', qty: 1, owner: 'party', equipped: null, note: '', from: '' },
        { id: 'it_00000003', def: 'pack.a/torch', qty: 1, owner: 'party', equipped: null, note: '', from: '' },
    ], 'an item that does not stack gets one stack each');
    assert.deepEqual(next.domains.inventory.wallets, { party: { copper: 6 } });
    assert.deepEqual(applyStart(initial, mergeStart(packs), { id }).domains.inventory.wallets.party, { copper: 1, coin: 5 }, 'the default coin');
    assert.deepEqual(next.domains.party, { actors: {} });
    assert.throws(() => applyStart(initial, mergeStart(packs)), /id\(prefix\)/);
});

test('applyStart keeps a place already set and skips missing slices', () => {
    const packs = normalized(world('a', [{ name: 'Rope' }], 'Bluewatch'), game('g', { start: { items: [{ name: 'Rope' }] } }));
    const placed = { v: 2, meta: { rev: 0, claims: {} }, domains: { scene: { place: { name: 'Harbor', kind: '', region: '' }, present: [] } } };
    const next = applyStart(placed, mergeStart(packs), { id: () => 'it_x' });
    assert.deepEqual(next, placed);
    const empty = applyStart({ v: 2, meta: { rev: 0, claims: {} }, domains: { inventory: {} } }, mergeStart(normalized(pack())), { id: () => 'it_x' });
    assert.deepEqual(empty.domains.inventory, { defs: {}, stacks: {}, wallets: {}, aliases: {} }, 'no wallet for no coins');
});

test('currency suggestions by pack', () => {
    const packs = normalized(riversideGame(), game('gil', { currency: { name: 'Gil' } }));
    assert.deepEqual(contentOf(packs, 'currency'), [{ pack: 'riverside-starter-game', name: 'pennies', short: 'p' }, { pack: 'gil', name: 'Gil', short: '' }]);
    assert.deepEqual(contentOf(packs, 'currency', { pack: 'gil' }), [{ pack: 'gil', name: 'Gil', short: '' }]);
    assert.deepEqual(mergeStart(packs.slice(1)).currency, { name: 'Gil', short: '' }, 'a pack without a start can still name the currency');
});

test('content kinds are read from the packs given, so a format 4 world and the trackers of a game both answer', () => {
    const world = { id: 'w', kind: 'world', content: { items: [{ id: 'pack.w/rope', name: 'Rope' }], events: [] } };
    const trackers = { id: 'g', kind: 'game', content: { items: [], events: [], meterPresets: [{ id: 'pack.g/p' }] } };
    assert.deepEqual(contentOf([world, trackers], 'items').map(record => record.name), ['Rope']);
    assert.deepEqual(contentOf([world, trackers], 'meterPresets').map(record => record.id), ['pack.g/p']);
});
