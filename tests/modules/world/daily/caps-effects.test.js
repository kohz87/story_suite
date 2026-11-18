// World events daily step: caps, condition holders, scope and effects (acceptance tests 5, 6, 7, 8, 19, 20, 24, 25, 26, 29).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { drawWith, runner, world } from './helpers.js';

const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'likely', ends_when: { for: '100 days' }, summary: id, ...extra });
const open = (within = '20 days') => ({ window: { after: 'start', within } });
const active = run => Object.entries(run.state.events).filter(([, row]) => row.state === 'active').map(([id]) => id).sort();
const DAY = 1440;

test('test 5 and 24: a broader condition satisfies a narrower ref, a local clear masks it there only, never upward', () => {
    const w = world({ events: [
        ev('valley-levy', { where: ['Oakhollow'], requires: ['at-war@Oakhollow'], ...open() }),
        ev('march-levy', { where: ['Highmark Capital'], requires: ['at-war@Highmark Capital'], ...open() }),
        ev('imperial-war', { where: ['Highmark Empire'], requires: ['at-war@Highmark Empire'], ...open() }),
        ev('peace-talks', { certainty: 'set-in-motion', where: ['Oakhollow'], window: { after: 'start', within: '2 days' }, effects: { clear: ['at-war@Valegard'] } }),
    ] });
    const run = runner(w).set('at-war', 'Highmark Empire', 1).to(1);
    assert.deepEqual(['valley-levy', 'march-levy', 'imperial-war'].map(id => run.row(id).state), ['eligible', 'eligible', 'eligible']);
    run.to(3);
    assert.equal(run.row('valley-levy').state, 'dormant', 'the local clear at Valegard makes it false at Oakhollow');
    assert.equal(run.row('march-levy').state, 'eligible', 'still true elsewhere in the realm');
    const narrow = runner(w).set('at-war', 'Valegard', 1, 'region').to(1);
    assert.equal(narrow.row('valley-levy').state, 'eligible');
    assert.equal(narrow.row('imperial-war').state, 'dormant', 'test 24: a narrower set never satisfies the realm');
});

test('test 6: the Wilds cap — a third wild major\'s success is discarded, it rolls again, fires when a slot frees, else lapses', () => {
    const wild = (id, extra) => ev(id, { where: [id === 'third' ? 'Far Camp' : 'Wild Camp'], ...extra });
    const w = world({ events: [
        wild('first', { certainty: 'set-in-motion', window: { after: 'start', within: '1 day' }, ends_when: { for: '4 days' } }),
        wild('second', { certainty: 'set-in-motion', window: { after: 'start', within: '1 day' }, ends_when: { for: '50 days' } }),
        wild('third', { chance: '50% over the window', window: { after: 'start', within: '60 days' } }),
    ] });
    const run = runner(w, { draw: () => 0 }).to(3);
    assert.deepEqual(active(run), ['first', 'second']);
    assert.ok(run.log('cap', 'third').length >= 2, 'blocked and rolled again the next day');
    assert.equal(run.row('third').state, 'eligible');
    run.to(5);
    assert.equal(run.row('third').state, 'eligible', 'the slot freed on day 5 but the 45-day timer still holds');
    run.to(46);
    assert.equal(run.row('third').fired, 46, 'fires once a slot and the timer allow and a roll succeeds');
    const never = runner(world({ events: [w.events[0], { ...w.events[1] }, { ...w.events[2], window: { after: 'start', within: '10 days' } }] }), { draw: () => 0 }).to(12);
    assert.equal(never.row('third').state, 'lapsed');
});

test('test 7: same tick, clear beats set — set-in-motion → chain → template; unrest@Town cleared all day; peace set; identical across runs', () => {
    const w = world({
        events: [
            ev('uprising', { certainty: 'set-in-motion', where: ['Town'], window: { after: 'start', within: '1 day' }, effects: { set: ['unrest@Town: 30 days'] } }),
            ev('truce-made', { kind: 'chain-stage', certainty: 'likely', severity: 'minor', where: ['Town'], requires: ['stage:uprising'], window: { after: 'fired:uprising', within: '1 day' }, effects: { clear: ['unrest@Town'], set: ['peace@Town: 5 days'] } }),
        ],
        templates: [{ template: 'agitators', scope: 'place', severity: 'minor', where: { kinds: ['town'] }, sets: ['unrest@place: 10 days'], chance: '100% per season', summary: 'Agitators in {place}.' }],
    });
    const runs = [1, 2].map(() => runner(w, { draw: drawWith({ hits: { 'truce-made': [1] }, values: { 'template:agitators#place': () => 0.99, 'template:agitators': () => 0 } }) }).to(1));
    const [run] = runs;
    assert.equal(run.table['unrest@Town'], undefined, 'cleared on day T and not set again that day');
    assert.ok(run.table['peace@Town']);
    assert.ok(run.log('kept-clear').some(entry => entry.key === 'unrest@Town'), 'the template\'s set was refused by the tombstone');
    assert.deepEqual(runs[0].state, runs[1].state);
    assert.deepEqual(runs[0].table, runs[1].table);
});

