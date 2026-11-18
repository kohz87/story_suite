// Pack format 4, the world validator (job P2): `climate` on regions and places, `start.date` and `start.place`, the start's keys, cast `birthday`,
// the calendar cut (dates and seasons are checked by the paired game pack, not here).
import test from 'node:test';
import assert from 'node:assert/strict';
import { check, sample } from './helpers/world-pack-sample.js';

const clone = value => JSON.parse(JSON.stringify(value));
const messages = list => (list ?? []).map(entry => `${entry.path}: ${entry.message}`);
const run = change => { const world = clone(sample); change(world); const result = check(world); return { ok: result.ok, errors: messages(result.errors), warnings: messages(result.warnings), pack: result.pack }; };
const refused = (change, pattern) => { const result = run(change); assert.equal(result.ok, false, 'should be refused'); assert.ok(result.errors.some(line => pattern.test(line)), `${pattern} not in ${JSON.stringify(result.errors)}`); return result; };
const accepted = change => { const result = run(change); assert.equal(result.ok, true, JSON.stringify(result.errors)); return result; };
const event = (world, id) => world.content.worldEvents.find(each => each.id === id);

test('climate: a region and a place keep one of the ten climates; anything else is refused', () => {
    const result = accepted(world => { world.content.regions[0].climate = 'cold'; world.content.places[1].climate = 'underground'; });
    assert.equal(result.pack.content.regions[0].climate, 'cold');
    assert.equal(result.pack.content.places[1].climate, 'underground');
    assert.equal(result.pack.content.regions[1].climate, undefined);
    for (const climate of ['temperate', 'cold', 'frozen', 'highland', 'arid', 'warm', 'tropical', 'coastal', 'sea', 'underground']) accepted(world => { world.content.regions[0].climate = climate; });
    for (const bad of ['Cold', 'icy', '', 4, null, ['cold'], {}]) {
        refused(world => { world.content.regions[0].climate = bad; }, /content\.regions\[0\]\.climate: .*climate must be one of temperate, cold/);
        refused(world => { world.content.places[0].climate = bad; }, /content\.places\[0\]\.climate: .*climate must be one of temperate, cold/);
    }
});

test('start.date: the era, year, month number, day, hour and minute are kept; a bad shape is refused with its field', () => {
    const date = { era: 'CY', year: 611, month: 10, day: 1, hour: 7, minute: 0 };
    assert.deepEqual(accepted(world => { world.content.start = { date: clone(date) }; }).pack.start, { date });
    assert.deepEqual(accepted(world => { world.content.start = { date: { year: 0, month: 1, day: 1 } }; }).pack.start, { date: { year: 0, month: 1, day: 1 } });
    const bad = [{ month: 'October' }, { month: 0 }, { month: 1.5 }, { month: 100 }, { day: 0 }, { year: -1 }, { year: '611' }, { hour: '7' }, { hour: -1 }, { minute: 1000 }, { era: '' }, { era: '<b>' }, { extra: 1 }];
    for (const change of bad) refused(world => { world.content.start = { date: { ...date, ...change } }; }, /content\.start\.date\.\w+: The start: /);
    for (const missing of ['year', 'month', 'day']) refused(world => { world.content.start = { date: { ...date, [missing]: undefined } }; }, new RegExp(`start\\.date\\.${missing}: .*${missing} is required`));
    for (const value of ['611-10-01', 5, null, []]) refused(world => { world.content.start = { date: value }; }, /content\.start\.date: The start: start\.date must be/);
});

test('start.date does not look at a calendar: a month the paired game pack lacks is the pairing check\'s to say', () => {
    assert.deepEqual(accepted(world => { world.content.start = { date: { year: 611, month: 14, day: 40 } }; }).pack.start, { date: { year: 611, month: 14, day: 40 } });
});

test('start.place: the id of a place of this pack is kept; another id, a name or a bad value is refused', () => {
    assert.deepEqual(accepted(world => { world.content.start = { place: 'ledgerford' }; }).pack.start, { place: 'ledgerford' });
    refused(world => { world.content.start = { place: 'nowhere' }; }, /content\.start\.place: The start: start\.place names "nowhere"/);
    refused(world => { world.content.start = { place: 'Ledgerford' }; }, /start\.place must be a place id/);
    for (const value of [5, null, '', ['ledgerford'], { id: 'ledgerford' }]) refused(world => { world.content.start = { place: value }; }, /start\.place must be a place id/);
    refused(world => { delete world.content.places; world.content.regions = []; world.content.routes = []; world.content.worldEvents = []; world.content.templates = []; world.content.cast = []; world.content.powers = []; world.content.scores = []; world.content.lore = []; world.content.start = { place: 'ledgerford' }; }, /not the id of a place in this pack/);
});

