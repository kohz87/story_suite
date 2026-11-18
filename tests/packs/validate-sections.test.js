import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack, checkScreens } from '../../packs/validate.js';
import { LIMITS, CONTENT_KEYS } from '../../packs/limits.js';
import { checkPlain } from '../../packs/safety.js';
import { pack } from './helpers/fixtures.js';
import { refused, withItem } from './validate.helpers.js';

test('item fields follow the inventory def', () => {
    refused(withItem({ name: 'Rope', kind: 'weapon' }), 'BAD_RECORD');
    refused(withItem({ name: 'Rope', rarity: 'mythic' }), 'BAD_RECORD');
    refused(withItem({ name: 'Rope', value: -1 }), 'BAD_RECORD');
    refused(withItem({ name: 'Rope', value: 2.5 }), 'BAD_RECORD');
    refused(withItem({ name: 'Rope', value: '3' }), 'BAD_RECORD');
    refused(withItem({ name: 'Rope', stack: 'yes' }), 'BAD_RECORD');
    refused(withItem({ name: 'Sword', kind: 'equipment', stack: true }), 'BAD_RECORD');
    refused(withItem({ name: 'Rope', slot: 3 }), 'BAD_RECORD');
    refused(withItem({ name: 'Rope', stats: { STR: 1.5 } }), 'BAD_RECORD');
    refused(withItem({ name: 'Rope', effect: [] }), 'BAD_RECORD');
    refused(withItem({ name: 'Rope', tags: 'fibre' }), 'BAD_RECORD');
    refused(withItem({ name: 'Rope', aliases: [''] }), 'BAD_RECORD');
    refused(withItem({ name: 'Rope', note: 'n'.repeat(501) }), 'BAD_RECORD');
    refused(withItem({ name: 'Rope', heft: 2 }), 'UNKNOWN_FIELD');
    assert.equal(validatePack(withItem({ name: 'Rope', weight: 2 })).ok, true, 'weight is a field now (0 to 99)');
    refused(withItem({ name: 'Rope', weight: 100 }), 'BAD_RECORD');
    refused(withItem({ name: 'Rope', id: 'rope' }), 'UNKNOWN_FIELD', 'the id is made, not given');
    const several = validatePack(withItem({ name: 'Rope', kind: 'x', value: -1 }));
    assert.equal(several.errors.length, 2, 'one record reports each problem');
});

test('the game start: items, money and notes are checked; a format 3 inventory wrapper is refused', () => {
    const start = value => game({ start: value });
    assert.equal(validatePack(start({ money: 3, items: [{ name: 'rope', qty: 2, note: 'coiled' }] })).ok, true);
    refused(start({ items: [{ name: 'rope', qty: 0 }] }), 'BAD_START');
    refused(start({ items: [{ name: 'rope', owner: 'ac_x' }] }), 'BAD_START');
    refused(start({ items: [{ name: 'rope', note: 4 }] }), 'BAD_START');
    refused(start({ money: -1 }), 'BAD_START');
    refused(start({ money: 1.5 }), 'BAD_START');
    refused(start({ wallet: { silver: 5 } }), 'UNKNOWN_FIELD', 'money is one number in the smallest coin');
    refused(start({ inventory: { money: 3 } }), 'UNKNOWN_FIELD');
});

test('problems stop at the reporting limit', () => {
    const many = pack({ content: { items: Array.from({ length: 40 }, (_, i) => ({ name: `Item ${i}`, kind: 'bad' })) } });
    assert.equal(validatePack(many).errors.length, LIMITS.errors);
});

