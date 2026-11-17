// The world note (job F, aligned by WEALIGN to spec §2/§4 and seam audit E23): off is the base's tail byte for byte; on, it takes the
// [World] lines' place, pinned: the place status, the conditions here with what they mean and their told prices, the news that has
// reached here and today's happening, from the queries (stubbed here; the host test runs the real ones), within the budget.

import test from 'node:test';
import assert from 'node:assert/strict';

import { WORLD_EVENTS_FEATURE, WORLD_NOTE_BUDGET, WORLD_NOTE_HEADER, effectsText, noteText, worldEventsOn, worldNote } from '../../../../modules/world/chronicle/world-note.js';
import { chronicleTail } from '../../../../modules/world/chronicle/note.js';
import { part, tail } from '../../../../modules/world/chronicle/index.js';
import { lines, makeState, sceneAt, viewOf } from './helpers/fake-ctx.js';

const DAY = 1440;
const DECLARED = [
    { name: 'plague', scope: 'region', means: 'Sickness in the villages.' },
    { name: 'pass-closed', scope: 'place', means: 'Snow shuts the pass.', effects: { routes: 'blocked' } },
    { name: 'grain-dear', scope: 'region', means: 'Bread costs far more.', effects: { prices: { grain: '×2', all: '×1.3', fish: 1.3 } } },
    { name: 'fallen', scope: 'place', means: 'The town has fallen.', placeStatus: true },
];
// What chronicle.conditions { at } answers: narrowest first, each with its level.
const CONDITIONS = [
    { key: 'pass-closed@Dragonfang', name: 'pass-closed', scope: 'place', ref: 'Dragonfang', level: 0, since: DAY - 600, why: 'snow' },
    { key: 'plague@Marches', name: 'plague', scope: 'region', ref: 'Marches', level: 1, since: DAY - 120, why: 'sickness' },
];
const NEWS = [
    { name: 'Border War', summary: 'Raiders cross the river.', arrivesAt: 100, tag: 'fact' },
    { name: 'Red Plague', summary: 'It spreads east.', arrivesAt: 300, tag: 'fact' },
    { name: 'Old Story', summary: 'Ancient.', arrivesAt: 1, tag: 'fact' },
];

function world({ on = true, conditions = CONDITIONS, heard = NEWS, cue = undefined } = {}) {
    const state = sceneAt(makeState({ minutes: DAY }), 'Dragonfang');
    const base = viewOf(state);
    const answers = {
        'chronicle.conditions': args => (args?.at === 'Dragonfang' ? conditions : []),
        'chronicle.conditionNames': () => DECLARED,
        'atlas.place': () => ({ name: 'Dragonfang', region: 'Marches' }),
        'world.heardHere': () => heard,
        'world.cueToday': () => cue,
    };
    const ask = (name, args) => (name in answers ? answers[name](args) : base.query(name, args));
    return { state, view: { ...base, query: ask, feature: id => (id === WORLD_EVENTS_FEATURE ? on : undefined) } };
}
// The note as lines of text (the pinned head is one item with line breaks).
const texts = out => noteText(out).split('\n');

test('the switch is off by default and a host without features gets nothing', () => {
    assert.equal(worldEventsOn({}), false);
    assert.equal(worldEventsOn({ feature: () => false }), false);
    assert.equal(worldEventsOn({ feature: () => { throw new Error('x'); } }), false);
    assert.equal(worldEventsOn({ feature: id => id === WORLD_EVENTS_FEATURE }), true);
    const feature = part.features.find(each => each.id === WORLD_EVENTS_FEATURE);
    assert.equal(feature.default, false);
    assert.deepEqual(worldNote({ ...world().view, feature: undefined }), []);
});

test('with the switch off the tail is the base tail, byte for byte; on, the note takes the [World] lines\' place (E23), its head pinned', () => {
    const { state, view } = world({ on: false, cue: 'A fair in town' });
    const withEvent = lines(state, '+ world Border War — raiders cross the river | state: ongoing | Dragonfang').state;
    const off = { ...view, state: withEvent };
    const expected = chronicleTail(viewOf(withEvent));
    assert.ok(expected.lines.length > 1, 'the base has [World] lines');
    assert.deepEqual(tail(off).lines, expected.lines);
    assert.deepEqual(worldNote(off), []);
    const on = { ...off, feature: () => true };
    const got = tail(on).lines;
    assert.equal(got.some(line => String(line?.text ?? line).startsWith('[World] Under way')), false, 'the [World] lines are retired while the note is sent');
    assert.equal(got[0].text.split('\n')[0], WORLD_NOTE_HEADER);
    assert.equal(got[0].keep, true, 'the head (header, conditions) is pinned; news and today follow as ordinary lines');
    assert.ok(got.slice(1).every(line => typeof line === 'string'));
});

