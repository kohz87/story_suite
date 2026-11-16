import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack } from '../../packs/validate.js';
import { LIMITS, CONTENT_KINDS, OPTIONAL_KINDS } from '../../packs/limits.js';
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

test('shops and recipes refer to items that exist', () => {
    refused(pack({ content: { shops: [{ name: 'Stall', stock: ['rope'] }] } }), 'UNKNOWN_REF');
    refused(pack({ content: { shops: [{ name: 'Stall', stock: ['story/Rope Coil'] }] } }), 'UNKNOWN_REF');
    refused(pack({ content: { shops: [{ name: 'Stall', stock: 'rope' }] } }), 'BAD_RECORD');
    refused(pack({ content: { items: [{ name: 'Rope' }], shops: [{ name: 'Stall', stock: [{ item: 'rope', qty: 0 }] }] } }), 'BAD_RECORD');
    refused(pack({ content: { items: [{ name: 'Rope' }], shops: [{ name: 'Stall', stock: [{ item: 'rope', price: -2 }] }] } }), 'BAD_RECORD');
    refused(pack({ content: { items: [{ name: 'Rope' }], shops: [{ name: 'Stall', stock: [7] }] } }), 'BAD_RECORD');
    refused(pack({ content: { items: [{ name: 'Rope' }], recipes: [{ name: 'Net', makes: 'net', materials: [{ item: 'rope', qty: 2 }] }] } }), 'UNKNOWN_REF');
    refused(pack({ content: { items: [{ name: 'Rope' }], recipes: [{ name: 'Net', makes: 'rope', materials: [{ item: 'tar', qty: 1 }] }] } }), 'UNKNOWN_REF');
    refused(pack({ content: { items: [{ name: 'Rope' }], recipes: [{ name: 'Net', makes: 'rope', materials: [] }] } }), 'BAD_RECORD');
    refused(pack({ content: { items: [{ name: 'Rope' }], recipes: [{ name: 'Net', makes: 'rope', materials: [{ item: 'rope', qty: 0 }] }] } }), 'BAD_RECORD');
    refused(pack({ content: { items: [{ name: 'Rope' }], recipes: [{ name: 'Net', makes: 'rope', fee: -1, materials: [{ item: 'rope' }] }] } }), 'BAD_RECORD');
    refused(pack({ content: { items: [{ name: 'Rope' }], recipes: [{ name: 'Net', makes: 'rope', qty: 0, materials: [{ item: 'rope' }] }] } }), 'BAD_RECORD');
});

test('events: id, condition, cue, once, after and then', () => {
    const event = fields => pack({ content: { events: [{ id: 'dawn', when: 'true', cue: 'Dawn breaks.', ...fields }] } });
    assert.equal(validatePack(event({ then: [{ command: 'wallet.receive', payload: { owner: 'party', amount: 5 } }] })).ok, true);
    refused(event({ id: 'Dawn Bell' }), 'BAD_RECORD');
    refused(pack({ content: { events: [{ when: 'true', cue: 'x' }] } }), 'BAD_RECORD', 'events need an id');
    refused(event({ when: '' }), 'BAD_RECORD');
    refused(event({ when: 'x'.repeat(501) }), 'BAD_RECORD');
    refused(event({ cue: 3 }), 'BAD_RECORD');
    refused(event({ cue: 'c'.repeat(501) }), 'BAD_RECORD', 'the events part reads cues of at most 500 characters');
    refused(event({ once: 'yes' }), 'BAD_RECORD');
    refused(event({ then: { command: 'x.y' } }), 'BAD_RECORD');
    refused(event({ then: [{ command: 'grant' }] }), 'BAD_RECORD');
    refused(event({ then: [{ command: 'wallet.receive', payload: [] }] }), 'BAD_RECORD');
    refused(event({ then: [{ command: 'wallet.receive', run: 'x' }] }), 'BAD_RECORD');
    refused(event({ then: Array.from({ length: 9 }, () => ({ command: 'a.b' })) }), 'BAD_RECORD', 'at most 8 commands');
    refused(event({ repeat: 2 }), 'UNKNOWN_FIELD');
    refused(event({ after: 'nowhere' }), 'UNKNOWN_REF');
    refused(event({ after: 'dawn' }), 'UNKNOWN_REF', 'not after itself');
    const loop = pack({ content: { events: [{ id: 'a', after: 'b', when: 'true', cue: 'A' }, { id: 'b', after: 'a', when: 'true', cue: 'B' }] } });
    refused(loop, 'BAD_RECORD');
    refused(pack({ content: { events: [{ id: 'a', once: false, when: 'true', cue: 'A' }, { id: 'b', after: 'a', when: 'true', cue: 'B' }] } }), 'BAD_RECORD', 'after a repeating event');
    refused(pack({ content: { events: [{ id: 'a', when: 'true', cue: 'A' }, { id: 'a', when: 'true', cue: 'B' }] } }), 'DUPLICATE');
});