test('test 8: a set-in-motion event fires over the realm cap, occupies a slot, resets the timer; a likely the same day is blocked and lapses; a no-realm event checks only the world cap', () => {
    const at = { where: ['Highmark Empire'] };
    const w = world({ events: [
        ev('m1', { certainty: 'set-in-motion', ...at, window: { after: 'start', within: '1 day' } }),
        ev('m2', { certainty: 'set-in-motion', ...at, window: { after: 'start', within: '1 day' } }),
        ev('deadline', { certainty: 'set-in-motion', ...at, window: { after: 'start', within: '50 days' }, less_if: { 'truce@Highmark Empire': '×0' } }),
        ev('hopeful', { ...at, window: { after: 'start', within: '60 days' } }),
        ev('wide', { certainty: 'likely', reach: 'world', window: { after: 'start', within: '60 days' } }),
    ] });
    const run = runner(w, { draw: drawWith({ hits: { hopeful: [50], wide: [10] } }) }).set('truce', 'Highmark Empire', 1).to(50);
    assert.deepEqual(active(run), ['deadline', 'm1', 'm2', 'wide'], 'three active in the realm (over the cap), the no-realm one by the world cap only');
    assert.equal(run.state.lastMajor['Highmark Empire'], 50, 'the timer restarted');
    assert.ok(run.log('cap', 'hopeful').some(entry => entry.day === 50));
    run.to(61);
    assert.equal(run.row('hopeful').state, 'lapsed');
});

test('test 19: on_end applies when the event Ends (not when Replaced or Lapsed); an instant event ends the same day with its on_end', () => {
    const crisis = extra => ev('crisis', { certainty: 'set-in-motion', where: ['Highmark Empire'], requires: ['crown-contested@Highmark Empire'], window: { after: 'start', within: '1 day' }, ends_when: { for: '5 days' }, effects: { on_end: { clear: ['crown-contested@Highmark Empire'], scores: { Stability: 15 } } }, ...extra });
    const run = runner(world({ events: [crisis()] })).set('crown-contested', 'Highmark Empire', 1).to(5);
    assert.ok(run.table['crown-contested@Highmark Empire'], 'still true on every Active day');
    run.to(6);
    assert.equal(run.table['crown-contested@Highmark Empire'], undefined);
    assert.equal(run.state.standings['score:Stability'], 15);
    const lapsed = runner(world({ events: [crisis({ requires: ['crown-contested@Highmark Empire', 'fact:never'] })] })).set('crown-contested', 'Highmark Empire', 1).to(3);
    assert.equal(lapsed.row('crisis').state, 'lapsed');
    assert.equal(lapsed.state.standings['score:Stability'], 0, 'on_end does not apply on a lapse');
    const instant = runner(world({ events: [crisis({ ends_when: 'instant' })] })).set('crown-contested', 'Highmark Empire', 1).to(1);
    assert.deepEqual([instant.row('crisis').fired, instant.row('crisis').ended, instant.state.standings['score:Stability']], [1, 1, 15]);
});

test('test 20: effects.scores and powers clamp to −100..100 and are not clipped by the per-deed limits', () => {
    const w = world({ scores: [{ name: 'Stability', start: 95 }, { name: 'Order', start: -90 }], powers: [{ name: 'Crown', start: 0 }], events: [
        ev('boom', { certainty: 'set-in-motion', where: ['Highmark Empire'], window: { after: 'start', within: '1 day' }, ends_when: 'instant', effects: { scores: { Stability: 20, Order: -30 }, powers: { Crown: 40 } } }),
    ] });
    const run = runner(w).to(1);
    assert.deepEqual(run.state.standings, { 'power:Crown': 40, 'score:Stability': 100, 'score:Order': -100 });
});

