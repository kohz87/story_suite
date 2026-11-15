// pack.json validation (SPEC §9): what passes, and every reason a pack is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack, slugify } from '../../../src/v2/packs/validate.js';
import { LIMITS } from '../../../src/v2/packs/limits.js';
import { pack, sample, sampleText } from './helpers/fixtures.js';
import { refused, withItem } from './validate.helpers.js';

test('the sample pack validates, as text and as an object', () => {
    for (const input of [sampleText, sample()]) {
        const result = validatePack(input);
        assert.equal(result.ok, true, JSON.stringify(result.errors));
        assert.equal(result.pack.id, 'riverside-starter');
        assert.deepEqual(Object.keys(result.pack.content), ['items', 'creatures', 'shops', 'recipes', 'events', 'quests', 'races', 'talents']);
        assert.deepEqual(result.pack.content.races.map(race => race.id), ['pack.riverside-starter/riverfolk']);
        assert.deepEqual(result.pack.content.talents.map(talent => talent.id), ['pack.riverside-starter/patient-angler']);
        assert.deepEqual(result.pack.currency, { name: 'pennies', short: 'p' });
        assert.deepEqual(result.pack.content.items.map(item => item.id), [
            'pack.riverside-starter/moonveil-trout', 'pack.riverside-starter/willow-rod',
            'pack.riverside-starter/hemp-line', 'pack.riverside-starter/minor-healing-draught',
        ]);
        assert.equal(result.pack.content.creatures.length, 1);
        assert.equal(result.pack.content.events.length, 2);
        assert.ok(result.pack.start);
    }
});

test('normalizing fills defaults, writes references as full IDs and links events', () => {
    const { pack: out } = validatePack(sample());
    const rope = out.content.items.find(item => item.slug === 'hemp-line');
    assert.deepEqual({ kind: rope.kind, rarity: rope.rarity, stack: rope.stack, slot: rope.slot, stats: rope.stats, effect: rope.effect, note: rope.note }, { kind: 'material', rarity: 'common', stack: true, slot: null, stats: {}, effect: {}, note: '' });
    assert.deepEqual(out.content.shops[0].stock.map(line => line.item), ['pack.riverside-starter/moonveil-trout', 'pack.riverside-starter/hemp-line', 'pack.riverside-starter/willow-rod'], 'by slug and by name');
    assert.equal(out.content.recipes[0].makes, 'pack.riverside-starter/willow-rod');
    assert.deepEqual(out.content.recipes[0].materials, [{ item: 'pack.riverside-starter/hemp-line', qty: 2 }]);
    const [first, second] = out.content.events;
    assert.deepEqual([first.id, first.once, first.after, first.then], ['pack.riverside-starter/market-day', true, null, []]);
    assert.equal(second.after, 'pack.riverside-starter/market-day');
    assert.deepEqual(out.start.inventory.items, [
        { item: 'pack.riverside-starter/willow-rod', qty: 1, note: '' },
        { item: 'pack.riverside-starter/hemp-line', qty: 3, note: '' },
        { item: 'pack.riverside-starter/minor-healing-draught', qty: 1, note: '' },
    ]);
    assert.deepEqual(out.theme, { '--ss-accent': '#3f7f8f' });
    assert.equal(out.start.inventory.money, 50);
    assert.equal(out.content.items.find(item => item.slug === 'willow-rod').stack, false, 'equipment defaults to one stack per piece');
});

test('the raw copy is detached from the input', () => {
    const input = sample();
    const result = validatePack(input);
    input.content.items[0].name = 'Changed';
    assert.equal(result.raw.content.items[0].name, 'Moonveil Trout');
    assert.equal(result.pack.content.items[0].name, 'Moonveil Trout');
});

test('a minimal pack and references outside the pack are fine', () => {
    assert.equal(validatePack(pack()).ok, true);
    assert.equal(validatePack({ id: 'x', version: '0.1.0-beta.2', requires: { storyBlock: '>=2.0.0 <3' } }).ok, true, 'content is optional');
    const shop = pack({ content: { shops: [{ name: 'Stall', stock: ['story/rope', 'pack.other/iron-sword'] }] } });
    assert.equal(validatePack(shop).ok, true);
});

test('slugs come from names', () => {
    assert.equal(slugify('Iron Sword (old)'), 'iron-sword-old');
    assert.equal(slugify('  Crème Brûlée!! '), 'creme-brulee');
    assert.equal(slugify('???'), '');
});

test('size and JSON', () => {
    refused('{ "id": ', 'NOT_JSON');
    refused('   ', 'NOT_JSON');
    refused('x'.repeat(LIMITS.packBytes + 1), 'TOO_LARGE');
    const big = pack({ content: { quests: Array.from({ length: 200 }, (_, i) => ({ name: `Q${i}`, text: 'y'.repeat(3000) })) } });
    refused(big, 'TOO_LARGE');
    refused('[1, 2]', 'NOT_OBJECT');
    refused(null, 'NOT_OBJECT');
    assert.equal(validatePack('﻿' + JSON.stringify(pack())).ok, true, 'a byte-order mark is fine');
});

