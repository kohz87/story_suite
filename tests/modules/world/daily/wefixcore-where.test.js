// WEFIXCORE (REVENG1 findings 1 and 3): a kinds `where` honours its region / realm narrowing and its realm caps; an anchor in ends_when
// ends an event only when it becomes true AFTER the event fired.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { drawWith, runner, world } from './helpers.js';

const PLACES = [
    { name: 'Alpha Deep', id: 'a-deep', region: 'Highmark March', kind: 'dungeon', x: 0, y: 0 },
    { name: 'Beta Deep', id: 'b-deep', region: 'Lowfen', kind: 'dungeon', x: 5, y: 0 },
    { name: 'Gamma Deep', id: 'c-deep', region: 'Valegard', kind: 'dungeon', x: 9, y: 0 },
    { name: 'Oakhollow', region: 'Valegard', kind: 'town', x: 10, y: 0 },
];
const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'likely', ends_when: { for: '100 days' }, summary: id, ...extra });
// Draw 0 hits every roll and picks the first place in id order, so a dropped narrowing shows as Alpha Deep (the Highmark Empire's).
const always = () => 0;
const placeOf = run => run.reports.flatMap(report => report.journal).map(entry => entry.place ?? entry.text ?? JSON.stringify(entry));

test('finding 1: where { kinds, realm } and { kinds, region } place only inside that realm / region', () => {
    const realm = world({ places: PLACES, events: [ev('break', { kind: 'recurring', where: { kinds: ['dungeon'], realm: 'River Realm' }, ends_when: 'instant', severity: 'minor' })] });
    const one = runner(realm, { draw: always }).to(1);
    assert.match(placeOf(one).join('|'), /Beta Deep/);
    assert.doesNotMatch(placeOf(one).join('|'), /Alpha Deep|Gamma Deep/);
    const region = world({ places: PLACES, events: [ev('break', { kind: 'recurring', where: { kinds: ['dungeon'], region: 'Valegard' }, ends_when: 'instant', severity: 'minor' })] });
    assert.match(placeOf(runner(region, { draw: always }).to(1)).join('|'), /Gamma Deep/);
    const none = world({ places: PLACES, events: [ev('break', { kind: 'recurring', where: { kinds: ['dungeon'], realm: 'No Such Realm' }, ends_when: 'instant', severity: 'minor' })] });
    const empty = runner(none, { draw: always }).to(1);
    assert.equal(empty.journal().length, 0, 'an unresolved restriction matches nothing');
});

test('finding 1: a kinds where takes its realm slots in the realms of the matching places (a one-off, no place bound)', () => {
    const w = world({ places: PLACES, events: [ev('uprising', { where: { kinds: ['dungeon'], realm: 'River Realm' }, window: { after: 'start', within: '5 days' } })] });
    const run = runner(w, { draw: always }).to(1);
    assert.deepEqual(run.row('uprising').realms, ['River Realm']);
    const broad = world({ places: PLACES, events: [ev('uprising', { where: { kinds: ['dungeon'] }, window: { after: 'start', within: '5 days' } })] });
    assert.deepEqual(runner(broad, { draw: always }).to(1).row('uprising').realms, ['Highmark Empire', 'River Realm']);
});

test('finding 3: an anchor already true when the event fired does not end it the next day; one that becomes true later does', () => {
    const minor = { severity: 'minor', where: ['Oakhollow'], window: { after: 'start', within: '10 days' } };
    const w = world({ events: [
        ev('early', { ...minor, ends_when: { any_of: ['start'] } }),
        ev('later', { ...minor, ends_when: { any_of: ['fired:trigger'] } }),
        ev('trigger', { ...minor, certainty: 'possible', chance: '50% over the window', ends_when: { for: '100 days' } }),
    ] });
    const run = runner(w, { draw: drawWith({ hits: { early: [1], later: [1], trigger: [4] } }) }).to(4);
    assert.deepEqual([run.row('early').state, run.row('later').state, run.row('trigger').fired], ['active', 'active', 4], '`start` was true when it fired: not ended on day 2');
    run.to(5);
    assert.deepEqual([run.row('early').state, run.row('later').state], ['active', 'ended'], 'fired:trigger became true on day 4: ends it on day 5');
});
