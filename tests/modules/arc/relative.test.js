// The arc plan reader's relative dates (modules/arc/plan/read-parts/relative.js): each form a planner writes, on a custom calendar, and the
// texts it leaves alone. The cases and dates are the ones the retired v1 planner's tests pinned (B4-11f).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCalendar } from '../../../modules/time/calendar.js';
import { resolveRelative } from '../../../modules/arc/plan/read-parts/relative.js';

const calendar = makeCalendar({
    preset: 'custom',
    era: 'CY',
    months: ['Dawnwane', 'Rainmoot', 'Greengale', 'Highsun', 'Goldwane', 'Haywane', 'Emberwane', 'Nightfall', 'Frostfall', 'Deepwinter', 'Icewane', 'Yearsend'],
    daysPerMonth: 30,
});
const now = calendar.parse('CY 611, Haywane 12, 05:35 pm').abs;
const at = text => resolveRelative(text, { calendar, now });

test('spans, day words and parts of the day become calendar dates; a day without a time stays a whole day', () => {
    assert.deepEqual(Object.fromEntries([
        'in 2 days', 'the day after tomorrow at noon', 'in 6 hours', 'tomorrow', '"in a week"', 'tonight', 'the next day, morning',
        'this evening', '3 days from now at dawn', 'tomorrow at dusk', 'next morning', 'in three days',
    ].map(text => [text, at(text)])), {
        'in 2 days': 'Haywane 14, 05:35 pm',
        'the day after tomorrow at noon': 'Haywane 14, 12:00 pm',
        'in 6 hours': 'Haywane 12, 11:35 pm',
        tomorrow: 'Haywane 13',
        '"in a week"': 'Haywane 19, 05:35 pm',
        tonight: 'Haywane 12, 10:00 pm',
        'the next day, morning': 'Haywane 13, 09:00 am',
        'this evening': 'Haywane 12, 07:00 pm',
        '3 days from now at dawn': 'Haywane 15, 06:00 am',
        'tomorrow at dusk': 'Haywane 13, 07:00 pm',
        'next morning': 'Haywane 13, 09:00 am',
        'in three days': 'Haywane 15, 05:35 pm',
    });
});

test('text that is not a relative date, or a time of day on a step shorter than a day, is no reading (null)', () => {
    assert.equal(at('when the bells ring'), null);
    assert.equal(at('in 2 hours at dusk'), null);
    assert.equal(at('Haywane 19'), null, 'an absolute date is the reader\'s, not this one\'s');
    assert.equal(at('tomorrow on the moon'), null);
});