test('data only: no functions, class instances, getters, undefined, non-finite numbers or loops', () => {
    refused(pack({ content: { items: [{ name: 'Rope', note: () => 'x' }] } }), 'NOT_PLAIN');
    refused(pack({ name: new Date(0) }), 'NOT_PLAIN');
    refused(pack({ name: undefined }), 'NOT_PLAIN');
    refused(pack({ content: { creatures: [{ name: 'Rat', hp: Number.NaN }] } }), 'NOT_PLAIN');
    refused(pack({ content: { creatures: [{ name: 'Rat', hp: Infinity }] } }), 'NOT_PLAIN');
    refused(pack({ content: { creatures: [{ name: 'Rat', hp: 10n }] } }), 'NOT_PLAIN');
    const getter = pack();
    Object.defineProperty(getter, 'name', { get: () => 'Sneaky', enumerable: true });
    refused(getter, 'NOT_PLAIN');
    const loop = pack({ content: { creatures: [{ name: 'Rat' }] } });
    loop.content.creatures[0].self = loop.content.creatures[0];
    refused(loop, 'NOT_PLAIN');
    refused(pack({ [Symbol('x')]: 1 }), 'NOT_PLAIN');
    // The same object twice is not a loop.
    const shared = { kind: 'beast' };
    assert.equal(validatePack(pack({ content: { creatures: [{ name: 'A', info: shared }, { name: 'B', info: shared }] } })).ok, true);
});

test('reserved keys that would reach prototypes are refused', () => {
    refused('{"id":"mini","version":"1.0.0","requires":{"storyBlock":"^2"},"__proto__":{"admin":true}}', 'UNSAFE_KEY');
    refused(pack({ content: { creatures: [{ name: 'Rat', constructor: 'x' }] } }), 'UNSAFE_KEY');
});

test('no script HTML, event attributes or script links anywhere', () => {
    refused(withItem({ name: 'Rope', note: '<script>alert(1)</script>' }), 'UNSAFE_HTML');
    refused(withItem({ name: 'Rope', note: '< SCRIPT src=x>' }), 'UNSAFE_HTML');
    refused(withItem({ name: 'Rope', note: 'see <iframe src="https://x">' }), 'UNSAFE_HTML');
    refused(withItem({ name: 'Rope', note: '<form action="https://x"><input></form>' }), 'UNSAFE_HTML');
    refused(withItem({ name: 'Rope', note: '<style>body{}</style>' }), 'UNSAFE_HTML');
    refused(withItem({ name: 'Rope', note: '<img src=x onerror=alert(1)>' }), 'UNSAFE_HTML');
    refused(withItem({ name: 'Rope', note: '<a href="#" ONCLICK = "x">hi</a>' }), 'UNSAFE_HTML');
    refused(withItem({ name: 'Rope', note: 'javascript:alert(1)' }), 'UNSAFE_HTML');
    refused(withItem({ name: 'Rope', note: 'java\tscript:alert(1)' }), 'UNSAFE_HTML');
    refused(withItem({ name: 'Rope', note: 'java&#x09;script&colon;alert(1)' }), 'UNSAFE_HTML');
    refused(withItem({ name: 'Rope', note: '&#106;avascript:alert(1)' }), 'UNSAFE_HTML');
    refused(withItem({ name: 'Rope', note: 'data:text/html;base64,PHNjcmlwdD4=' }), 'UNSAFE_HTML');
    refused(pack({ content: { creatures: [{ name: 'Rat', '<script>': 1 }] } }), 'UNSAFE_HTML', 'in a key too');
    refused(pack({ name: '<svg onload=alert(1)>' }), 'UNSAFE_HTML');
    assert.equal(validatePack(withItem({ name: 'Rope', note: '<svg viewBox="0 0 1 1"><circle r="1"/></svg> <form><input></form>' })).ok, true, 'inline SVG and plain forms are allowed (SPEC §13.2)');
    // Plain text with angle brackets is fine: conditions compare with < and >.
    const events = pack({ content: { events: [{ id: 'dusk', when: "query('party.pc').level < 30 && query('net.online') == 1 && query('a').x<query('b').x", cue: 'Dusk <falls> & the bells ring.' }] } });
    assert.equal(validatePack(events).ok, true, JSON.stringify(validatePack(events).errors));
    assert.equal(validatePack(withItem({ name: 'Rope', note: 'tied <b>tight</b>' })).ok, true, 'harmless markup is text');
});

test('links and images must be web links or plain image data', () => {
    const layout = src => pack({ layouts: [{ id: 'board', title: 'Board', root: { type: 'image', src } }] });
    assert.equal(validatePack(layout('https://example.org/map.png')).ok, true);
    assert.equal(validatePack(layout('data:image/png;base64,iVBORw0KGgo=')).ok, true);
    refused(layout('file:///etc/passwd'), 'UNSAFE_URL');
    refused(layout('http://example.org/map.png'), 'UNSAFE_URL', 'https only');
    refused(layout('/scripts/extensions/x.png'), 'UNSAFE_URL');
    refused(layout('data:image/svg+xml;base64,PHN2Zz4='), 'UNSAFE_HTML');
    refused(pack({ layouts: [{ id: 'b', root: { type: 'button', href: 'vbscript:x' } }] }), 'UNSAFE_HTML');
});

