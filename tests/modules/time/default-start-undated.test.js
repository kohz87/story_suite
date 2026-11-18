// A clock that began at the calendar's default start has no date to tell yet: the receipt, director.time and the card show the time alone; a real date shows in full.
import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarOf } from '../../../modules/time/tracker/time.js';
import { clockWords } from '../../../modules/time/tracker/time-parts/default-start.js';
import { selectCard } from '../../../ui/select/card.js';

const calendar = calendarOf({}, null);
const minute = calendar.toAbs({ year: 1, month: 0, day: 1, minutes: 15 * 60 });

test('clockWords drops the date only while the clock began at the default start', () => {
  assert.match(clockWords(calendar, minute, false), /January 1, 1/);
  const alone = clockWords(calendar, minute, true);
  assert.ok(!/January|, 1/.test(alone), alone);
  assert.match(alone, /^0?3:00 pm$/i);
});

test('the card shows the time alone for an undated clock, and the date for a dated one', () => {
  const time = fromDefault => ({ minutes: minute, text: calendar.format(minute), weekday: 'Monday', ...(fromDefault ? { fromDefault: true } : {}) });
  const scene = fromDefault => selectCard({ 'director.time': time(fromDefault) }, {})?.scene;
  const dated = scene(false), undated = scene(true);
  assert.ok(dated.date && dated.weekday);
  assert.equal(undated.date, '');
  assert.equal(undated.weekday, null);
  assert.match(undated.time, /3:00 pm/i);
});
