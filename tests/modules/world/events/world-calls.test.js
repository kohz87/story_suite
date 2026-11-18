// The world-events condition calls and event fields (feature story-director.world-events).
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCondition } from '../../../../modules/world/events/condition.js';
import { inspect, normalizeEvents } from '../../../../modules/world/events/engine.js';
import { WORLD_ARITY, WORLD_FEATURE, worldCalls, worldOn } from '../../../../modules/world/events/world-calls.js';
import { worldEnv } from '../../../../modules/world/events/engine-parts/world-env.js';

const conditions = [
    { name: 'grain-dear', scope: 'region', ref: 'the March', since: 10, fadesAt: null, why: 'blight', by: 'code', rev: 1 },
    { name: 'unrest', scope: 'place', ref: 'Highmark Capital', since: 20, fadesAt: 900, why: 'riots', by: 'narrator', rev: 2 },
];
const days = [{ day: 3, brief: 'The emperor Aldric died at dawn.', facts: ['A courier rode north'] }];
// The chronicle's own query is job A's; this stub answers as the contract says (active conditions, filtered).
const queryOf = (rows = conditions, journal = { days }) => (name, args = {}) => {
    if (name === 'chronicle.conditions') return rows.filter(row => (!args.ref || row.ref === args.ref) && (!args.name || row.name === args.name));
    if (name === 'director.journal') return journal;
    return null;
};
const stateOf = claims => ({ v: 2, meta: { rev: 1, claims }, domains: {} });
const on = { feature: id => id === WORLD_FEATURE };
const env = (state, query, def = {}, defs = []) => worldEnv({ state, query, ...on }, def, defs);
const run = (source, e) => evaluateCondition(source, e);

test('condition(): a name at the event where, at a given ref, or anywhere with no where', () => {
    const state = stateOf({});
    const q = queryOf();
    assert.equal(run("condition('grain-dear', 'the March')", env(state, q)).met, true);
    assert.equal(run("condition('grain-dear', 'Elsewhere')", env(state, q)).met, false);
    assert.equal(run("condition('unrest')", env(state, q, { where: ['Highmark Capital'] })).met, true);
    assert.equal(run("condition('unrest')", env(state, q, { where: ['the March'] })).met, false);
    assert.equal(run("condition('unrest')", env(state, q)).met, true);
    assert.equal(run("condition('nope')", env(state, q)).met, false);
});

test('condition() follows the store: a cleared or faded condition is no longer met (swipe, middle delete, rewind)', () => {
    const state = stateOf({});
    assert.equal(run("condition('unrest')", env(state, queryOf())).met, true);
    assert.equal(run("condition('unrest')", env(state, queryOf([conditions[0]]))).met, false);
});

test('active(): an event that happened and has not ended', () => {
    const q = queryOf();
    const def = { id: 'flood', ends_when: { any_of: ['set:unrest@Highmark Capital', 'cleared:nothing'] } };
    const defs = [def];
    assert.equal(run("active('flood')", env(stateOf({ 'event:flood': true }), queryOf([conditions[0]]), {}, defs)).met, true);
    assert.equal(run("active('flood')", env(stateOf({ 'event:flood': true }), q, {}, defs)).met, false, 'ends_when is met');
    assert.equal(run("active('flood')", env(stateOf({}), q, {}, defs)).met, false, 'never happened');
    assert.equal(run("active('flood')", env(stateOf({ 'event:flood:4': true }), queryOf([]), {}, [{ id: 'flood' }])).met, true, 'a repeating event');
    assert.equal(run("active('flood')", env(stateOf({ 'event:flood': true }), q, {}, [{ id: 'flood', ends_when: { for: '40 days', any_of: ['ended:coronation'] } }])).met, true, 'for and ended: are the daily trigger\'s, they end nothing here');
    assert.equal(run("active('flood')", env(stateOf({ 'event:flood': true, 'event:coronation': true }), queryOf([]), {}, [{ id: 'flood', ends_when: { any_of: ['fired:coronation'] } }])).met, false, 'a fired anchor ends it');
});

