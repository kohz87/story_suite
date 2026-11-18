// Pack format 4, W1: the step reads seasons through the chat's calendar (the game's own seasons), and an event whose date or season the calendar lacks is
// Lapsed at load with one warning. Replay: the same stored state and calendar give the same result (swipe, rewind, reload, edited Re-read all re-run the step).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRESETS, makeCalendar } from '../../../../modules/time/calendar.js';
import { makeStepCalendar } from '../../../../modules/world/daily/cal.js';
import { runDays } from '../../../../modules/world/daily/step.js';
import { readWorld } from '../../../../modules/world/chronicle/world-daily/read-world.js';
import { drawWith, runner, world } from './helpers.js';

const cal = makeCalendar(PRESETS.gregorian);
const D = (year, month, day) => cal.dayIndex(cal.toAbs({ year, month: month - 1, day }));
const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'likely', where: ['Highmark Empire'], ends_when: 'instant', summary: id, ...extra });
// A game whose winter is January to March, not the built-in December to February.
const LATE_WINTER = [{ name: 'winter', months: ['January', 'February', 'March'] }, { name: 'spring', months: ['April', 'May', 'June'] }, { name: 'summer', months: ['July', 'August', 'September'] }, { name: 'autumn', months: ['October', 'November', 'December'] }];

test('W1: the game\'s seasons set the season of a day; with none the year splits into the built-in quarters', () => {
    const own = makeStepCalendar(null, LATE_WINTER);
    const built = makeStepCalendar(null, null);
    assert.equal(own.seasonOf(D(611, 3, 10)), 'winter');
    assert.equal(built.seasonOf(D(611, 3, 10)), 'spring');
    assert.equal(own.seasonOf(D(611, 12, 20)), 'autumn');
    assert.equal(built.seasonOf(D(611, 12, 20)), 'winter');
    assert.equal(own.hasSeason('Winter'), true);
    assert.equal(makeStepCalendar(null, [{ name: 'dry', months: ['January'] }]).hasSeason('winter'), false, 'a game\'s own names replace the quarter names');
});

test('W1: seasons naming a month the calendar lacks fall back to the quarters (a reader\'s own calendar over the game\'s)', () => {
    const odd = makeStepCalendar(PRESETS.custom30, [{ name: 'winter', months: ['Nonesuch'] }]);
    assert.equal(odd.hasSeason('summer'), true);
    assert.equal(odd.hasSeason('winter'), true);
});

test('W1: a winter event fires in the game\'s winter (March), not the built-in one', () => {
    const w = world({ events: [ev('frost', { requires: ['winter'], certainty: 'set-in-motion', window: { within: '40 days' } })], seasons: LATE_WINTER });
    const run = runner(w, { start: D(611, 3, 10), draw: drawWith() }).to(D(611, 3, 12));
    assert.ok(run.log('roll', 'frost').length > 0 || run.row('frost').state === 'active', 'March is winter in this game: the event is rolled');
    const built = runner(world({ events: [ev('frost', { requires: ['winter'], certainty: 'set-in-motion', window: { within: '40 days' } })] }), { start: D(611, 3, 10) }).to(D(611, 3, 12));
    assert.equal(built.log('roll', 'frost').length + (built.row('frost').state === 'active' ? 1 : 0), 0, 'March is spring on the built-in split');
});

test('W1: a date that is not on the calendar Lapses the event at load, with one warning; a template with one is left out', () => {
    const w = world({
        events: [ev('doomsday', { on: 'date:612-13-01', certainty: 'set-in-motion' }), ev('later', { requires: ['fired:doomsday'] }), ev('fine', { on: 'date:612-07-30', certainty: 'set-in-motion' })],
        templates: [{ template: 'fair', scope: 'place', needs: ['date:612-02-31'] }],
    });
    const run = runner(w, { start: D(612, 7, 1) }).to(D(612, 7, 3));
    assert.equal(run.row('doomsday').state, 'lapsed');
    assert.equal(run.row('later').state, 'lapsed', 'what waits on it follows');
    assert.equal(run.row('fine').state, 'dormant');
    assert.equal(run.warnings.filter(text => text.includes('"doomsday"')).length, 1, 'one Problems line, not one per step');
    assert.ok(run.warnings.some(text => text.includes('template "fair"')));
    assert.ok(!run.warnings.some(text => text.includes('"fine"')));
});

test('W1: a season the calendar lacks Lapses the event at load', () => {
    const w = world({ events: [ev('frost', { requires: ['winter'] })], seasons: [{ name: 'dry', months: ['January', 'February', 'March', 'April', 'May', 'June'] }, { name: 'wet', months: ['July', 'August', 'September', 'October', 'November', 'December'] }] });
    const run = runner(w, { start: D(611, 3, 10) }).to(D(611, 3, 11));
    assert.equal(run.row('frost').state, 'lapsed');
});

test('W1: replay: a step run again from the same stored state and calendar gives the same state and report', () => {
    const w = world({ events: [ev('doomsday', { on: 'date:612-13-01', certainty: 'set-in-motion' }), ev('frost', { requires: ['winter'], certainty: 'set-in-motion', window: { within: '40 days' } })], seasons: LATE_WINTER });
    const first = runner(w, { start: D(611, 3, 10) }).to(D(611, 3, 10));
    const args = { state: first.state, table: first.table, world: w, today: D(611, 3, 14), seed: 'test', draw: drawWith() };
    const a = runDays(args), b = runDays({ ...args, state: structuredClone(args.state), table: structuredClone(args.table) });
    assert.deepEqual(a, b);
    // A swipe or a rewind to before the lapse: the first step again from nothing lapses the same event, no second warning on the one after.
    const again = runner(w, { start: D(611, 3, 10) }).to(D(611, 3, 12));
    assert.deepEqual(again.state.events.doomsday, first.state.events.doomsday);
    assert.equal(again.warnings.filter(text => text.includes('"doomsday"')).length, 1);
});

test('W1: readWorld takes the seasons from the chat\'s frame, else the selected game\'s, else none', () => {
    const query = (frame, live) => (name) => (name === 'packs.frame' ? frame : name === 'packs.calendar' ? live : []);
    const months = [{ name: 'January', days: 31 }];
    const framed = readWorld(query({ set: true, game: { pack: 'g' }, calendar: { months, seasons: LATE_WINTER } }, { pack: 'other', months, seasons: [{ name: 'x', months: ['January'] }] }));
    assert.deepEqual(framed.seasons, LATE_WINTER, 'a swapped game does not move the chat\'s seasons');
    assert.deepEqual(readWorld(query(null, { pack: 'g', months, seasons: LATE_WINTER })).seasons, LATE_WINTER);
    assert.equal(readWorld(query({ set: true, game: 'built-in', calendar: null }, { pack: 'g', months, seasons: LATE_WINTER })).seasons, null);
});
