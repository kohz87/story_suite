// The world conditions store (chronicle.conditions): set, clear, settle, queries, caps, validator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part } from '../../../../modules/world/chronicle/index.js';
import { validateChronicle } from '../../../../modules/world/chronicle/domain.js';
import { fadeMinutes } from '../../../../modules/world/chronicle/conditions/fade.js';
import { conditionsSettleCommands } from '../../../../modules/world/chronicle/conditions/settle.js';
import { query } from './helpers/fake-ctx.js';
import { DAY, ON, PACKS, must, run, set, start } from './conditions.helpers.js';

test('set writes name@ref with the clock, the declared fade and who set it; the chronicle stays valid', () => {
    const { state } = must(set(start(), { name: 'grain-dear', ref: 'the march', by: 'event:ev1' }));
    const entry = state.domains.chronicle.conditions['grain-dear@The March'];
    assert.deepEqual(entry, { name: 'grain-dear', scope: 'region', ref: 'The March', since: DAY, fadesAt: DAY + 10 * DAY, why: 'test', by: 'event:ev1', rev: 1 });
    assert.deepEqual(validateChronicle(state.domains.chronicle), []);
    assert.equal(set(start(), { name: 'roads-closed', ref: 'Highmark-Bluewatch road' }).state.domains.chronicle.conditions['roads-closed@Highmark-Bluewatch'].fadesAt, null);
    assert.equal(must(set(start(), { name: 'unrest', ref: 'The Capital', fades: '3 days' })).state.domains.chronicle.conditions['unrest@Highmark'].fadesAt, 4 * DAY);
});

test('set is refused with a note: undeclared name, wrong scope, unknown ref, bad duration, a click, no clock; the state is untouched', () => {
    const s = start();
    for (const [payload, code, text] of [
        [{ name: 'plague', ref: 'Highmark' }, 'REFUSED', /not one of this world's conditions/],
        [{ name: 'unrest', scope: 'region', ref: 'Highmark' }, 'REFUSED', /place condition/],
        [{ name: 'unrest', ref: 'Atlantis' }, 'REFUSED', /not a place, route, region or realm/],
        [{ name: 'grain-dear', ref: 'Highmark' }, 'REFUSED', /region wanted/],
        [{ name: 'unrest', ref: 'Highmark', fades: 'soonish' }, 'INVALID', /duration/],
        [{ name: 'unrest', ref: 'Highmark', by: 'nobody' }, 'INVALID', /by/],
    ]) {
        const r = set(s, payload);
        assert.deepEqual([r.ok, r.code], [false, code], JSON.stringify(payload));
        assert.match(r.message, text);
        assert.equal(r.state, s);
    }
    assert.equal(set(s, { name: 'unrest', ref: 'Highmark' }, { cause: 'ui' }).code, 'REFUSED');
    assert.equal(set(start(null), { name: 'unrest', ref: 'Highmark' }).code, 'NOT_YET');
});

test('setting an active one again keeps its start and moves its end; clear removes it, an inactive clear is a note', () => {
    const a = must(set(start(), { name: 'unrest', ref: 'Highmark', fades: '2 days' })).state;
    const b = must(set({ ...a, domains: { ...a.domains, director: { time: { minutes: 2 * DAY } } } }, { name: 'unrest', ref: 'Highmark', fades: '2 days' })).state;
    assert.deepEqual([b.domains.chronicle.conditions['unrest@Highmark'].since, b.domains.chronicle.conditions['unrest@Highmark'].fadesAt], [DAY, 4 * DAY]);
    const cleared = must(run(b, 'chronicle.condition.clear', { name: 'unrest', ref: 'highmark', by: 'narrator', why: 'calm' }));
    assert.deepEqual(cleared.state.domains.chronicle.conditions, {});
    const again = must(run(cleared.state, 'chronicle.condition.clear', { name: 'unrest', ref: 'Highmark', by: 'narrator', why: 'x' }));
    assert.match(again.result.summary, /not active/);
    assert.equal(run(cleared.state, 'chronicle.condition.clear', { name: 'plague', ref: 'Highmark', by: 'narrator', why: 'x' }).code, 'REFUSED');
});

test('caps: 8 per ref, 64 in all; an active one can still be refreshed at the cap', () => {
    const names = Array.from({ length: 9 }, (_, i) => `c${i}`);
    const packs = { ...PACKS, conditions: names.map(name => ({ name, scope: 'place', fades: 'until cleared', means: 'x' })) };
    let s = start();
    for (const name of names.slice(0, 8)) s = must(set(s, { name, ref: 'Highmark' }, { packs })).state;
    const over = set(s, { name: 'c8', ref: 'Highmark' }, { packs });
    assert.deepEqual([over.ok, over.code], [false, 'REFUSED']);
    assert.equal(set(s, { name: 'c0', ref: 'Highmark' }, { packs }).ok, true);
    assert.equal(set(s, { name: 'c8', ref: 'Bluewatch' }, { packs }).ok, true);
    const many = { ...s, domains: { ...s.domains, chronicle: { ...s.domains.chronicle, conditions: Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`c${i}@P${i}`, { name: `c${i}`, scope: 'place', ref: `P${i}`, since: 1, fadesAt: null, why: '', by: 'code', rev: 1 }])) } } };
    assert.match(validateChronicle(many.domains.chronicle).join(' '), /at most 64/);
});

