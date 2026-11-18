// WEFIXCORE (REVENG1 findings 4 and 5): a narrator clear of a condition that is not active still tombs it for the day; setting
// an entry past its end that settle has not removed yet starts it anew.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY, run, set, start } from './conditions.helpers.js';
import { ledgerOf } from '../../../../modules/world/chronicle/conditions/ledger.js';

const at = (state, minutes) => ({ ...state, domains: { ...state.domains, director: { time: { minutes } } } });

test('finding 4: a clear of an inactive condition is a note and still tombs it: a set there the same day is refused', () => {
    const cleared = run(start(), 'chronicle.condition.clear', { name: 'unrest', ref: 'Highmark', by: 'narrator', why: 'x' });
    assert.equal(cleared.ok, true);
    assert.match(cleared.result.summary, /not active/);
    assert.deepEqual(ledgerOf(cleared.state.domains.chronicle.ledger).tomb, { day: 1, keys: ['unrest@Highmark'] });
    const again = set(cleared.state, { name: 'unrest', ref: 'Highmark' });
    assert.equal(again.ok, false);
    assert.equal(again.code, 'REFUSED');
    assert.equal(set(at(cleared.state, 2 * DAY), { name: 'unrest', ref: 'Highmark' }).ok, true, 'the next day it may be set');
});

test('finding 5: setting an expired, not yet settled entry again is a new start (new since, a set: anchor), not "Still"', () => {
    const first = set(start(), { name: 'unrest', ref: 'Highmark', fades: '2 days' });
    assert.equal(first.ok, true);
    const later = at(first.state, 5 * DAY);
    const second = set(later, { name: 'unrest', ref: 'Highmark', fades: '2 days' });
    assert.equal(second.ok, true);
    assert.match(second.result.summary, /^Now:/);
    assert.equal(second.result.data.created, true);
    const entry = second.state.domains.chronicle.conditions['unrest@Highmark'];
    assert.deepEqual([entry.since, entry.fadesAt], [5 * DAY, 7 * DAY]);
    assert.deepEqual(ledgerOf(second.state.domains.chronicle.ledger).anchors['set:unrest'], [1, 5]);
    // An entry still running is "Still", as before.
    const live = set(at(first.state, 2 * DAY), { name: 'unrest', ref: 'Highmark', fades: '2 days' });
    assert.match(live.result.summary, /^Still:/);
});
