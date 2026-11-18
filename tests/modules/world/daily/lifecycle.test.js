// World events daily step: lifecycle, chances and rolls (acceptance tests 1, 2, 3, 4, 9, 17, 27, 28, 38, 39, 40).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dailyChance } from '../../../../modules/world/daily/chance.js';
import { runDays } from '../../../../modules/world/daily/step.js';
import { drawWith, runner, states, world } from './helpers.js';

const close = (actual, expected, digits = 6) => assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${actual} ≈ ${expected}`);
const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'likely', where: ['Highmark Empire'], ends_when: { for: '10 days' }, summary: id, ...extra });
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test('test 1: set-in-motion hazard: seeded to miss days 1-9 → Eligible 1-9, Active exactly on day 10 (d = 1 → 1)', () => {
    const w = world({ events: [ev('march', { certainty: 'set-in-motion', window: { after: 'start', within: '10 days' } })] });
    const seen = states(w, 'march', { end: 10 });
    for (const day of range(1, 9)) assert.equal(seen[day], 'eligible', `day ${day}`);
    assert.equal(seen[10], 'active');
    const rolls = runner(w).to(10).log('roll', 'march');
    close(rolls[0].p, 1 - (1 - 1 / 10));
    close(rolls[8].p, 1 - (1 - 1 / 2));
});

test('test 2: ×0 — the likely is not rolled ("blocked (×0)") and Lapses on day 6; the set-in-motion fires on its deadline day 5', () => {
    const less = { less_if: { 'truce@Highmark Empire': '×0' } };
    const w = world({ events: [
        ev('likely-one', { chance: '70% over the window', window: { after: 'start', within: '5 days' }, ...less }),
        ev('certain-one', { certainty: 'set-in-motion', window: { after: 'start', within: '5 days' }, ...less }),
    ] });
    const run = runner(w, { draw: () => 0 }).set('truce', 'Highmark Empire', 1);
    run.to(4);
    assert.equal(run.row('certain-one').state, 'eligible', 'cannot fire before the deadline even with draws of 0');
    run.to(6);
    assert.ok(run.log('roll', 'likely-one').every(entry => entry.result === 'blocked (×0)'));
    assert.equal(run.log('roll', 'likely-one').length, 5);
    assert.equal(run.row('likely-one').state, 'lapsed');
    assert.equal(run.row('likely-one').closed, 6);
    assert.equal(run.row('certain-one').fired, 5);
});

test('test 3: requires lost and regained: Eligible 1-2, Dormant 3-5, Eligible 6-7, Lapsed on day 8, and stays Lapsed', () => {
    const w = world({ events: [ev('crisis', { requires: ['crown-contested@Highmark Empire'], window: { after: 'start', within: '7 days' } })] });
    const before = (run, day) => {
        if (day === 1 || day === 6 || day === 10) run.set('crown-contested', 'Highmark Empire', day);
        if (day === 3) run.clear('crown-contested', 'Highmark Empire');
    };
    const seen = states(w, 'crisis', { end: 11, before });
    assert.deepEqual(range(1, 8).map(day => seen[day]), ['eligible', 'eligible', 'dormant', 'dormant', 'dormant', 'eligible', 'eligible', 'lapsed']);
    assert.equal(seen[11], 'lapsed', 'a Lapsed one-off stays Lapsed after a re-set');
});

test('test 4: chain cascade — stage 1 lapses (window 1..5) → stages 2 and 3, whose only path it was, go on day 6', () => {
    const w = world({ events: [
        ev('stage-one', { window: { after: 'start', within: '5 days' } }),
        ev('stage-two', { kind: 'chain-stage', requires: ['stage:stage-one'], window: { after: 'fired:stage-one', within: '10 days' } }),
        ev('stage-three', { kind: 'chain-stage', certainty: 'set-in-motion', requires: ['stage:stage-two'], window: { after: 'fired:stage-two', within: '10 days' } }),
    ] });
    const run = runner(w).to(6);
    assert.deepEqual(['stage-one', 'stage-two', 'stage-three'].map(id => [run.row(id).state, run.row(id).closed]), [['lapsed', 6], ['lapsed', 6], ['lapsed', 6]]);
});

test('test 9: swipes — the same campaign seed, day and event id give the same roll and outcome', () => {
    const w = world({ events: [ev('omen', { chance: '50% over the window', window: { after: 'start', within: '20 days' }, outcomes: [{ name: 'good', weight: 1 }, { name: 'bad', weight: 1 }] })] });
    const at = seed => {
        let state = runDays({ world: w, today: 1, seed }).daily;
        state = runDays({ state, world: w, today: 4, seed }).daily;
        const one = runDays({ state, world: w, today: 5, seed });
        const two = runDays({ state, world: w, today: 5, seed });
        assert.deepEqual(one, two, 'two swipes of the reply that crosses into day 5');
        return one;
    };
    const runs = ['alpha', 'beta', 'gamma', 'delta'].map(at);
    assert.ok(new Set(runs.map(out => JSON.stringify(out.report.log))).size > 1, 'another campaign seed rolls differently');
});

test('test 17: requires_any does not cascade while a path remains; with every path gone the stage is Replaced that day', () => {
    const chain = [
        ev('succession-crisis', { window: { after: 'start', within: '40 days' }, ends_when: { for: '200 days' } }),
        ev('diet', { kind: 'chain-stage', requires: ['stage:succession-crisis'], window: { after: 'fired:succession-crisis', within: '5 days' } }),
        ev('coronation', { kind: 'chain-stage', certainty: 'set-in-motion', requires: ['crown-contested@Highmark Empire'], requires_any: ['stage:diet', 'fired:succession-crisis + 90 days'], window: { after: 'fired:succession-crisis', within: '150 days' } }),
    ];
    const run = runner(world({ events: chain }), { draw: drawWith({ hits: { 'succession-crisis': [1] } }) }).set('crown-contested', 'Highmark Empire', 1);
    run.to(7);
    assert.equal(run.row('diet').state, 'lapsed');
    assert.equal(run.row('coronation').state, 'dormant', 'not Replaced or Lapsed: the 90-day path remains (it waits for it)');
    run.to(91);
    assert.equal(run.row('coronation').state, 'eligible', 'the 90-day path holds from day 91');
    run.to(150);
    assert.equal(run.row('coronation').fired, 150, 'fires via the 90-day path (by its deadline)');
    const gone = runner(world({ events: [{ ...chain[0], pre_empted_by: ['fact:abdication'] }, chain[1], chain[2]] }));
    gone.to(1);
    gone.state.anchors['fact:abdication'] = [2];
    gone.to(2);
    assert.equal(gone.row('succession-crisis').state, 'replaced');
    assert.deepEqual([gone.row('diet').state, gone.row('coronation').state], ['replaced', 'replaced'], 'every path gone → Replaced that day');
    assert.equal(gone.row('coronation').closed, 2);
});

test('test 27: set-in-motion hazard modifiers on day 1 of a 10-day window: m = 1, 2, 0.5', () => {
    const def = { certainty: 'set-in-motion' };
    close(dailyChance(def, { left: 10, m: 1 }).p, 0.1);
    close(dailyChance(def, { left: 10, m: 2 }).p, 0.19);
    close(dailyChance(def, { left: 10, m: 0.5 }).p, 0.051317, 6);
    for (const m of [0, 0.5, 1, 2]) assert.equal(dailyChance(def, { left: 1, m }).p, 1, `d = 1 with m = ${m}`);
});

test('test 28: pre-emption of set-in-motion — coronation fires on day 4 → Replaced on day 4, never fires, terminal', () => {
    const w = world({ events: [
        ev('coronation', { certainty: 'set-in-motion', window: { after: 'start', within: '4 days' }, ends_when: 'instant' }),
        ev('regency', { certainty: 'set-in-motion', window: { after: 'start', within: '10 days' }, pre_empted_by: ['fired:coronation'], requires: ['crown-contested@Highmark Empire'] }),
    ] });
    const run = runner(w).set('crown-contested', 'Highmark Empire', 1).to(12);
    assert.equal(run.row('coronation').fired, 4);
    assert.deepEqual([run.row('regency').state, run.row('regency').closed, run.row('regency').fired], ['replaced', 4, undefined]);
});

test('test 38: odds modifiers act on the daily chance — 30% per season → 0.3955%; ×2 → 0.7879% (≈ 50.9% over a season); ×2 × ×1.5 → m = 3; ×0 → 0', () => {
    const def = { certainty: 'possible', chance: { percent: 30, per: 'season' } };
    close(dailyChance(def, { days: 90, m: 1 }).p, 1 - 0.7 ** (1 / 90));
    close(dailyChance(def, { days: 90, m: 1 }).p, 0.003955, 6);
    const doubled = dailyChance(def, { days: 90, m: 2 }).p;
    close(doubled, 0.007879, 6);
    close(1 - (1 - doubled) ** 90, 0.509, 3);
    const p = dailyChance(def, { days: 90, m: 1 }).p;
    close(dailyChance(def, { days: 90, m: 3 }).p, (p / (1 - p) * 3) / (1 + p / (1 - p) * 3));
    assert.deepEqual(dailyChance(def, { days: 90, m: 0 }), { p: 0, blocked: true });
    const w = world({ events: [ev('famine', { kind: 'recurring', certainty: 'possible', chance: '30% per season', cooldown: '1 season per place', where: 'where conditions fit', requires: ['harvest-failed@region'], likelier_if: { 'at-war@realm': '×2', 'truce@realm': '×1.5' } })] });
    const run = runner(w).set('harvest-failed', 'Lowfen', 1, 'region').set('at-war', 'River Realm', 1).set('truce', 'River Realm', 1).to(1);
    close(run.log('roll', 'famine')[0].p, dailyChance(def, { days: 90, m: 3 }).p, 6);
});

test('test 39: hard requirements beat the deadline — Lapsed (day 6) with a warning; its set-in-motion successor lapses too', () => {
    const w = world({ events: [
        ev('rising', { certainty: 'set-in-motion', requires: ['crown-contested@Highmark Empire'], window: { after: 'start', within: '5 days' } }),
        ev('aftermath', { kind: 'chain-stage', certainty: 'set-in-motion', requires: ['stage:rising'], window: { after: 'fired:rising', within: '5 days' } }),
    ] });
    const run = runner(w).to(6);
    assert.deepEqual([run.row('rising').state, run.row('rising').closed], ['lapsed', 6]);
    assert.equal(run.row('aftermath').state, 'lapsed');
    assert.ok(run.warnings.some(text => /rising.*lapsed/.test(text)));
});

test('test 40: terminal states and anchor_mode — each re-opens a recurring event and a not-yet-open window, never a lapsed stage', () => {
    const w = world({ events: [
        ev('stage-a', { kind: 'chain-stage', requires: ['stage:omen'], anchor_mode: 'each', window: { after: 'set:unrest', within: '2 days' } }),
        ev('omen', { certainty: 'set-in-motion', window: { after: 'start', within: '1 day' }, ends_when: 'instant' }),
        ev('later', { anchor_mode: 'each', window: { after: 'set:peace + 5 days', within: '3 days' } }),
    ] });
    const run = runner(w);
    run.set('unrest', 'Town', 1, 'place').set('peace', 'Town', 1, 'place').to(1);
    run.to(4);
    assert.equal(run.row('stage-a').state, 'lapsed');
    run.set('peace', 'Oakhollow', 4, 'place').set('unrest', 'Oakhollow', 4, 'place').to(6);
    assert.equal(run.row('stage-a').state, 'lapsed', 'a lapsed chain stage is not re-opened by its anchor again');
    assert.equal(run.row('later').start, 9, 'a window not yet open follows the latest occurrence (day 4 + 5)');
    const recurring = world({ events: [ev('raids', { kind: 'recurring', certainty: 'likely', cooldown: '3 days per place', where: ['Oakhollow'], ends_when: 'instant', severity: 'minor' })] });
    const again = runner(recurring, { draw: () => 0 }).to(8);
    assert.deepEqual(again.journal().filter(entry => entry.fired).map(entry => entry.day), [1, 4, 7], 'fires once per occurrence, again after the cooldown');
    close(again.log('roll', 'raids')[0].p, 1 - 0.3 ** (1 / 90), 5);
});