test('limits: depth, string length, list and object sizes', () => {
    let deep = { name: 'Rat' };
    for (let i = 0; i < LIMITS.depth; i += 1) deep = { inner: deep };
    refused(pack({ content: { creatures: [{ name: 'Rat', deep }] } }), 'TOO_DEEP');
    refused(withItem({ name: 'Rope', note: 'x'.repeat(LIMITS.string + 1) }), 'TOO_LONG');
    refused(pack({ content: { quests: Array.from({ length: LIMITS.array + 1 }, (_, i) => ({ name: `Q${i}` })) } }), 'TOO_MANY');
    refused(pack({ content: { creatures: [{ name: 'Rat', ...Object.fromEntries(Array.from({ length: LIMITS.keys + 1 }, (_, i) => [`k${i}`, i])) }] } }), 'TOO_MANY');
    refused(pack({ content: { creatures: [{ name: 'Rat', ['k'.repeat(LIMITS.name + 1)]: 1 }] } }), 'TOO_LONG');
});

test('pack fields: id, version, names, unknown fields', () => {
    refused(pack({ id: 'Fantasy Pack' }), 'BAD_ID');
    refused(pack({ id: '' }), 'BAD_ID');
    refused(pack({ id: 'two--dashes' }), 'BAD_ID');
    refused(pack({ id: 'trailing-' }), 'BAD_ID');
    refused(pack({ id: 7 }), 'BAD_ID');
    refused(pack({ version: '1.0' }), 'BAD_VERSION');
    refused(pack({ version: undefined }), 'NOT_PLAIN');
    const { version: _version, ...noVersion } = pack();
    refused(noVersion, 'BAD_VERSION');
    refused(pack({ name: 'n'.repeat(81) }), 'BAD_FIELD');
    refused(pack({ author: 3 }), 'BAD_FIELD');
    refused(pack({ description: ['x'] }), 'BAD_FIELD');
    refused(pack({ scripts: ['x'] }), 'UNKNOWN_FIELD');
});

test('requires: the Story Block range and capabilities', () => {
    const { requires: _requires, ...noRequires } = pack();
    refused(noRequires, 'BAD_REQUIRES');
    refused(pack({ requires: { storyBlock: 'two' } }), 'BAD_REQUIRES');
    refused(pack({ requires: {} }), 'BAD_REQUIRES');
    refused(pack({ requires: { storyBlock: '^2', modules: [] } }), 'UNKNOWN_FIELD');
    refused(pack({ requires: { storyBlock: '^3' } }), 'HOST_VERSION');
    refused(pack({ requires: { storyBlock: '^1' } }), 'HOST_VERSION');
    assert.equal(validatePack(pack({ requires: { storyBlock: '^3' } }), { hostVersion: '3.1.0' }).ok, true);
    assert.equal(validatePack(pack(), { hostVersion: '2.0.0-alpha.4' }).ok, true, 'the alpha counts as 2.0.0');
    refused(pack({ requires: { storyBlock: '^2', capabilities: 'party' } }), 'BAD_REQUIRES');
    refused(pack({ requires: { storyBlock: '^2', capabilities: ['Party Sheet'] } }), 'BAD_REQUIRES');
    const needsParty = pack({ requires: { storyBlock: '^2', capabilities: ['inventory', 'party'] } });
    assert.equal(validatePack(needsParty).ok, true, 'not checked when the capabilities are unknown');
    assert.equal(validatePack(needsParty, { capabilities: ['inventory', 'party', 'scene'] }).ok, true);
    const missing = refused(needsParty, 'MISSING_CAPABILITY', { capabilities: ['inventory', 'scene'] });
    assert.match(missing.errors[0].message, /needs party/);
});

test('content kinds and records', () => {
    refused(pack({ content: [] }), 'BAD_CONTENT');
    refused(pack({ content: { spells: [] } }), 'UNKNOWN_KIND');
    refused(pack({ content: { items: { name: 'Rope' } } }), 'BAD_CONTENT');
    refused(pack({ content: { items: ['Rope'] } }), 'BAD_RECORD');
    refused(pack({ content: { creatures: [{ hp: 3 }] } }), 'BAD_RECORD', 'a name is needed');
    refused(pack({ content: { creatures: [{ name: '!!!' }] } }), 'BAD_RECORD', 'a name with no letters needs a slug');
    refused(pack({ content: { creatures: [{ name: 'Rat', slug: 'Big Rat' }] } }), 'BAD_RECORD');
    refused(pack({ content: { creatures: [{ name: 'Rat' }, { name: 'rat' }] } }), 'DUPLICATE');
    refused(pack({ content: { items: [{ name: 'Rope' }, { name: 'Other', slug: 'rope' }] } }), 'DUPLICATE');
});