test('settle removes exactly those whose end has come, in key order, with a receipt; the hook asks only when something is due and the feature is on', () => {
    let s = start();
    s = must(set(s, { name: 'grain-dear', ref: 'The March', fades: '1 day' })).state;
    s = must(set(s, { name: 'unrest', ref: 'Highmark', fades: '3 days' })).state;
    s = must(set(s, { name: 'roads-closed', ref: 'Highmark-Bluewatch' })).state;
    const at = minutes => ({ ...s, domains: { ...s.domains, director: { time: { minutes } } } });
    const view = (state, features = ON) => ({ state, feature: id => features[id] === true });
    assert.deepEqual(conditionsSettleCommands(view(at(DAY + 100))), []);
    assert.deepEqual(conditionsSettleCommands(view(at(2 * DAY))).map(c => c.type), ['chronicle.conditions.settle']);
    assert.deepEqual(conditionsSettleCommands(view(at(2 * DAY), {})), [], 'off: nothing');
    const done = must(run(at(2 * DAY), 'chronicle.conditions.settle', {}));
    assert.deepEqual(Object.keys(done.state.domains.chronicle.conditions).sort(), ['roads-closed@Highmark-Bluewatch', 'unrest@Highmark']);
    assert.equal(done.result.summary, 'Faded: grain-dear on The March.');
    const all = must(run(at(9 * DAY), 'chronicle.conditions.settle', {}));
    assert.deepEqual(Object.keys(all.state.domains.chronicle.conditions), ['roads-closed@Highmark-Bluewatch']);
});

test('queries answer active ones only (a lapsed one not yet settled is not active), by ref, scope and name; null while the feature is off', () => {
    let s = start();
    s = must(set(s, { name: 'grain-dear', ref: 'The March', fades: '1 day' })).state;
    s = must(set(s, { name: 'unrest', ref: 'Highmark' })).state;
    const ask = (state, name, args = {}) => query(state, name, args, { packs: PACKS });
    const feature = Object.assign({}, part.queries['chronicle.conditions']).feature;
    assert.equal(feature, 'story-director.world-events');
    assert.deepEqual(ask(s, 'chronicle.conditions').map(c => c.key), ['grain-dear@The March', 'unrest@Highmark']);
    assert.deepEqual(ask(s, 'chronicle.conditions', { ref: 'highmark' }).map(c => c.name), ['unrest']);
    assert.deepEqual(ask(s, 'chronicle.conditions', { scope: 'region' }).map(c => c.name), ['grain-dear']);
    assert.deepEqual(ask(s, 'chronicle.conditions', { name: 'x' }), []);
    const later = { ...s, domains: { ...s.domains, director: { time: { minutes: 3 * DAY } } } };
    assert.deepEqual(ask(later, 'chronicle.conditions').map(c => c.name), ['unrest']);
    assert.deepEqual(ask(s, 'chronicle.conditionNames').map(c => [c.name, c.scope, c.fades]), PACKS.conditions.map(c => [c.name, c.scope, c.fades]));
});

test('fadeMinutes: durations, seasons, until cleared, nonsense', () => {
    assert.deepEqual([fadeMinutes('10 days'), fadeMinutes('1 season'), fadeMinutes('2 months'), fadeMinutes('until cleared'), fadeMinutes(null), fadeMinutes('6 hours')], [10 * DAY, 90 * DAY, 60 * DAY, null, null, 360]);
    assert.deepEqual([fadeMinutes('soon'), fadeMinutes(''), fadeMinutes(5), fadeMinutes('0 days')], [undefined, undefined, undefined, undefined]);
});

test('a chronicle with no conditions is exactly as before: no field, still valid', () => {
    const initial = part.domains.chronicle.initial();
    assert.equal('conditions' in initial, false);
    assert.deepEqual(validateChronicle(initial), []);
    assert.match(validateChronicle({ ...initial, conditions: { x: 1 } }).join(' '), /not a condition/);
});
