// Pack format 4, the pairing check (job P4): dates, season anchors, birthdays and culture regions against the paired game's calendar and names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPairing, validatePack } from '../../packs/validate.js';

const world = (over = {}) => ({
    id: 'w', name: 'Wold', kind: 'world', recommends: { game: { id: 'g', version: '^1' } },
    start: { date: { year: 600, month: 3, day: 10 } },
    content: { regions: [{ id: 'the-march', name: 'The March', aliases: ['north march'] }], places: [{ name: 'Hall', region: 'the-march' }],
        worldEvents: [], templates: [], cast: [], ...over.content }, ...Object.fromEntries(Object.entries(over).filter(([key]) => key !== 'content')),
});
const months = [{ name: 'Frost', days: 30 }, { name: 'Bloom', days: 20 }];
const game = (over = {}) => ({ id: 'g', name: 'Gamey', kind: 'game', calendar: { months, seasons: [{ name: 'cold', months: ['Frost'] }, { name: 'warm', months: ['Bloom'] }] }, content: {}, ...over });
const ev = (id, extra) => ({ id, ...extra });
const codes = list => list.map(entry => `${entry.code}:${entry.part.id}`);

test('start.date: month and day must exist on the game calendar; the built-in game has 12 months', () => {
    assert.deepEqual(checkPairing(world(), game()).errors.map(e => e.code), ['PAIR_START_DATE']);
    assert.deepEqual(checkPairing(world({ start: { date: { year: 1, month: 2, day: 20 } } }), game()).errors, []);
    assert.deepEqual(checkPairing(world({ start: { date: { year: 1, month: 2, day: 21 } } }), game()).errors.length, 1);
    assert.deepEqual(checkPairing(world(), null).errors, []);
    assert.equal(checkPairing(world({ start: { date: { year: 1, month: 13, day: 1 } } }), null).errors.length, 1);
});

test('date anchors: month by number or name, day within the month; one error per failing event, template too', () => {
    const w = world({ content: { worldEvents: [ev('ok', { on: 'date:600-Frost-30' }), ev('badmonth', { on: 'date:600-3-1' }), ev('badday', { window: { after: 'date:600-2-21 + 3 days', within: '9 days' } }), ev('named', { requires: ['date:1-nope-1'] })],
        templates: [{ template: 't', requires_any: ['date:1-9-1'] }] }, start: undefined });
    assert.deepEqual(codes(checkPairing(w, game()).errors), ['PAIR_EVENT_DATE:badmonth', 'PAIR_EVENT_DATE:badday', 'PAIR_EVENT_DATE:named', 'PAIR_EVENT_DATE:t']);
    assert.deepEqual(checkPairing(w, game()).errors[0].part, { kind: 'event', id: 'badmonth' });
    assert.equal(checkPairing(w, game()).errors[3].part.kind, 'template');
});

test('season anchors: the game seasons, or the quarter names when the game has none', () => {
    const w = world({ start: undefined, content: { worldEvents: [ev('a', { window: { after: 'spring', within: '9 days' } }), ev('b', { requires: ['cold'] }), ev('c', { likelier_if: { winter: 2 } })] } });
    assert.deepEqual(codes(checkPairing(w, game()).errors), ['PAIR_EVENT_SEASON:a', 'PAIR_EVENT_SEASON:c']);
    assert.deepEqual(codes(checkPairing(w, game({ calendar: { months } })).errors), ['PAIR_EVENT_SEASON:b']);
    assert.deepEqual(codes(checkPairing(w, null).errors), ['PAIR_EVENT_SEASON:b']);
});

test('birthdays drop with a warning; names cultures with no region of the world are unused', () => {
    const w = world({ start: undefined, content: { cast: [{ id: 'a', name: 'A', birthday: 'Frost 30' }, { id: 'b', name: 'B', birthday: '2 21' }, { id: 'c', name: 'C', birthday: 'Mud 1' }, { id: 'd', name: 'D' }] } });
    const g = game({ content: { names: { banned: ['x'], north: { regions: ['North March'], given: ['a'] }, south: { regions: ['Nowhere'], given: ['b'] }, mixed: { regions: ['the-march', 'zz'], given: ['c'] } } } });
    const { errors, warnings } = checkPairing(w, g);
    assert.deepEqual(errors, []);
    assert.deepEqual(codes(warnings), ['PAIR_BIRTHDAY:b', 'PAIR_BIRTHDAY:c', 'PAIR_CULTURE:south']);
});

test('recommends.game differing from the chosen game is an info line only; a null world checks nothing', () => {
    assert.deepEqual(checkPairing(world(), game({ id: 'other' })).info.map(i => i.code), ['PAIR_RECOMMENDS']);
    assert.deepEqual(checkPairing(world(), game()).info, []);
    assert.deepEqual(checkPairing(null, game()), { errors: [], warnings: [], info: [] });
});

test('works on packs from validatePack', () => {
    const w = validatePack({ id: 'w', format: 4, kind: 'world', version: '1.0.0', requires: { suite: '^0.1' }, content: { start: { date: { year: 1, month: 5, day: 1 } } } });
    assert.equal(w.ok, true, JSON.stringify(w.errors));
    assert.equal(checkPairing(w.pack, null).errors.length, 0);
    const g = validatePack({ id: 'g', format: 4, kind: 'game', version: '1.0.0', requires: { suite: '^0.1' }, content: { calendar: { months } } });
    assert.equal(g.ok, true, JSON.stringify(g.errors));
    assert.deepEqual(checkPairing(w.pack, g.pack).errors.map(e => e.code), ['PAIR_START_DATE']);
});