test('start: scene and inventory of this pack\'s items', () => {
    const start = value => pack({ content: { items: [{ name: 'Rope' }] }, start: value });
    assert.equal(validatePack(start({ inventory: { items: ['rope'], money: 20 } })).ok, true);
    refused(start([]), 'BAD_START');
    refused(start({ party: {} }), 'UNKNOWN_FIELD');
    refused(start({ scene: [] }), 'BAD_START');
    refused(start({ scene: { place: 'Bluewatch' } }), 'BAD_START');
    refused(start({ scene: { place: { kind: 'settlement' } } }), 'BAD_START');
    refused(start({ scene: { place: { name: 'Bluewatch', size: 'big' } } }), 'BAD_START');
    refused(start({ scene: { present: 'Hollis' } }), 'BAD_START');
    refused(start({ scene: { weather: 'rain' } }), 'UNKNOWN_FIELD');
    refused(start({ inventory: [] }), 'BAD_START');
    refused(start({ inventory: { gold: 1 } }), 'UNKNOWN_FIELD');
    refused(start({ inventory: { items: 'rope' } }), 'BAD_START');
    refused(start({ inventory: { items: ['net'] } }), 'UNKNOWN_REF');
    refused(start({ inventory: { items: ['story/rope'] } }), 'UNKNOWN_REF', 'a start item is a pack item');
    refused(start({ inventory: { items: [{ item: 'rope', qty: 0 }] } }), 'BAD_START');
    refused(start({ inventory: { items: [{ item: 'rope', owner: 'ac_x' }] } }), 'BAD_START');
    refused(start({ inventory: { items: [{ item: 'rope', note: 4 }] } }), 'BAD_START');
    refused(start({ inventory: { money: -1 } }), 'BAD_START');
    refused(start({ inventory: { money: 1.5 } }), 'BAD_START');
    refused(start({ inventory: { wallet: { silver: 5 } } }), 'UNKNOWN_FIELD', 'money is one number in the smallest coin');
});

test('layouts and theme', () => {
    refused(pack({ layouts: { id: 'x' } }), 'BAD_LAYOUTS');
    refused(pack({ layouts: ['x'] }), 'BAD_LAYOUTS');
    refused(pack({ theme: [] }), 'BAD_THEME');
    refused(pack({ theme: { 'Accent Color': 'red' } }), 'BAD_THEME');
    refused(pack({ theme: { accent: 'red' } }), 'BAD_THEME', 'CSS custom properties only');
    refused(pack({ theme: { '--bg': 'url(https://x/y.png)' } }), 'BAD_THEME');
    refused(pack({ theme: { '--bg': 'red; } body { display: none' } }), 'BAD_THEME');
    refused(pack({ theme: { '--bg': '\\75rl(x)' } }), 'BAD_THEME');
    refused(pack({ theme: { '--bg': {} } }), 'BAD_THEME');
    const ok = validatePack(pack({ theme: { '--ss-accent': ' #c90 ', '--ss-radius': 4 }, layouts: [{ id: 'board' }] }));
    assert.deepEqual(ok.pack.theme, { '--ss-accent': '#c90', '--ss-radius': 4 });
    assert.deepEqual(ok.pack.layouts, [{ id: 'board', pack: 'mini' }]);
});

test('problems stop at the reporting limit', () => {
    const many = pack({ content: { items: Array.from({ length: 40 }, (_, i) => ({ name: `Item ${i}`, kind: 'bad' })) } });
    assert.equal(validatePack(many).errors.length, LIMITS.errors);
});

