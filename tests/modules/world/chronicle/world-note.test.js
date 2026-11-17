// The world note (job F): off is the base's tail byte for byte; on, the conditions here, the news that has reached here and today's cue,
// from the contract's queries (stubbed: jobs A and E are separate), within the budget, the same for the same state.

import test from 'node:test';
import assert from 'node:assert/strict';

import { WORLD_EVENTS_FEATURE, WORLD_NOTE_BUDGET, WORLD_NOTE_HEADER, worldEventsOn, worldNote } from '../../../../modules/world/chronicle/world-note.js';
import { chronicleTail } from '../../../../modules/world/chronicle/note.js';
import { part, tail } from '../../../../modules/world/chronicle/index.js';
import { lines, makeState, sceneAt, viewOf } from './helpers/fake-ctx.js';

const DAY = 1440;
const CONDITIONS = [
    { name: 'Plague', scope: 'region', ref: 'Marches', since: DAY - 120, why: 'sickness in the villages' },
    { name: 'Pass closed', scope: 'place', ref: 'Dragonfang', since: DAY - 600, why: 'snow' },
    { name: 'Flooded', scope: 'place', ref: 'Elsewhere', since: 0, why: 'not here' },
];
const NEWS = [
    { name: 'Border War', summary: 'Raiders cross the river.', updated: 100 },
    { name: 'Red Plague', summary: 'It spreads east.', updated: 300 },
    { name: 'Old Story', summary: 'Ancient.', updated: 1 },
];

function world({ on = true, conditions = CONDITIONS, heard = NEWS, cue = undefined } = {}) {
    const state = sceneAt(makeState({ minutes: DAY }), 'Dragonfang');
    const base = viewOf(state);
    const answers = {
        'chronicle.conditions': () => conditions,
        'atlas.place': () => ({ region: 'Marches' }),
        'atlas.routes': () => [],
        'world.heardHere': () => heard,
        'world.cueToday': () => cue,
    };
    const ask = (name, args) => (name in answers ? answers[name](args) : base.query(name, args));
    return { state, view: { ...base, query: ask, feature: id => (id === WORLD_EVENTS_FEATURE ? on : undefined) } };
}

test('the switch is off by default and a host without features gets nothing', () => {
    assert.equal(worldEventsOn({}), false);
    assert.equal(worldEventsOn({ feature: () => false }), false);
    assert.equal(worldEventsOn({ feature: () => { throw new Error('x'); } }), false);
    assert.equal(worldEventsOn({ feature: id => id === WORLD_EVENTS_FEATURE }), true);
    const feature = part.features.find(each => each.id === WORLD_EVENTS_FEATURE);
    assert.equal(feature.default, false);
    assert.deepEqual(worldNote({ ...world().view, feature: undefined }), []);
});

test('with the switch off the tail is the base tail, byte for byte', () => {
    const { state, view } = world({ on: false, cue: 'A fair in town' });
    const withEvent = lines(state, '+ world Border War — raiders cross the river | state: ongoing | Dragonfang').state;
    const off = { ...view, state: withEvent };
    const expected = chronicleTail(viewOf(withEvent));
    assert.deepEqual(tail(off).lines, expected.lines);
    assert.deepEqual(worldNote(off), []);
    const on = { ...off, feature: () => true };
    assert.deepEqual(tail(on).lines.slice(0, expected.lines.length), expected.lines, 'on: the [World] lines first, the note after');
    assert.ok(tail(on).lines.length > expected.lines.length);
});

test('on: conditions at the scene (its place, then its region), the two newest news items, the cue', () => {
    const { view } = world({ cue: 'A fair opens in the square.' });
    const out = worldNote(view);
    assert.equal(out[0], WORLD_NOTE_HEADER);
    assert.match(out[1], /^Conditions here: Pass closed at Dragonfang \(since .+\): snow; Plague at Marches/);
    assert.doesNotMatch(out[1], /Flooded/, 'a condition elsewhere is not here');
    assert.match(out[2], /^News that has reached here: Red Plague — It spreads east; Border War — Raiders cross the river\.$/);
    assert.doesNotMatch(out[2], /Old Story/);
    assert.equal(out[3], 'Today: A fair opens in the square.');
    assert.ok(out.join('\n').length <= WORLD_NOTE_BUDGET * 4);
});

test('on: nothing to say is no lines; a missing query is just a shorter note', () => {
    assert.deepEqual(worldNote(world({ conditions: [], heard: [] }).view), []);
    const only = worldNote(world({ conditions: [], heard: [], cue: { text: 'Market day' } }).view);
    assert.deepEqual(only, [WORLD_NOTE_HEADER, 'Today: Market day.']);
    const broken = { ...world().view, query: () => { throw new Error('gone'); } };
    assert.deepEqual(worldNote(broken), []);
});

test('the note stays within its budget however much there is, and keeps the conditions', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ name: `Condition ${i}`, scope: 'place', ref: 'Dragonfang', since: i, why: 'a very long reason '.repeat(10) }));
    const news = Array.from({ length: 6 }, (_, i) => ({ name: `Event ${i}`, summary: 'long summary '.repeat(30), updated: i }));
    const out = worldNote(world({ conditions: many, heard: news, cue: 'cue '.repeat(100) }).view);
    assert.ok(out.join('\n').length <= WORLD_NOTE_BUDGET * 4, out.join('\n').length);
    assert.match(out[1], /^Conditions here: /);
});

test('replay == live: the same state and queries give the same note; a state with the news changed gives a different one', () => {
    const a = worldNote(world().view);
    assert.deepEqual(worldNote(world().view), a, 'swipe, reload, rewind: a pure function of the state');
    // A middle delete or an edited Re-read changes what the queries return; the note follows the answer, nothing is kept.
    assert.notDeepEqual(worldNote(world({ heard: [] }).view), a);
    assert.notDeepEqual(worldNote(world({ conditions: [CONDITIONS[2]] }).view), a);
    assert.deepEqual(worldNote(world({ heard: [] , conditions: [CONDITIONS[2]] }).view), []);
});
