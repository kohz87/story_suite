// A lead's "lapses" date tells no year while the story clock began at the calendar's default start (SOAK2UI 15).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCalendar, PRESETS } from '../../../../modules/time/calendar.js';
import { lapseOf } from '../../../../modules/world/world/elsewhere-parts/lapse-date.js';
import { leadsOf } from '../../../../modules/world/world/elsewhere-parts/leads.js';

const calendar = makeCalendar(PRESETS.gregorian);
const now = calendar.toAbs({ year: 1, month: 0, day: 1, minutes: 480 });
const hook = { id: 'h1', kind: 'hook', status: 'active', key: 'Herb run', summary: 'wanted', offer: false, fields: { giver: 'Hobb', reward: '4 silver', due: 'January 5' }, track: { created: { time: now } } };

test('a default-start clock gives the lapse date without the year; a dated clock keeps it', () => {
    assert.equal(lapseOf(hook, { calendar, now }).lapses, 'January 5, 1');
    assert.equal(lapseOf(hook, { calendar, now, fromDefault: true }).lapses, 'January 5');
});

test('the Leads rows read fromDefault from the director clock', () => {
    const state = { domains: { director: { threads: { h1: hook } } } };
    const tools = fromDefault => ({ query: name => (name === 'director.time' ? { minutes: now, ...(fromDefault ? { fromDefault: true } : {}) } : name === 'director.calendar' ? PRESETS.gregorian : undefined) });
    assert.equal(leadsOf(state, tools(true))[0].lapses, 'January 5');
    assert.equal(leadsOf(state, tools(false))[0].lapses, 'January 5, 1');
});
