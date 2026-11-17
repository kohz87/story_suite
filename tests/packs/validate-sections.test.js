import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack, checkScreens } from '../../packs/validate.js';
import { LIMITS, CONTENT_KINDS, OPTIONAL_KINDS } from '../../packs/limits.js';
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

test('the start state refers to items that exist', () => {
    const start = value => pack({ content: { items: [{ name: 'Rope' }] }, start: value });
    refused(start({ inventory: { items: [{ item: 'rope', qty: 0 }] } }), 'BAD_START');
    refused(start({ inventory: { items: [{ item: 'rope', owner: 'ac_x' }] } }), 'BAD_START');
    refused(start({ inventory: { items: [{ item: 'rope', note: 4 }] } }), 'BAD_START');
    refused(start({ inventory: { money: -1 } }), 'BAD_START');
    refused(start({ inventory: { money: 1.5 } }), 'BAD_START');
    refused(start({ inventory: { wallet: { silver: 5 } } }), 'UNKNOWN_FIELD', 'money is one number in the smallest coin');
});

test('theme; a pack\'s layouts and screens are accepted with a warning and left out', () => {
    refused(pack({ theme: [] }), 'BAD_THEME');
    refused(pack({ theme: { 'Accent Color': 'red' } }), 'BAD_THEME');
    refused(pack({ theme: { accent: 'red' } }), 'BAD_THEME', 'CSS custom properties only');
    refused(pack({ theme: { '--bg': 'url(https://x/y.png)' } }), 'BAD_THEME');
    refused(pack({ theme: { '--bg': 'red; } body { display: none' } }), 'BAD_THEME');
    refused(pack({ theme: { '--bg': '\\75rl(x)' } }), 'BAD_THEME');
    refused(pack({ theme: { '--bg': {} } }), 'BAD_THEME');
    const ok = validatePack(pack({ theme: { '--ss-accent': ' #c90 ', '--ss-radius': 4 }, layouts: [{ id: 'board' }], screens: [{ id: 'x', template: '<div>x</div>' }] }));
    assert.deepEqual(ok.pack.theme, { '--ss-accent': '#c90', '--ss-radius': 4 });
    assert.deepEqual([ok.pack.layouts, ok.pack.screens], [[], []]);
    assert.deepEqual(ok.warnings.map(warning => [warning.code, warning.path]), [['IGNORED_FIELD', 'layouts'], ['IGNORED_FIELD', 'screens']]);
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

test('currency: a suggested name for the chat\'s one currency', () => {
    assert.deepEqual(validatePack(pack({ currency: { name: 'Gil' } })).pack.currency, { name: 'Gil', short: '' });
    assert.equal(validatePack(pack()).pack.currency, null);
    refused(pack({ currency: 'gold' }), 'BAD_CURRENCY');
    refused(pack({ currency: { name: '' } }), 'BAD_CURRENCY');
    refused(pack({ currency: { name: 'g'.repeat(25) } }), 'BAD_CURRENCY');
    refused(pack({ currency: { name: 'gold', short: 'gold pieces' } }), 'BAD_CURRENCY');
    refused(pack({ currency: { name: 'gold', tiers: [] } }), 'BAD_CURRENCY', 'one currency, no tiers');
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