test('test 25: an omitted duration by source — template → fades; event → held while Active; "until cleared" on an event overrides; < 1 day → 1 day', () => {
    const w = world({
        events: [
            ev('siege', { certainty: 'set-in-motion', where: ['Town'], window: { after: 'start', within: '1 day' }, ends_when: { for: '3 days' }, effects: { set: ['unrest@Town', 'grain-dear@Valegard: until cleared', 'peace@Oakhollow: 0 days'] } }),
        ],
        templates: [{ template: 'bread-riot', severity: 'minor', where: { kinds: ['capital'] }, sets: ['unrest@place'], chance: '100% per season', summary: 'Riot.' }],
    });
    const run = runner(w, { draw: drawWith({ values: { 'template:bread-riot': () => 0 } }) }).to(1);
    assert.deepEqual(run.table['unrest@Town'].holds, ['siege']);
    assert.equal(run.table['unrest@Highmark Capital'].fadesAt, 11 * DAY, 'a template with no duration lasts the condition\'s fades (10 days)');
    assert.equal(run.table['peace@Oakhollow'].fadesAt, 2 * DAY, 'raised to 1 day');
    run.to(4);
    assert.equal(run.table['unrest@Town'], undefined, 'released when the event ends, not 10 days');
    assert.equal(run.table['grain-dear@Valegard'].fadesAt, null, 'until cleared outlives the event');
});

test('test 26 (and 16): a re-set keeps the longer remaining time; a short event hold never ends a longer timer', () => {
    const set = (id, day, text, extra = {}) => ev(id, { certainty: 'set-in-motion', where: ['Valegard'], window: { after: 'start', within: `${day} days` }, ends_when: 'instant', effects: { set: [text] }, ...extra });
    const w = world({ events: [
        set('famine', 1, 'grain-dear@Valegard: 60 days'),
        set('relief', 2, 'grain-dear@Valegard: 10 days'),
        set('drought', 3, 'grain-dear@Valegard: 90 days'),
        set('market-day', 4, 'grain-dear@Valegard', { ends_when: { for: '2 days' } }),
    ] });
    const run = runner(w, { draw: () => 0.999999 }).to(2);
    assert.equal(run.table['grain-dear@Valegard'].fadesAt, 61 * DAY, '60 days remain, not 10');
    run.to(3);
    assert.equal(run.table['grain-dear@Valegard'].fadesAt, 93 * DAY, '90 remain');
    run.to(7);
    assert.ok(run.table['grain-dear@Valegard'], 'the event hold ended on day 6 and the timer runs on');
    assert.equal(run.table['grain-dear@Valegard'].holds, undefined);
    run.to(93);
    assert.equal(run.table['grain-dear@Valegard'], undefined);
});

test('test 29: world cap 4 and multi-realm slots — X in A and B counts once; V in C is blocked by the world cap; a fifth set-in-motion fires over it', () => {
    const realms = [{ name: 'A', regions: ['ra'] }, { name: 'B', regions: ['rb'] }, { name: 'C', regions: ['rc'] }];
    const places = [{ name: 'pa', region: 'ra', kind: 'town' }, { name: 'pb', region: 'rb', kind: 'town' }, { name: 'pc', region: 'rc', kind: 'town' }];
    const now = (id, where, extra = {}) => ev(id, { certainty: 'set-in-motion', where, window: { after: 'start', within: '1 day' }, ...extra });
    const w = world({ realms, places, events: [
        now('x', ['A', 'B']), now('y', ['A'], { window: { after: 'start', within: '50 days' } }), now('z', ['B'], { window: { after: 'start', within: '50 days' } }), now('w', ['C'], { window: { after: 'start', within: '50 days' } }),
        ev('v', { where: ['C'], window: { after: 'start', within: '80 days' } }),
        now('fifth', ['C'], { window: { after: 'start', within: '60 days' } }),
    ] });
    const run = runner(w, { draw: drawWith({ hits: { v: [55] } }) }).to(55);
    assert.deepEqual(run.row('x').realms, ['A', 'B']);
    assert.deepEqual(active(run), ['w', 'x', 'y', 'z'], 'the world holds 4 (x counted once)');
    assert.ok(run.log('cap', 'v').some(entry => entry.day === 55 && /world/.test(entry.why)));
    run.to(60);
    assert.equal(active(run).length, 5, 'the fifth set-in-motion fires over the caps');
});

test('a route condition set by an event is kept under the store\'s route name ("From-To"), as world lines and the World note read it', () => {
    const w = world({ routes: [{ from: 'Oakhollow', to: 'Town', kind: 'road', km: 20 }], conditions: [...world().conditions, { name: 'roads-closed', scope: 'route', fades: 'until cleared' }], events: [
        ev('landslide', { certainty: 'set-in-motion', where: ['Valegard'], window: { after: 'start', within: '1 day' }, ends_when: 'instant', effects: { set: ['roads-closed@Oakhollow-Town: 5 days'] } }),
    ] });
    const run = runner(w).to(1);
    assert.deepEqual(Object.keys(run.table), ['roads-closed@Oakhollow-Town']);
    assert.equal(run.table['roads-closed@Oakhollow-Town'].scope, 'route');
});