test('screens: added or restyled by id, templates and CSS checked', () => {
    const screen = fields => pack({ screens: [{ id: 'rpg-battle/party', template: '<div class="sheet">{{ q.pc.name }}</div>', ...fields }] });
    const ok = validatePack(screen({ title: 'Party', icon: 'fa-users', mounts: ['tab', 'card'], css: '.sheet { color: var(--ss-accent); background: url("https://example.org/p.png") }', theme: { '--ss-accent': '#7c5cff' }, data: { pc: { query: 'party.pc' } }, steps: [{ id: 'one', title: 'One', template: '<p>Hi</p>' }] }));
    assert.equal(ok.ok, true, JSON.stringify(ok.errors));
    assert.equal(ok.pack.screens[0].pack, 'mini');
    assert.equal(validatePack(pack({ screens: [{ id: 'riverside-board', layout: { root: { type: 'box' } } }] })).ok, true);
    assert.equal(validatePack(screen({ template: 't'.repeat(LIMITS.string + 10) })).ok, true, 'a template may be longer than other text');
    refused(screen({ template: 't'.repeat(LIMITS.code + 1) }), 'TOO_LONG');
    refused(pack({ screens: {} }), 'BAD_SCREENS');
    refused(pack({ screens: ['x'] }), 'BAD_SCREENS');
    refused(screen({ id: 'Party Screen' }), 'BAD_SCREENS');
    refused(pack({ screens: [{ id: 'a', template: 'x' }, { id: 'a', template: 'y' }] }), 'DUPLICATE');
    refused(screen({ mounts: ['sidebar'] }), 'BAD_SCREENS');
    refused(screen({ title: 3 }), 'BAD_SCREENS');
    refused(pack({ screens: [{ id: 'a' }] }), 'BAD_SCREENS', 'a template or a layout');
    refused(screen({ template: 5 }), 'BAD_SCREENS');
    refused(pack({ screens: [{ id: 'a', layout: [] }] }), 'BAD_SCREENS');
    refused(screen({ data: 'party.pc' }), 'BAD_SCREENS');
    refused(screen({ steps: [{ template: 3 }] }), 'BAD_SCREENS');
    refused(screen({ script: 'x' }), 'UNKNOWN_FIELD');
    refused(screen({ theme: { color: 'red' } }), 'BAD_THEME');
    refused(screen({ template: '<div onclick="steal()">x</div>' }), 'UNSAFE_HTML');
    refused(screen({ template: '<a href="javascript:steal()">x</a>' }), 'UNSAFE_HTML');
    refused(screen({ css: 5 }), 'BAD_SCREENS');
    for (const css of ['@import "https://x/y.css";', '.a { background: url(http://x/y.png) }', '.a { background: url(/etc/x.png) }', '.a { width: expression(alert(1)) }', '.a { behavior: url(x.htc) }', '.a { -moz-binding: none }', '.a { content: "\\75rl" }', '</style><script>']) {
        const result = validatePack(screen({ css }));
        assert.equal(result.ok, false, css);
    }
});

test('currency: a suggested name for the chat\'s one currency', () => {
    assert.deepEqual(validatePack(pack({ currency: { name: 'Gil' } })).pack.currency, { name: 'Gil', short: '' });
    assert.equal(validatePack(pack()).pack.currency, null);
    refused(pack({ currency: 'gold' }), 'BAD_CURRENCY');
    refused(pack({ currency: { name: '' } }), 'BAD_CURRENCY');
    refused(pack({ currency: { name: 'g'.repeat(25) } }), 'BAD_CURRENCY');
    refused(pack({ currency: { name: 'gold', short: 'gold pieces' } }), 'BAD_CURRENCY');
    refused(pack({ currency: { name: 'gold', tiers: [] } }), 'BAD_CURRENCY', 'one currency, no tiers');
});