test('screens (the checker data modules use): added or restyled by id, templates and CSS checked', () => {
    const screen = fields => [{ id: 'rpg-battle/party', template: '<div class="sheet">{{ q.pc.name }}</div>', ...fields }];
    const check = screens => { const errors = [...checkPlain(screens, LIMITS)]; const out = checkScreens(screens, 'mini', (code, path, message) => errors.push({ code, path, message })); return { ok: errors.length === 0, errors, pack: { screens: out } }; };
    const refusedScreens = (screens, code) => { const result = check(screens); assert.equal(result.ok, false, `expected ${code}`); assert.ok(result.errors.some(error => error.code === code), `expected ${code}, got ${JSON.stringify(result.errors)}`); };
    const ok = check(screen({ title: 'Party', icon: 'fa-users', mounts: ['tab', 'card'], css: '.sheet { color: var(--ss-accent); background: url("https://example.org/p.png") }', theme: { '--ss-accent': '#7c5cff' }, data: { pc: { query: 'party.pc' } }, steps: [{ id: 'one', title: 'One', template: '<p>Hi</p>' }] }));
    assert.equal(ok.ok, true, JSON.stringify(ok.errors));
    assert.equal(ok.pack.screens[0].pack, 'mini');
    assert.equal(check([{ id: 'riverside-board', layout: { root: { type: 'box' } } }]).ok, true);
    assert.equal(check(screen({ template: 't'.repeat(LIMITS.string + 10) })).ok, true, 'a template may be longer than other text');
    refusedScreens(screen({ template: 't'.repeat(LIMITS.code + 1) }), 'TOO_LONG');
    refusedScreens({}, 'BAD_SCREENS');
    refusedScreens(['x'], 'BAD_SCREENS');
    refusedScreens(screen({ id: 'Party Screen' }), 'BAD_SCREENS');
    refusedScreens([{ id: 'a', template: 'x' }, { id: 'a', template: 'y' }], 'DUPLICATE');
    refusedScreens(screen({ mounts: ['sidebar'] }), 'BAD_SCREENS');
    refusedScreens(screen({ title: 3 }), 'BAD_SCREENS');
    refusedScreens([{ id: 'a' }], 'BAD_SCREENS');
    refusedScreens(screen({ template: 5 }), 'BAD_SCREENS');
    refusedScreens([{ id: 'a', layout: [] }], 'BAD_SCREENS');
    refusedScreens(screen({ data: 'party.pc' }), 'BAD_SCREENS');
    refusedScreens(screen({ steps: [{ template: 3 }] }), 'BAD_SCREENS');
    refusedScreens(screen({ script: 'x' }), 'UNKNOWN_FIELD');
    refusedScreens(screen({ theme: { color: 'red' } }), 'BAD_THEME');
    refusedScreens(screen({ template: '<div onclick="steal()">x</div>' }), 'UNSAFE_HTML');
    refusedScreens(screen({ template: '<a href="javascript:steal()">x</a>' }), 'UNSAFE_HTML');
    refusedScreens(screen({ css: 5 }), 'BAD_SCREENS');
    for (const css of ['@import "https://x/y.css";', '.a { background: url(http://x/y.png) }', '.a { background: url(/etc/x.png) }', '.a { width: expression(alert(1)) }', '.a { behavior: url(x.htc) }', '.a { -moz-binding: none }', '.a { content: "\\75rl" }', '</style><script>']) {
        const result = check(screen({ css }));
        assert.equal(result.ok, false, css);
    }
});

test('currency: a suggested name for the chat\'s one currency, in a game pack', () => {
    assert.deepEqual(validatePack(game({ currency: { name: 'Gil' } })).pack.currency, { name: 'Gil', short: '' });
    assert.equal(validatePack(game()).pack.currency, null);
    refused(game({ currency: 'gold' }), 'BAD_CURRENCY');
    refused(game({ currency: { name: '' } }), 'BAD_CURRENCY');
    refused(game({ currency: { name: 'g'.repeat(25) } }), 'BAD_CURRENCY');
    refused(game({ currency: { name: 'gold', short: 'gold pieces' } }), 'BAD_CURRENCY');
    refused(game({ currency: { name: 'gold', tiers: [] } }), 'BAD_CURRENCY', 'one currency, no tiers');
});

