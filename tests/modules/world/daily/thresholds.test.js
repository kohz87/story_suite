// World events daily step: thresholds on powers and scores (spec v0.13 ruling 18; acceptance tests 76, 77, 78 and the step's
// side of 79). Checked on the day's value, not latched; an unreadable threshold leaves the event out with a warning.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readDefs } from '../../../../modules/world/daily/defs.js';
import { drawWith, runner, states, world } from './helpers.js';

const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'likely', where: ['Highmark Empire'], ends_when: { for: '10 days' }, summary: id, ...extra });
const VEIL = 'power:ashen-veil';
const w76 = (events, extra = {}) => world({
    powers: [{ id: 'ashen-veil', name: 'Ashen Veil', start: 20 }, { name: 'Crown', start: 0 }],
    scores: [{ id: 'north-readiness', name: 'North Readiness', start: 0, range: [0, 100] }],
    conditions: [...world().conditions, { name: 'veil-ascendant', scope: 'realm', fades: 'until cleared' }],
    events, ...extra,
});
const war = extra => ev('war-of-faiths', { chance: '50% over the window', requires: ['power:ashen-veil >= 40'], window: { after: 'start', within: '120 days' }, ...extra });
/** Step day by day, setting the Veil before the days in `values` ({ day: value }) as a deed would. */
function veilRun(w, { values = {}, draw = () => 0, end, id = 'war-of-faiths' }) {
    return states(w, id, { end, draw, before: (run, day) => { if (run.state && day in values) run.state.standings[VEIL] = values[day]; } });
}

test('test 76: below 40 the event is Dormant and does not roll; the day the value is 40 it is Eligible and rolls (and fires)', () => {
    const w = w76([war()]);
    const seen = veilRun(w, { values: { 4: 40 }, end: 4 });
    assert.deepEqual([seen[1], seen[2], seen[3]], ['dormant', 'dormant', 'dormant']);
    assert.equal(seen[4], 'active', 'at exactly 40 it rolls (the seeded draw hits) and fires');
    const run = runner(w, { draw: () => 0 }).to(3);
    assert.deepEqual(run.log('roll', 'war-of-faiths'), [], 'no roll while Dormant');
});

test('test 76: score >= and power <= behave the same; the value equal to N satisfies both; requires_any takes a threshold as its only true path', () => {
    const w = w76([
        ev('ready', { severity: 'minor', requires: ['score:north-readiness >= 0'], window: { after: 'start', within: '5 days' } }),
        ev('weak', { severity: 'minor', requires: ['power:ashen-veil <= 20'], window: { after: 'start', within: '5 days' } }),
        ev('either', { severity: 'minor', requires_any: ['fired:nothing', 'power:ashen-veil >= 20'], window: { after: 'start', within: '5 days' } }),
        ev('neither', { severity: 'minor', requires: ['power:ashen-veil >= 21'], window: { after: 'start', within: '5 days' } }),
    ]);
    const run = runner(w, { draw: () => 0 }).to(1);
    assert.deepEqual(['ready', 'weak', 'either', 'neither'].map(id => run.row(id).state), ['active', 'active', 'active', 'dormant']);
});

test('test 76 (same day): an effect earlier in the day\'s order counts: a set-in-motion rally to 40 lets the war roll that day', () => {
    const rally = ev('rally', { severity: 'minor', certainty: 'set-in-motion', window: { after: 'start', within: '1 day' }, ends_when: 'instant', effects: { powers: { 'ashen-veil': 20 } } });
    const run = runner(w76([rally, war()]), { draw: () => 0 }).to(1);
    assert.equal(run.state.standings[VEIL], 40);
    assert.equal(run.row('war-of-faiths').state, 'active', 'read on the value as the step holds it when the war is checked');
    const byName = runner(w76([{ ...rally, effects: { powers: { 'Ashen Veil': 20 } } }, war()]), { draw: () => 0 }).to(1);
    assert.equal(byName.state.standings[VEIL], 40, 'an effect may name a unique display name; the id is what is kept');
});

test('test 77: not latched — 40 on day 10, 35 on day 11 → Dormant with no roll; 40 again on day 15 → Eligible again', () => {
    const w = w76([war()]);
    const draw = drawWith({ hits: { 'war-of-faiths': [] } });
    const seen = veilRun(w, { values: { 10: 40, 11: 35, 15: 40 }, draw, end: 16 });
    assert.equal(seen[10], 'eligible');
    assert.deepEqual([11, 12, 13, 14].map(day => seen[day]), ['dormant', 'dormant', 'dormant', 'dormant']);
    assert.deepEqual([seen[15], seen[16]], ['eligible', 'eligible']);
    const run = runner(w, { draw });
    for (let day = 1; day <= 16; day += 1) { if (run.state && day in { 10: 1, 15: 1 }) run.state.standings[VEIL] = 40; if (run.state && day === 11) run.state.standings[VEIL] = 35; run.to(day); }
    assert.deepEqual(run.log('roll', 'war-of-faiths').map(entry => entry.day), [10, 15, 16], 'rolled only on the days the threshold held');
});