test('races and talents for character creation', () => {
    const choices = (races, talents = []) => pack({ content: { races, talents } });
    const ok = validatePack(choices([{ id: 'elf', name: 'Elf', note: 'Long-lived.', stats: { DEX: 2, VIT: -1 }, tags: ['fey'] }], [{ name: 'Keen Eye' }]));
    assert.equal(ok.ok, true, JSON.stringify(ok.errors));
    assert.deepEqual(ok.pack.content.races, [{ name: 'Elf', note: 'Long-lived.', stats: { DEX: 2, VIT: -1 }, tags: ['fey'], id: 'pack.mini/elf', slug: 'elf', pack: 'mini' }]);
    assert.deepEqual(ok.pack.content.talents, [{ name: 'Keen Eye', note: '', stats: {}, tags: [], id: 'pack.mini/keen-eye', slug: 'keen-eye', pack: 'mini' }], 'the id comes from the name when left out');
    refused(choices([{ id: 'elf' }]), 'BAD_RECORD', 'a name is needed');
    refused(choices([{ id: 'High Elf', name: 'High Elf' }]), 'BAD_RECORD');
    refused(choices([{ name: 'Elf', stats: { DEX: 1.5 } }]), 'BAD_RECORD');
    refused(choices([{ name: 'Elf', tags: 'fey' }]), 'BAD_RECORD');
    refused(choices([{ name: 'Elf', note: 4 }]), 'BAD_RECORD');
    refused(choices([{ name: 'Elf', hp: 10 }]), 'UNKNOWN_FIELD');
    refused(choices([], [{ name: 'Keen Eye' }, { id: 'keen-eye', name: 'Sharp Eye' }]), 'DUPLICATE');
});

test('events: a condition the runtime cannot parse is refused at check time, naming the event', () => {
    const event = when => pack({ content: { events: [{ id: 'gate', when, cue: 'The gate opens.' }] } });
    const result = validatePack(event("has('Smith's key')"));
    assert.equal(result.ok, false);
    const error = result.errors.find(each => each.path.endsWith('.when'));
    assert.ok(error, 'the error is on the when field');
    assert.match(error.message, /^Event "gate": the condition can't be read: .*never closed\. A name with an apostrophe in it needs double quotes around it\.$/);
    assert.equal(validatePack(event('hp >')).ok, false, 'a condition cut short');
    assert.equal(validatePack(event('has("Smith\'s key")')).ok, true, 'the same name in double quotes reads');
    assert.equal(validatePack(event("query('party.pc').level < 30 && true")).ok, true);
});

// A pack's ripples table (read by Story Director's ripples part): a good one normalizes; a bad one is a pack Problem (BAD_RIPPLES) and is not kept.
const ripples = extra => ({ powers: [{ id: 'red', name: 'Red Queen', base: 60 }, { id: 'blue', name: 'Blue King', base: 40 }], ...extra });
test('ripples: a good table is kept in order with its lists, tiers and directions; no section leaves no key', () => {
    const table = ripples({
        powers: [{ id: 'red', name: ' Red  Queen ', aliases: ['Queen'], factions: ['Red Court'], givers: ['Sir Rook'], npcs: [{ name: 'Sir Rook', weight: 2 }, { name: 'Page' }], base: 60 }, { id: 'blue', name: 'Blue King', base: 40 }],
        tiers: { small: 3 }, caps: { power: 15 }, worldDirections: [{ event: 'The Siege', favours: 'blue', unless: ['lost'] }], standingModule: 'pack.mini/standing',
    });
    const result = validatePack(pack({ ripples: table }));
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.pack.ripples.powers.map(power => [power.id, power.name, power.base]), [['red', 'Red Queen', 60], ['blue', 'Blue King', 40]]);
    assert.deepEqual(result.pack.ripples.powers[0].npcs, [{ name: 'Sir Rook', weight: 2 }, { name: 'Page', weight: 1 }]);
    assert.deepEqual([result.pack.ripples.tiers, result.pack.ripples.caps, result.pack.ripples.worldDirections], [{ small: 3 }, { power: 15 }, [{ event: 'The Siege', favours: 'blue', unless: ['lost'] }]]);
    assert.equal('ripples' in validatePack(pack()).pack, false, 'a pack without the section keeps its old bytes');
});