test('fact(): a Journal record mentions the text, any case', () => {
    const state = stateOf({});
    assert.equal(run("fact('emperor aldric died')", env(state, queryOf())).met, true);
    assert.equal(run("fact('A COURIER')", env(state, queryOf())).met, true);
    assert.equal(run("fact('the queen lives')", env(state, queryOf())).met, false);
    assert.equal(run("fact('x')", env(state, queryOf(conditions, { days: [] }))).met, false);
});

test('a bad call value is an error value, not a throw', () => {
    const e = env(stateOf({}), queryOf());
    assert.match(run("condition('')", e).error.message, /needs a word in quotes/);
    assert.equal(run("condition('a', 'b', 'c')", e).met, false);
    assert.match(run("condition('a', 'b', 'c')", e).error.message, /takes 1 to 2 values/);
    assert.match(run("fact('x')", env(stateOf({}), undefined)).error.message, /no queries/);
});

test('with the switch off the calls are unknown, exactly as on the base', () => {
    const base = evaluateCondition("condition('unrest')", { state: stateOf({}), query: queryOf() });
    assert.equal(base.met, false);
    assert.match(base.error.message, /not something a condition can call|isn't|not a/i);
    assert.equal(worldOn({}), false);
    assert.equal(worldOn({ feature: () => false }), false);
    assert.equal(worldOn({ feature: () => undefined }), false);
    assert.equal(worldOn({ feature: id => id === WORLD_FEATURE }), true);
    assert.deepEqual(Object.keys(WORLD_ARITY), ['condition', 'active', 'fact']);
    assert.deepEqual(Object.keys(worldCalls({})), ['condition', 'active', 'fact']);
});

const raw = (extra = {}) => ({ id: 'e1', cue: 'It happens.', when: 'true', ...extra });
test('inspect: an event waits on a condition, fires when it is met; off it is invalid', () => {
    const list = [raw({ when: "condition('unrest', 'Highmark Capital') && !active('other')", certainty: 'likely' })];
    const view = (q, feature) => ({ state: stateOf({}), query: q, ...(feature ? { feature } : {}) });
    const onFeature = id => id === WORLD_FEATURE;
    assert.deepEqual(inspect(view(queryOf(), onFeature), list).due, ['e1']);
    assert.deepEqual(inspect(view(queryOf([]), onFeature), list).due, []);
    const off = inspect(view(queryOf()), list);
    assert.deepEqual(off.due, []);
    assert.equal(off.invalid.length, 1);
    assert.match(off.invalid[0].why, /can't be read/);
});

test('inspect: the same state gives the same answer twice (replay equals live)', () => {
    const list = [raw({ when: "condition('unrest') && fact('aldric')" })];
    const view = { state: stateOf({}), query: queryOf(), feature: id => id === WORLD_FEATURE };
    assert.deepEqual(inspect(view, list).due, inspect({ ...view, state: JSON.parse(JSON.stringify(view.state)) }, list).due);
});

test('the switch is the chronicle part\'s (declared once, not here); events.status reads the reader\'s switch', async () => {
    const { createEventsPart } = await import('../../../../modules/world/events/index-parts/events-part.js');
    const events = [raw({ when: "condition('unrest')" })];
    const part = createEventsPart({ events: () => events, command: () => ({ ok: true }), query: () => null });
    assert.equal(part.features, undefined, 'Story Block\'s merged parts drop a part\'s features: the switch is declared once, in Story Director\'s chronicle part');
    const state = stateOf({});
    const tools = feature => ({ query: queryOf(), feature });
    assert.deepEqual(part.queries['events.status'](state, {}, tools(id => id === WORLD_FEATURE)).due, ['e1']);
    assert.equal(part.queries['events.status'](state, {}, tools(() => false)).invalid.length, 1);
});
