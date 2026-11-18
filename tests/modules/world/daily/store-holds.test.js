// The conditions store with the daily step's holders (spec §2 Holders, acceptance tests 16, 25, 26): a world line's re-set keeps the
// longer end and the event holds; an entry an Active event holds is active and never settled whatever its timer; the validator
// takes `holds` and `open`, and `chronicle.daily`.
import test from 'node:test';
import assert from 'node:assert/strict';

import { validateChronicle } from '../../../../modules/world/chronicle/domain.js';
import { dueKeys } from '../../../../modules/world/chronicle/conditions/settle.js';
import { query } from '../chronicle/helpers/fake-ctx.js';
import { DAY, ON, must, set, start } from '../chronicle/conditions.helpers.js';

const at = (state, minutes) => ({ ...state, domains: { ...state.domains, director: { time: { minutes } } } });
const held = state => ({ ...state, domains: { ...state.domains, chronicle: { ...state.domains.chronicle, conditions: { 'unrest@Highmark': { ...state.domains.chronicle.conditions['unrest@Highmark'], holds: ['levy'] } } } } });

test('test 26 (world line): a re-set keeps the longer remaining time; "until cleared" is longest', () => {
    const long = must(set(start(), { name: 'unrest', ref: 'Highmark', fades: '60 days' })).state;
    const short = must(set(at(long, 2 * DAY), { name: 'unrest', ref: 'Highmark', fades: '10 days' })).state;
    assert.equal(short.domains.chronicle.conditions['unrest@Highmark'].fadesAt, 61 * DAY, '60 days remain, not 10');
    const longer = must(set(at(short, 3 * DAY), { name: 'unrest', ref: 'Highmark', fades: '90 days' })).state;
    assert.equal(longer.domains.chronicle.conditions['unrest@Highmark'].fadesAt, 93 * DAY);
    const open = must(set(at(longer, 4 * DAY), { name: 'unrest', ref: 'Highmark', fades: 'until cleared' })).state;
    const after = must(set(at(open, 5 * DAY), { name: 'unrest', ref: 'Highmark', fades: '2 days' })).state;
    assert.equal(after.domains.chronicle.conditions['unrest@Highmark'].fadesAt, null);
});

test('test 16 (holders): a world line on a held condition keeps the event hold; a held entry past its timer is active and not settled', () => {
    const base = held(must(set(start(), { name: 'unrest', ref: 'Highmark', fades: '2 days' })).state);
    const again = must(set(at(base, 2 * DAY), { name: 'unrest', ref: 'Highmark', fades: '2 days' })).state;
    assert.deepEqual(again.domains.chronicle.conditions['unrest@Highmark'].holds, ['levy']);
    const late = at(again, 30 * DAY);
    assert.deepEqual(dueKeys(late.domains.chronicle.conditions, 30 * DAY), [], 'held: not due');
    assert.deepEqual(query(late, 'chronicle.conditions', { ref: 'Highmark' }, { features: ON }).map(entry => entry.name), ['unrest']);
    assert.deepEqual(validateChronicle(late.domains.chronicle), []);
    const plain = must(set(start(), { name: 'unrest', ref: 'Highmark', fades: '2 days' })).state;
    assert.deepEqual(dueKeys(plain.domains.chronicle.conditions, 30 * DAY), ['unrest@Highmark'], 'not held: due as before');
});

test('the chronicle validator takes the daily state and refuses a damaged one', () => {
    const chronicle = must(set(start(), { name: 'unrest', ref: 'Highmark', fades: '2 days' })).state.domains.chronicle;
    const daily = { seed: 'ab', start: 3, day: 5, events: { levy: { state: 'active' } }, anchors: {}, lastMajor: {}, cast: {}, standings: {}, facts: {}, masks: {}, minors: [], cooldowns: {} };
    assert.deepEqual(validateChronicle({ ...chronicle, daily: [daily] }), []);
    assert.ok(validateChronicle({ ...chronicle, daily }).length, 'kept as a slot, [state]');
    assert.ok(validateChronicle({ ...chronicle, daily: [{ ...daily, events: { levy: { state: 'sleeping' } } }] }).length);
    assert.ok(validateChronicle({ ...chronicle, daily: [{ ...daily, extra: 1 }] }).length);
    const bad = { ...chronicle.conditions['unrest@Highmark'], open: true };
    assert.ok(validateChronicle({ ...chronicle, conditions: { 'unrest@Highmark': bad } }).length, 'open only beside holds');
});

test('a hold whose event is not Active in the step\'s state (its reply deleted, the state lost) is released at the next step', async () => {
    const { runDays } = await import('../../../../modules/world/daily/step.js');
    const table = { 'unrest@Highmark': { name: 'unrest', scope: 'place', ref: 'Highmark', since: DAY, fadesAt: null, holds: ['levy'], why: '', by: 'event:levy', rev: 1 } };
    const w = { places: [{ name: 'Highmark', region: 'The March', kind: 'town' }], conditions: [{ name: 'unrest', scope: 'place', fades: '10 days' }] };
    const out = runDays({ state: null, table, world: w, today: 3, seed: 's' });
    assert.equal(out.conditions['unrest@Highmark'], undefined, 'no holder left: it ends');
    const timed = runDays({ state: null, table: { 'unrest@Highmark': { ...table['unrest@Highmark'], fadesAt: 20 * DAY } }, world: w, today: 3, seed: 's' });
    assert.deepEqual([timed.conditions['unrest@Highmark'].fadesAt, timed.conditions['unrest@Highmark'].holds], [20 * DAY, undefined], 'its own timer runs on');
});