test('ripples: a bad section is ignored with a warning naming the path', () => {
    const bad = [
        ['not an object', [], 'ripples'], ['no powers', {}, 'ripples.powers'], ['empty powers', { powers: [] }, 'ripples.powers'],
        ['a bad id', ripples({ powers: [{ id: 'Red Queen', name: 'x', base: 1 }] }), 'ripples.powers[0].id'],
        ['a repeated id', ripples({ powers: [{ id: 'a', name: 'A', base: 1 }, { id: 'a', name: 'B', base: 2 }] }), 'ripples.powers[1].id'],
        ['no name', ripples({ powers: [{ id: 'a', base: 1 }] }), 'ripples.powers[0].name'],
        ['a base over 100', ripples({ powers: [{ id: 'a', name: 'A', base: 101 }] }), 'ripples.powers[0].base'],
        ['a fractional base', ripples({ powers: [{ id: 'a', name: 'A', base: 1.5 }] }), 'ripples.powers[0].base'],
        ['an npc weight of 4', ripples({ powers: [{ id: 'a', name: 'A', base: 1, npcs: [{ name: 'N', weight: 4 }] }] }), 'ripples.powers[0].npcs'],
        ['a names list that is text', ripples({ powers: [{ id: 'a', name: 'A', base: 1, givers: 'Rook' }] }), 'ripples.powers[0].givers'],
        ['a tier that is negative', ripples({ tiers: { small: -1 } }), 'ripples.tiers'], ['an unknown cap', ripples({ caps: { luck: 1 } }), 'ripples.caps'],
        ['a direction for nobody', ripples({ worldDirections: [{ event: 'E', favours: 'green' }] }), 'ripples.worldDirections[0].favours'],
    ];
    for (const [label, section, path] of bad) {
        const result = validatePack(pack({ ripples: section }));
        assert.equal(result.ok, true, label);
        assert.equal(result.pack.ripples, undefined);
        assert.ok(result.warnings.some(error => error.code === 'BAD_RIPPLES' && error.path === path), `${label}: ${JSON.stringify(result.warnings)}`);
    }
    assert.equal(validatePack(pack({ ripples: ripples({ extra: 1 }) })).warnings[0].code, 'UNKNOWN_FIELD');
    assert.equal(validatePack(pack({ ripples: ripples({ powers: [{ id: 'a', name: 'A', base: 1, favour: 2 }] }) })).warnings[0].code, 'UNKNOWN_FIELD');
});

// A pack's name lists (`content.names`, read by Story Director's names part through packs.content { kind: 'names' }): ONE object; a bad section is a Problem and is left out.
const names = extra => ({ banned: ['Elara'], river: { regions: ['River Confederacy'], given: ['Wenna', 'Joost'], family: ['Lockwright'] }, ...extra });
test('names: a good object is kept (trimmed, de-duplicated ignoring case, key order); no section leaves no key; names is a content kind', () => {
    assert.ok(CONTENT_KINDS.includes('names') && OPTIONAL_KINDS.includes('names'));
    const result = validatePack(pack({ content: { names: names({ hill: { regions: [' Northern  Holds '], given: ['Torgun', 'torgun', ' Sigrun '] } }) } }));
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.pack.content.names, { banned: ['Elara'], river: { regions: ['River Confederacy'], given: ['Wenna', 'Joost'], family: ['Lockwright'] }, hill: { regions: ['Northern Holds'], given: ['Torgun', 'Sigrun'] } });
    assert.deepEqual(Object.keys(result.pack.content.names), ['banned', 'river', 'hill']);
    assert.equal('names' in validatePack(pack()).pack.content, false, 'a pack without the section keeps its old bytes');
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
        const result = validatePack(pack({ content: { names: section } }));
        assert.equal(result.ok, true, label);
        assert.equal(result.pack.content.names, undefined);
        assert.ok(result.warnings.some(error => error.path === path), `${label}: ${JSON.stringify(result.warnings)}`);
    }
    const unknown = validatePack(pack({ content: { names: culture({ bynames: ['Long-Oar'] }) } }));
    assert.equal(unknown.warnings[0].path, 'content.names.river.bynames');
});

test('optional section warnings do not conceal fatal errors; power ids stop at 40 and names is reserved', () => {
    const power = id => ({ powers: [{ id, name: 'Rival', base: 1 }] });
    assert.equal(validatePack(pack({ ripples: power('a'.repeat(40)) })).pack.ripples.powers[0].id.length, 40);
    const tooLong = validatePack(pack({ ripples: power('a'.repeat(41)) }));
    assert.equal(tooLong.ok, true);
    assert.equal(tooLong.pack.ripples, undefined);
    assert.equal(tooLong.warnings[0].path, 'ripples.powers[0].id');
    const reserved = validatePack(pack({ content: { names: { names: { regions: ['River'], given: ['Wenna'] } } } }));
    assert.equal(reserved.ok, true);
    assert.equal(reserved.pack.content.names, undefined);
    assert.equal(reserved.warnings[0].path, 'content.names.names');
    const mixed = validatePack(pack({ ripples: [], content: { items: [{ name: 'Broken', kind: 'not-a-kind' }] } }));
    assert.equal(mixed.ok, false);
    assert.ok(mixed.errors.length && mixed.warnings.some(error => error.path === 'ripples'));
});
