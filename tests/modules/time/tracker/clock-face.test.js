// The clockFace rule (batch 1, B1.1): `~ time 4:45 pm` is the clock now, today; nothing moves back; `! time` skips forward only.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRESETS, makeCalendar } from '../../../../modules/time/calendar.js';
import { clockFaceAfter, skipTarget } from '../../../../modules/time/tracker/time-parts/clock-face.js';
import { timeAfter } from '../../../../modules/time/tracker/time.js';
import { lastProblems, makeState, reply } from './helpers/fake-ctx.js';

const gregorian = makeCalendar(PRESETS.gregorian);
const at = text => gregorian.parse(text).abs;
const DAY = 1440;
const line = (op, name) => ({ op, kind: 'time', name, text: '' });
const NOW = at('March 3, 2026, 04:50 pm');
const read = (op, name, now = NOW, options) => clockFaceAfter(line(op, name), now, gregorian, options);
const marked = { carrier: { rules: ['clockFace'] } };
const start = (options = {}) => reply(makeState(), '~ time March 3, 2026, 04:50 pm', options).state;
const clock = state => state.domains.director.time.minutes;

test('a clock face at or after now is set today; the same time again changes nothing', () => {
    assert.equal(read('~', '5:30 pm').minutes, NOW + 40);
    assert.equal(read('~', '4:50 pm').minutes, NOW);
    assert.equal(read('+', 'evening').minutes, at('March 3, 2026, 07:00 pm'));
    assert.equal(read('~', '5:30 pm').set, true);
});

test('a clock face before now is a refusal that names the story time and the way to write a new day', () => {
    const result = read('~', '4:45 pm');
    assert.equal(result.minutes, undefined);
    assert.match(result.error, /^"~ time 4:45 pm" is earlier than the story time \(.*4:50 pm\); the clock never goes back\. If a new day has begun, write "! time 4:45 pm"\.$/);
});

test('a date before now is refused; a date at or after now is accepted as a set', () => {
    assert.match(read('~', 'March 3, 2026, 01:00 pm').error, /names a date before the story time/);
    assert.equal(read('~', 'March 3, 2026, 09:00 pm').minutes, at('March 3, 2026, 09:00 pm'));
    assert.equal(read('!', 'March 5, 2026, 09:00 am').minutes, at('March 5, 2026, 09:00 am'));
});

test('"!" with a clock face is the next occurrence strictly after now', () => {
    assert.equal(read('!', '9 pm').minutes, at('March 3, 2026, 09:00 pm'));
    assert.equal(read('!', '4:45 am').minutes, at('March 4, 2026, 04:45 am'));
    assert.equal(read('!', '4:50 pm').minutes, NOW + DAY);
});

test('skips: tomorrow, next day, next morning, tomorrow evening land on the next calendar day', () => {
    assert.equal(read('!', 'tomorrow').minutes, at('March 4, 2026, 09:00 am'));
    assert.equal(read('!', 'next day').minutes, at('March 4, 2026, 09:00 am'));
    assert.equal(read('!', 'next morning').minutes, at('March 4, 2026, 09:00 am'));
    assert.equal(read('!', 'tomorrow evening').minutes, at('March 4, 2026, 07:00 pm'));
    assert.equal(read('!', 'tomorrow at 8 am').minutes, at('March 4, 2026, 08:00 am'));
    // Early morning: still the next calendar day, never the same one.
    assert.equal(read('!', 'next morning', at('March 3, 2026, 03:00 am')).minutes, at('March 4, 2026, 09:00 am'));
    assert.equal(skipTarget('March 5', NOW, gregorian), null);
    assert.equal(skipTarget('9 pm', NOW, gregorian), null);
});

test('durations, a clock that is not set yet and the other operations read as before', () => {
    assert.deepEqual(read('!', '2h'), timeAfter(line('!', '2h'), NOW, gregorian, {}));
    assert.equal(read('!', '2 hours').minutes, NOW + 120);
    assert.match(read('-', '5 pm').error, /only moves forward/);
    assert.deepEqual(clockFaceAfter(line('~', 'March 3, 2026, 01:00 pm'), null, gregorian), timeAfter(line('~', 'March 3, 2026, 01:00 pm'), null, gregorian));
    assert.match(read('~', '25:99 pm').error, /not a clock time/);
});

test('maxJump holds for a skip and a set', () => {
    const held = read('!', 'tomorrow evening', NOW, { maxJump: 60 });
    assert.equal(held.minutes, NOW + 60);
    assert.ok(held.problem);
});

test('a calendar with custom months: tomorrow at the end of a month is the next month\'s first day', () => {
    const custom = makeCalendar({ preset: 'custom', era: 'CY', leapYears: false, months: [{ name: 'Ember', days: 30 }, { name: 'Frost', days: 30 }] });
    const base = custom.parse('CY 600, Ember 30, 12:00 pm').abs;
    const next = clockFaceAfter(line('!', 'tomorrow evening'), base, custom, {});
    assert.equal(custom.format(next.minutes).includes('Frost 1'), true, custom.format(next.minutes));
});

test('a marked reply uses the rules; an unmarked one keeps its old reading (a bare earlier clock is the next day)', () => {
    const live = reply(start(marked), '~ time 5:30 pm', marked);
    assert.equal(clock(live.state), NOW + 40);
    const back = reply(start(marked), '~ time 4:45 pm', marked);
    assert.equal(clock(back.state), NOW, 'the clock stays');
    assert.ok(lastProblems(back.state).some(problem => problem.kind === 'time' && /never goes back/.test(problem.text)));
    const old = reply(start(), '~ time 4:45 pm');
    assert.equal(clock(old.state), NOW - 5 + DAY, 'no mark: the next day, as before');
    const dated = reply(start(), '~ time March 3, 2026, 01:00 pm');
    assert.equal(clock(dated.state), at('March 3, 2026, 01:00 pm'), 'no mark: the clock goes back, as before');
});