test('test 77: false on the last window day → Lapsed the day after; a set-in-motion event Lapses with a warning instead of firing', () => {
    const w = w76([war({ window: { after: 'start', within: '5 days' } }), war({ id: 'muster', certainty: 'set-in-motion', window: { after: 'start', within: '5 days' } })]);
    const run = runner(w, { draw: drawWith() });
    for (let day = 1; day <= 6; day += 1) { if (run.state) run.state.standings[VEIL] = day === 3 ? 40 : 20; run.to(day); }
    assert.deepEqual([run.row('war-of-faiths').state, run.row('war-of-faiths').closed], ['lapsed', 6]);
    assert.equal(run.row('muster').state, 'lapsed');
    assert.ok(run.warnings.some(text => /set-in-motion event "muster" lapsed/.test(text)));
});

test('test 77: an outcome that sets a condition while the value is 40 keeps it after the fall-back; an event requiring the condition stays eligible', () => {
    const ascend = ev('ascend', { certainty: 'set-in-motion', requires: ['power:ashen-veil >= 40'], window: { after: 'start', within: '30 days' }, ends_when: 'instant', outcomes: [{ name: 'rise', weight: 1, effects: { set: ['veil-ascendant@Highmark Empire: until cleared'] } }] });
    const later = ev('veil-war', { requires: ['veil-ascendant@Highmark Empire'], window: { after: 'start', within: '30 days' } });
    const draw = drawWith({ hits: { ascend: [2] } });
    const seen = veilRun(w76([ascend, later]), { values: { 2: 40, 3: 10 }, draw, end: 6, id: 'veil-war' });
    assert.deepEqual([seen[1], seen[3], seen[6]], ['dormant', 'eligible', 'eligible'], 'the condition is remembered; the threshold is not');
});

test('test 78: ends_when any_of power <= 10 ends the Active event the first day it holds; a later rise does not revive it', () => {
    const w = w76([war({ certainty: 'set-in-motion', requires: [], window: { after: 'start', within: '1 day' }, ends_when: { for: '60 days', any_of: ['power:ashen-veil <= 10'] } })]);
    const seen = veilRun(w, { values: { 5: 10, 7: 50 }, end: 8 });
    assert.deepEqual([seen[1], seen[4], seen[5], seen[8]], ['active', 'active', 'ended', 'ended']);
    const full = veilRun(w, { values: {}, end: 61 });
    assert.deepEqual([full[60], full[61]], ['active', 'ended'], 'else on day 60 of Active (fired day 1)');
});

test('test 79 (the step\'s side): a threshold it cannot read leaves the event out with a warning; a valid one is read', () => {
    const base = { powers: [{ id: 'ashen-veil', name: 'Ashen Veil', start: 20 }], scores: [{ id: 'north-readiness', name: 'North Readiness', start: 0, range: [0, 100] }] };
    const bad = {
        unknown: { requires: ['power:old-crown >= 10'] }, name: { requires: ['power:Ashen Veil >= 40'] }, gt: { requires: ['power:ashen-veil>40'] },
        eq: { requires_any: ['power:ashen-veil = 40'] }, frac: { requires: ['power:ashen-veil >= 40.5'] }, high: { requires: ['score:north-readiness >= 150'] },
        low: { ends_when: { any_of: ['score:north-readiness <= -5'] } }, likelier: { likelier_if: { 'power:ashen-veil >= 40': '×2' } }, pre: { pre_empted_by: ['power:ashen-veil >= 40'] },
    };
    const defs = readDefs({ ...base, events: [...Object.entries(bad).map(([id, extra]) => ev(id, extra)), ev('good', { requires: ['power:ashen-veil >= -100', 'score:north-readiness<=100'] })] });
    assert.deepEqual(defs.events.map(def => def.id), ['good'], 'spaces around the comparison are optional');
    assert.ok(defs.warnings.some(text => text.includes('"gt"') && /only >= and <= exist/.test(text)), 'a wrong operator is named as such');
    assert.equal(defs.warnings.length, Object.keys(bad).length);
    for (const id of Object.keys(bad)) assert.ok(defs.warnings.some(text => text.includes(`"${id}"`)), `${id} is named`);
});

test('test 77 over a skip: in one step of 9 days the Veil rises to 40 on day 2 and falls to 30 on day 5 → the war is not rolled after day 4 (no latch)', () => {
    const shift = (id, within, delta) => ev(id, { severity: 'minor', certainty: 'set-in-motion', window: { after: 'start', within }, ends_when: 'instant', effects: { powers: { 'ashen-veil': delta } } });
    const w = w76([shift('surge', '2 days', 20), shift('ebb', '5 days', -10), war()]);
    const run = runner(w, { draw: drawWith({ hits: { 'war-of-faiths': [8] } }) }).to(1).to(10, { jump: true });
    assert.deepEqual(run.reports.map(report => report.days), [1, 9], 'day 1, then one step of days 2-10');
    assert.deepEqual(run.log('roll', 'war-of-faiths').map(entry => entry.day), [2, 3, 4]);
    assert.equal(run.row('war-of-faiths').state, 'dormant', 'the day-8 hit is never rolled: the threshold fell back on day 5');
    assert.equal(run.state.standings[VEIL], 30);
});