test('start keeps world, date and place together; its other keys are refused, with a pointer for the old ones', () => {
    const result = accepted(world => { world.content.start = { world: { facts: ['border-closed'] }, date: { year: 5, month: 2, day: 3 }, place: 'ledgerford' }; });
    assert.deepEqual(Object.keys(result.pack.start).sort(), ['date', 'place', 'world']);
    assert.match(refused(world => { world.content.start = { scene: { place: { name: 'Ledgerford' } } }; }, /content\.start\.scene: .*"scene" is not a world start field/).errors.join(' '), /use start\.place/);
    assert.match(refused(world => { world.content.start = { inventory: { money: 5 } }; }, /content\.start\.inventory/).errors.join(' '), /belong in a game pack/);
    refused(world => { world.content.start = { money: 5 }; }, /"money" is not a world start field/);
    for (const value of ['x', 5, null, []]) refused(world => { world.content.start = value; }, /content\.start: The start: content\.start must be an object/);
});

test('cast birthday: "<month number or name> <day>" is kept; a bad one refuses that person alone', () => {
    const run4 = birthday => run(world => { world.content.cast[1].birthday = birthday; });
    assert.equal(run4('10 27').pack.content.cast[1].birthday, '10 27');
    assert.equal(run4('Icewane 27').pack.content.cast[1].birthday, 'Icewane 27');
    assert.equal(run4('  Frost   Moon  3 ').pack.content.cast[1].birthday, 'Frost Moon 3');
    for (const bad of ['27', 'Icewane', '0 5', 'Icewane 0', '10 0', '<b> 3', '10/27', 'Icewane 27, 1204', '', 5, null, ['10 27'], {}, 'x'.repeat(60) + ' 3']) {
        const result = run4(bad);
        assert.equal(result.ok, true, 'the pack still installs');
        assert.ok(!result.pack.content.cast.some(person => person.id === 'sir-lothar'), `${JSON.stringify(bad)} should refuse sir-lothar`);
        assert.ok(result.pack.content.cast.some(person => person.id === 'adalmar'), 'the rest of the cast still loads');
        assert.ok(result.warnings.some(line => /content\.cast\[1\]\.birthday: Cast "Sir Lothar" was refused, the rest of the cast still loads: birthday must be a month/.test(line)));
    }
});

test('format 4 cast: a retired format 3 field says where it went', () => {
    for (const [field, value, hint] of [['about', 'x', 'role, personality and history'], ['skills', [], 'abilities'], ['gear', [], 'keepsakes'], ['fields', {}, 'Level is a built-in field']]) {
        const result = run(world => { world.content.cast[1][field] = value; });
        assert.ok(result.warnings.some(line => new RegExp(`"${field}" is not a cast field \\((use )?${hint}`).test(line)), field);
    }
});

test('date and season anchors are not read against a calendar: a world pack has none (the pairing check reads them)', () => {
    const anchors = ['date:612-13-40', 'date:612-Frost-12', 'date:612-2-31', 'monsoon'];
    const result = accepted(world => { event(world, 'war-of-faiths').requires.push(...anchors); });
    assert.deepEqual(result.warnings, run(() => {}).warnings, 'no warning is added by the anchors');
    // The shape is still checked.
    for (const bad of ['date:612-July', 'date:612-0-5', 'date:612-3-0', 'date:612-<x>-3']) refused(world => { event(world, 'war-of-faiths').requires.push(bad); }, /war-of-faiths|requires/);
});

test('legacy kinds are refused in a world pack: events, the format 3 ignored kinds and cast shapes', () => {
    refused(world => { world.content.events = []; }, /content\.events/);
    for (const kind of ['skills', 'creatures', 'shops', 'recipes', 'quests', 'races', 'talents', 'presets', 'terms', 'ranks', 'crafts', 'ripples']) refused(world => { world.content[kind] = []; }, new RegExp(`content\\.${kind}`));
});