// A pack's name lists (`content.names`, read by Story Director's names part through packs.content { kind: 'names' }): ONE object; a bad section is a Problem and is left out.
const withNames = section => game({ names: section });
const game = content => ({ id: 'g', format: 4, kind: 'game', version: '1.0.0', requires: { suite: '^0.1' }, content: content ?? {} });
const names = extra => ({ banned: ['Elara'], river: { regions: ['River Confederacy'], given: ['Wenna', 'Joost'], family: ['Lockwright'] }, ...extra });
test('names: a good object is kept (trimmed, de-duplicated ignoring case, key order); no section leaves no key; names is a content kind', () => {
    assert.ok(CONTENT_KEYS.game.includes('names') && !CONTENT_KEYS.world.includes('names'));
    const result = validatePack(withNames(names({ hill: { regions: [' Northern  Holds '], given: ['Torgun', 'torgun', ' Sigrun '] } })));
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.pack.content.names, { banned: ['Elara'], river: { regions: ['River Confederacy'], given: ['Wenna', 'Joost'], family: ['Lockwright'] }, hill: { regions: ['Northern Holds'], given: ['Torgun', 'Sigrun'] } });
    assert.deepEqual(Object.keys(result.pack.content.names), ['banned', 'river', 'hill']);
    assert.equal('names' in validatePack(game()).pack.content, false, 'a pack without the section keeps its old bytes');
});

test('names: a bad section is a pack Problem naming the path and is not kept', () => {
    const many = n => Array.from({ length: n }, (_, i) => `N${i}`);
    const culture = extra => names({ river: { regions: ['River'], given: ['Wenna'], ...extra } });
    const bad = [
        ['a list', [], 'content.names'], ['a culture that is a list', names({ river: ['Wenna'] }), 'content.names.river'], ['a culture that is text', names({ river: 'Wenna' }), 'content.names.river'],
        ['an id that is not a slug', names({ 'River Folk': { regions: ['R'], given: ['W'] } }), 'content.names.River Folk'],
        ['no regions', culture({ regions: [] }), 'content.names.river.regions'], ['no given names', culture({ given: [] }), 'content.names.river.given'],
        ['a region that is a number', culture({ regions: [4] }), 'content.names.river.regions'], ['a blank given name', culture({ given: ['Wenna', '  '] }), 'content.names.river.given'],
        ['61 given names', culture({ given: many(61) }), 'content.names.river.given'], ['9 regions', culture({ regions: many(9) }), 'content.names.river.regions'],
        ['a 41-character name', culture({ given: ['x'.repeat(41)] }), 'content.names.river.given'], ['family that is text', culture({ family: 'Lock' }), 'content.names.river.family'],
        ['banned that is text', names({ banned: 'Elara' }), 'content.names.banned'], ['201 banned', names({ banned: many(201) }), 'content.names.banned'],
        ['21 cultures', Object.fromEntries(many(21).map(id => [id.toLowerCase(), { regions: ['R'], given: ['W'] }])), 'content.names'],
    ];
    for (const [label, section, path] of bad) {
        const result = validatePack(withNames(section));
        assert.equal(result.ok, true, label);
        assert.equal(result.pack.content.names, undefined);
        assert.ok(result.warnings.some(error => error.path === path), `${label}: ${JSON.stringify(result.warnings)}`);
    }
    const unknown = validatePack(withNames(culture({ bynames: ['Long-Oar'] })));
    assert.equal(unknown.warnings[0].path, 'content.names.river.bynames');
});

test('optional section warnings do not conceal fatal errors; names is reserved as a culture id', () => {
    const reserved = validatePack(withNames({ names: { regions: ['River'], given: ['Wenna'] } }));
    assert.equal(reserved.ok, true);
    assert.equal(reserved.pack.content.names, undefined);
    assert.equal(reserved.warnings[0].path, 'content.names.names');
    const person = { kind: 'figure', id: 'Bad Id', name: 'Fenna' };
    const mixed = validatePack(pack({ content: { cast: [person], items: [{ name: 'Broken', kind: 'not-a-kind' }] } }));
    assert.equal(mixed.ok, false);
    assert.ok(mixed.errors.length && mixed.warnings.some(error => error.path === 'content.cast[0].id'));
});