test('on, in order: the place status, the conditions here (narrowest first) with what they mean and their told effects, the two newest news items, today', () => {
    const fallen = { key: 'fallen@Dragonfang', name: 'fallen', scope: 'place', ref: 'Dragonfang', level: 0, since: 0 };
    const dear = { key: 'grain-dear@Marches', name: 'grain-dear', scope: 'region', ref: 'Marches', level: 1, since: 0 };
    const out = texts(worldNote(world({ conditions: [fallen, ...CONDITIONS, dear], cue: { text: 'A fair opens in the square.' } }).view));
    assert.equal(out[0], WORLD_NOTE_HEADER);
    assert.equal(out[1], 'Status here: Dragonfang is fallen (The town has fallen).');
    assert.equal(out[2], 'Conditions here: pass-closed at Dragonfang: Snow shuts the pass (routes blocked); plague at Marches: Sickness in the villages; grain-dear at Marches: Bread costs far more (all goods ×1.3, grain ×2, fish ×1.3).');
    assert.equal(out[3], 'News that has reached here: Red Plague — It spreads east; Border War — Raiders cross the river.');
    assert.equal(out[4], 'Today: A fair opens in the square.');
    assert.ok(out.join('\n').length <= WORLD_NOTE_BUDGET * 4);
});

test('test 58 and ruling 19: prices are told as written, by category, a named one beside "all goods"; nothing is computed', () => {
    assert.equal(effectsText({ prices: { grain: '×2', fish: '×1.3' } }), 'grain ×2, fish ×1.3');
    assert.equal(effectsText({ prices: { grain: '×2', all: '×1.3' } }), 'all goods ×1.3, grain ×2');
    assert.equal(effectsText({ routes: '×0.5 speed' }), 'routes ×0.5 speed');
    assert.equal(effectsText(undefined), '');
});

test('on: nothing to say is no lines; a missing query is just a shorter note', () => {
    assert.deepEqual(worldNote(world({ conditions: [], heard: [] }).view), []);
    assert.deepEqual(texts(worldNote(world({ conditions: [], heard: [], cue: { text: 'Market day' } }).view)), [WORLD_NOTE_HEADER, 'Today: Market day.']);
    const broken = { ...world().view, query: () => { throw new Error('gone'); } };
    assert.deepEqual(worldNote(broken), []);
});

test('the note stays within its budget however much there is, and keeps the conditions first', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ key: `c${i}@Dragonfang`, name: `c${i}`, scope: 'place', ref: 'Dragonfang', level: 0, since: i }));
    const news = Array.from({ length: 6 }, (_, i) => ({ name: `Event ${i}`, summary: 'long summary '.repeat(30), arrivesAt: i }));
    const out = texts(worldNote(world({ conditions: many, heard: news, cue: 'cue '.repeat(100) }).view));
    assert.ok(noteText(out).length <= WORLD_NOTE_BUDGET * 4, noteText(out).length);
    assert.match(out[1], /^Conditions here: c0 at Dragonfang; c1 at Dragonfang; c2 at Dragonfang\.$/, 'at most three');
});

test('replay == live: the same state and queries give the same note; a state with the news changed gives a different one', () => {
    const a = worldNote(world().view);
    assert.deepEqual(worldNote(world().view), a, 'swipe, reload, rewind: a pure function of the state');
    assert.notDeepEqual(worldNote(world({ heard: [] }).view), a);
    assert.notDeepEqual(worldNote(world({ conditions: [] }).view), a);
    assert.deepEqual(worldNote(world({ heard: [], conditions: [] }).view), []);
});

test('a news item still rumour at this place is marked " (rumour)"; a fact is not; off stays empty', () => {
    const heard = [
        { name: 'Border War', summary: 'Raiders cross the river.', arrivesAt: 300, tag: 'rumour' },
        { name: 'Red Plague', summary: 'It spreads east.', arrivesAt: 200, tag: 'fact' },
    ];
    const out = texts(worldNote(world({ heard }).view));
    assert.match(out[2], /^News that has reached here: Border War \(rumour\) — Raiders cross the river; Red Plague — It spreads east\.$/);
    const pulse = texts(worldNote(world({ heard: [{ name: 'Whisper', summary: 'Strange lights.', arrivesAt: 1, rumour: 'heard in the inn' }] }).view));
    assert.match(pulse[2], /Whisper \(rumour\) — Strange lights\.$/);
    assert.deepEqual(worldNote({ ...world({ heard }).view, feature: () => false }), [], 'switch off: no note, no marker');
});
