// WEFIX1, the daily step and the calendar: season anchors (E5), fixed dates and `on` (E6), anchors made later the same day (E10, ruling 51),
// a "100% per season" event on a seeded day (E11, ruling 27) and a per-season chance over the calendar season (E14, ruling 50).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRESETS, makeCalendar } from '../../../../modules/time/calendar.js';
import { makeStepCalendar } from '../../../../modules/world/daily/cal.js';
import { seededDraw } from '../../../../modules/world/daily/chance.js';
import { runner, world } from './helpers.js';

const cal = makeCalendar(PRESETS.gregorian);
/** The clock day of a Gregorian date (month 1-12). */
const D = (year, month, day) => cal.dayIndex(cal.toAbs({ year, month: month - 1, day }));
const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'likely', where: ['Highmark Empire'], ends_when: 'instant', summary: id, ...extra });
const harvest = extra => ev('harvest', { kind: 'recurring', where: { kinds: ['town'] }, severity: 'minor', requires: ['autumn'], chance: '40% per season', ...extra });
const rolls = run => run.log('roll', 'harvest');

test('E5: a season anchor holds only while the calendar is in that season (no roll in summer, rolls in autumn)', () => {
    const run = runner(world({ events: [harvest()] }), { start: D(611, 8, 28) }).to(D(611, 9, 4));
    assert.deepEqual(rolls(run).map(entry => entry.day), [D(611, 9, 1), D(611, 9, 2), D(611, 9, 3), D(611, 9, 4)]);
    assert.equal(run.row('harvest').state, 'eligible');
});

test('E5: a season anchor in a custom calendar follows that calendar (12 months of 30 days: autumn is months 9-11)', () => {
    const calendar = PRESETS.custom30;
    const c = makeCalendar(calendar);
    const day = (month, d) => c.dayIndex(c.toAbs({ year: 5, month: month - 1, day: d }));
    const run = runner(world({ events: [harvest()] }), { start: day(8, 29), calendar }).to(day(9, 2));
    assert.deepEqual(rolls(run).map(entry => entry.day), [day(9, 1), day(9, 2)]);
});

test('E6: on "date:612-07-30" fires on that day only, also when a skip crosses it, and not on the first day', () => {
    const date = D(612, 7, 30);
    const w = world({ events: [ev('deadlock', { certainty: 'set-in-motion', on: 'date:612-07-30', effects: { set: ['regent-named@Highmark Empire: until cleared'] } })] });
    const live = runner(w, { start: date - 3 }).to(date + 1);
    assert.equal(live.row('deadlock').fired, date);
    assert.equal(live.row('deadlock').state, 'ended');
    const skipped = runner(w, { start: date - 3 }).to(date - 3).to(date + 1, { jump: true });
    assert.equal(skipped.row('deadlock').fired, date, 'a skip is stepped day by day');
    const tempo = runner(w, { start: date - 3, tempo: 4 }).to(date + 1);
    assert.equal(tempo.row('deadlock').fired, date, 'a fixed date is a calendar day: tempo does not stretch it');
});

test('E6: a date: anchor reads in requires, by name or number, in any calendar', () => {
    const date = D(612, 7, 30);
    for (const anchor of ['date:612-07-30', 'date:612-July-30']) {
        const run = runner(world({ events: [ev('after', { requires: [anchor], window: { after: 'start', within: '20 days' }, chance: '100% over the window' })] }), { start: date - 2, draw: () => 0 }).to(date + 1);
        assert.equal(run.row('after').fired, date, anchor);
    }
});

test('E10 / ruling 51: a set-in-motion event on a 1-day window after an event processed later the same day fires that day', () => {
    const w = world({ events: [
        ev('first', { certainty: 'set-in-motion', window: { after: 'start', within: '3 days' } }),
        ev('echo', { certainty: 'set-in-motion', window: { after: 'fired:first', within: '1 day' } }),
    ] });
    const run = runner(w, { draw: () => 0 }).to(5);
    assert.equal(run.row('first').fired, 1);
    assert.equal(run.row('echo').fired, 1, 'the same day, though one-offs are processed in id order and echo comes first');
    assert.equal(run.row('echo').state, 'ended');
});

test('E10: a chain of three same-day anchors resolves in one day, and at tempo 0.25 a 3-day window (scaled to 1 day) still fires', () => {
    const w = world({ events: [
        ev('a', { certainty: 'set-in-motion', window: { after: 'start', within: '1 day' } }),
        ev('b', { certainty: 'set-in-motion', window: { after: 'fired:c', within: '3 days' } }),
        ev('c', { certainty: 'set-in-motion', window: { after: 'fired:a', within: '1 day' } }),
    ] });
    const run = runner(w, { tempo: 0.25, draw: () => 0 }).to(3);
    assert.deepEqual(['a', 'c', 'b'].map(id => run.row(id).fired), [1, 1, 1]);
});

test('E11 / ruling 27: "100% per season" fires once per winter, on a seeded day inside it, not on the first eligible day', () => {
    const w = world({ events: [harvest({ id: 'blizzard', requires: ['winter'], chance: '100% per season' })] });
    const start = D(611, 11, 28);
    const run = runner(w, { start, draw: (day, key) => (key === 'blizzard#day' ? 0.5 : 0.999) }).to(D(612, 3, 5));
    const fired = run.journal().filter(entry => entry.fired).map(entry => entry.day);
    assert.equal(fired.length, 1, 'once for the winter');
    const winter = makeStepCalendar(null).stretch(D(611, 12, 15));
    assert.equal(fired[0], winter.start + Math.floor(0.5 * winter.length), 'on the seeded day');
    assert.notEqual(fired[0], winter.start);
});

test('E11: the seeded day is seeded (the same campaign gives the same day, another seed another)', () => {
    const w = world({ events: [harvest({ id: 'blizzard', requires: ['winter'], chance: '100% per season' })] });
    const days = seed => runner(w, { start: D(611, 11, 28), draw: (day, key) => seededDraw(seed, day, key) }).to(D(612, 3, 5)).journal().filter(entry => entry.fired).map(entry => entry.day);
    assert.deepEqual(days('one'), days('one'));
    assert.ok(new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(seed => days(seed)[0])).size > 1, 'several seeds do not all pick the same day');
});

test('E14 / ruling 50: a season-limited chance is spread over the calendar season, so tempo does not change its yearly odds', () => {
    const w = world({ events: [harvest()] });
    const p = tempo => runner(w, { start: D(611, 9, 1), tempo }).to(D(611, 9, 1)).log('roll', 'harvest')[0].p;
    const autumn = makeStepCalendar(null).stretch(D(611, 9, 1)).length;
    const expected = Number((1 - (1 - 0.4) ** (1 / autumn)).toFixed(6));
    assert.equal(p(1), expected);
    assert.equal(p(2), expected, 'the same at tempo 2 (it was spread over 180 days)');
    assert.equal(p(0.5), expected);
});

test('E5: a window that opens after a season opens when the season begins', () => {
    const winter = makeStepCalendar(null).stretch(D(611, 12, 15));
    const w = world({ events: [ev('thaw-watch', { certainty: 'set-in-motion', window: { after: 'winter', within: '1 day' } })] });
    const run = runner(w, { start: winter.start - 2 }).to(winter.start + 1);
    assert.equal(run.row('thaw-watch').fired, winter.start);
});
