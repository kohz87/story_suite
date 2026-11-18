// Pack format 4 game calendar: holidays (names flattened and cut, month by name or number) and their rejections, the packs.calendar query, and a refused pack saving nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPacksPart } from '../../packs/index.js';
import { validatePack } from '../../packs/validate.js';
import { fakeSettings } from './helpers/fake-settings.js';

const CALENDAR = { era: 'CY', months: [{ name: 'Dawnwane', days: 30 }, { name: 'Rainmoot', days: 30 }, { name: 'Goldwane', days: 30 }] };
const game = (calendar, id = 'ersveil') => ({ id, format: 4, kind: 'game', version: '1.0.0', requires: { suite: '^0.1' }, content: { calendar } });
const ok = input => { const result = validatePack(JSON.parse(JSON.stringify(input))); assert.equal(result.ok, true, JSON.stringify(result.errors)); return result.pack; };
const refused = (input, path) => {
    const result = validatePack(JSON.parse(JSON.stringify(input)));
    assert.equal(result.ok, false, `expected a refusal at ${path}`);
    assert.ok(result.errors.some(error => error.code === 'BAD_CALENDAR' && error.path === path), JSON.stringify(result.errors));
};

test('packs.calendar: the first enabled pack with a calendar, a copy; null with none', async () => {
    const { part, packs } = createPacksPart({ settings: fakeSettings() });
    assert.equal(part.queries['packs.calendar'](), null);
    await packs.install(game(CALENDAR));
    const first = part.queries['packs.calendar']();
    assert.deepEqual(first, { pack: 'ersveil', ...CALENDAR });
    first.months[0].days = 1;
    assert.equal(part.queries['packs.calendar']().months[0].days, 30, 'a fresh copy every time');
    await packs.setEnabled('ersveil', false);
    assert.equal(part.queries['packs.calendar'](), null, 'a switched-off pack gives no calendar');
});

test('calendar rejections: a bad month list is a Problem with its path', () => {
    refused(game([]), 'content.calendar');
    refused(game({ ...CALENDAR, months: [] }), 'content.calendar.months');
    refused(game({ ...CALENDAR, era: 'x'.repeat(25) }), 'content.calendar.era');
    refused(game({ ...CALENDAR, months: [{ name: 'Dawnwane', days: 0 }] }), 'content.calendar.months[0]');
    refused(game({ ...CALENDAR, months: [{ name: 'Dawnwane', days: 30 }, { name: 'DAWNWANE', days: 30 }] }), 'content.calendar.months[1]');
});

test('calendar holidays: named yearly days, month by name or number kept as the name, names flattened and cut', async () => {
    const holidays = [
        { name: '  Lantern\n Night ', month: 'goldwane', day: 2 },
        { name: 'First​ Light', month: 1, day: 1 },
        { name: 'x'.repeat(80), month: 'Rainmoot', day: 30 },
    ];
    const out = ok(game({ ...CALENDAR, holidays })).calendar;
    assert.deepEqual(out.holidays, [
        { name: 'Lantern Night', month: 'Goldwane', day: 2 },
        { name: 'First Light', month: 'Dawnwane', day: 1 },
        { name: 'x'.repeat(60), month: 'Rainmoot', day: 30 },
    ]);
    assert.equal(Object.hasOwn(ok(game(CALENDAR)).calendar, 'holidays'), false);
    assert.equal(Object.hasOwn(ok(game({ ...CALENDAR, holidays: [] })).calendar, 'holidays'), false);
    const sixty = Array.from({ length: 60 }, (_, i) => ({ name: `Day ${i}`, month: 1 + (i % 3), day: 1 + (i % 30) }));
    assert.equal(ok(game({ ...CALENDAR, holidays: sixty })).calendar.holidays.length, 60);
    const { part, packs } = createPacksPart({ settings: fakeSettings() });
    await packs.install(game({ ...CALENDAR, holidays }));
    assert.deepEqual(part.queries['packs.calendar']().holidays.map(day => [day.name, day.month, day.day]), [['Lantern Night', 'Goldwane', 2], ['First Light', 'Dawnwane', 1], ['x'.repeat(60), 'Rainmoot', 30]]);
});

test('calendar holiday rejections', () => {
    const calendar = holidays => game({ ...CALENDAR, holidays });
    const one = extra => calendar([{ name: 'Lantern Night', month: 'Goldwane', day: 2, ...extra }]);
    refused(calendar({}), 'content.calendar.holidays');
    refused(calendar(Array.from({ length: 61 }, (_, i) => ({ name: `Day ${i}`, month: 1, day: 1 }))), 'content.calendar.holidays');
    refused(calendar(['Lantern Night']), 'content.calendar.holidays[0]');
    refused(one({ year: 611 }), 'content.calendar.holidays[0]');
    refused(one({ name: '' }), 'content.calendar.holidays[0].name');
    refused(one({ name: 7 }), 'content.calendar.holidays[0].name');
    refused(one({ month: 'Highsun' }), 'content.calendar.holidays[0].month');
    refused(one({ month: 4 }), 'content.calendar.holidays[0].month');
    refused(one({ month: 0 }), 'content.calendar.holidays[0].month');
    refused(one({ day: 31 }), 'content.calendar.holidays[0].day');
    refused(one({ day: 0 }), 'content.calendar.holidays[0].day');
    refused(one({ day: 2.5 }), 'content.calendar.holidays[0].day');
});

test('a refused pack saves nothing', async () => {
    const settings = fakeSettings();
    const { packs } = createPacksPart({ settings });
    const result = await packs.install(game({ ...CALENDAR, holidays: [{ name: 'X', month: 1, day: 99 }] }));
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'BAD_CALENDAR');
    assert.equal(settings.saves, 0);
    assert.deepEqual(settings.root.packs ?? [], []);
});
