// The game Calendar editor (ST-GCAL, mock MK-7 "calendar"): the year rows, the months, seasons and holidays tables, a month's rename, move and
// removal carried through to the seasons and holidays, the confirms, the season month checks and the "Use …" fix, the fit with the open world,
// the checker's problems on their rows, and the read-only fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/game-calendar.js';

const read = name => JSON.parse(readFileSync(new URL(`../../packs/studio/fixtures/${name}`, import.meta.url), 'utf8'));
const GAME = read('game4-mini.json');
const WORLD = read('world4-mini.json');
const C = ['content', 'calendar'];

function setup(opts = {}) {
    installFakeDom();
    const pack = structuredClone(GAME);
    const cal = pack.content.calendar;
    cal.seasons = [{ name: 'spring', months: ['Thaw', 'Bloom'] }, { name: 'autumn', months: ['harvest', 4] }];
    cal.holidays = [{ name: 'Lamp Night', month: 'Harvest', day: 12 }, { name: 'First Frost', month: 4, day: 1 }];
    opts.edit?.(cal);
    const calls = [], went = [], keeps = {};
    const ctx = { doc: pack, kind: 'game', legacy: opts.legacy ?? false, other: opts.other ?? null, problems: opts.problems ?? [], focus: null,
        commit: patches => { calls.push(patches); return { ok: true }; }, go: (...args) => went.push(args), keep: id => (keeps[id] ??= {}) };
    if (opts.legacy) delete ctx.commit;
    const draw = () => { const root = document.createElement('div'); root.append(...editSection({ key: 'calendar', where: 'content', value: cal, count: cal.months.length }, ctx)); return root; };
    return { cal, calls, went, keeps, draw };
}
const table = (root, key) => root.querySelector(`.st-table[data-key="${key}"]`);
const cell = (root, key, row, col) => table(root, key).querySelector(`.st-trow[data-row="${row}"] [data-col="${col}"]`);
const type = (box, value) => { box.value = value; box.dispatch('change'); };

test('the year rows and the three tables draw the calendar, with each month\'s season and the year\'s length', () => {
    const { draw } = setup();
    const root = draw();
    assert.equal(root.querySelector('[data-key="era"] input').value, 'FY');
    assert.equal(table(root, 'months').querySelector('.gt').textContent, 'Months · 4');
    assert.equal(table(root, 'months').querySelector('.st-tcount').textContent, '4 of 60 months · 120 days a year');
    assert.deepEqual(table(root, 'months').querySelectorAll('[data-col="season"]').map(c => c.textContent.replace('Season', '')), ['spring', 'spring', 'autumn', 'autumn']);
    assert.equal(table(root, 'seasons').querySelector('.st-tcount').textContent, '2 of 12 seasons · every month is in one');
    assert.equal(cell(root, 'holidays', 1, 'month').querySelector('option[selected]').textContent, 'Frost', 'a holiday month given by number shows its name');
    assert.equal(root.querySelector('.st-fit'), null, 'no fit card without an open world');
});

test('era, leap years and the week: blank, off and empty take the field out', () => {
    const { calls, draw } = setup({ edit: cal => { cal.week = ['Moonday']; } });
    const root = draw();
    type(root.querySelector('[data-key="era"] input'), ' ');
    assert.deepEqual(calls.at(-1), [{ op: 'remove', path: [...C, 'era'] }]);
    type(root.querySelector('[data-key="era"] input'), 'CY');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: [...C, 'era'], value: 'CY' }]);
    root.querySelector('[data-key="leapYears"] .sw').click();
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: [...C, 'leapYears'], value: true }]);
    const add = root.querySelector('[data-key="week"] input');
    add.value = 'Sunday'; add.dispatch('change');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: [...C, 'week'], value: ['Moonday', 'Sunday'] }]);
    draw().querySelector('[data-key="week"] .kc button').click();
    assert.deepEqual(calls.at(-1), [{ op: 'remove', path: [...C, 'week'] }]);
});

test('renaming a month renames it in its season and holidays in the same edit; days, add and a blank name', () => {
    const { calls, draw, keeps } = setup();
    const root = draw();
    type(cell(root, 'months', 2, 'name').querySelector('input'), 'Reaping');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: [...C, 'months', 2, 'name'], value: 'Reaping' },
        { op: 'set', path: [...C, 'seasons'], value: [{ name: 'spring', months: ['Thaw', 'Bloom'] }, { name: 'autumn', months: ['Reaping', 4] }] },
        { op: 'set', path: [...C, 'holidays'], value: [{ name: 'Lamp Night', month: 'Reaping', day: 12 }, { name: 'First Frost', month: 4, day: 1 }] }]);
    assert.match(keeps.calendar.note, /in its season and holidays too/);
    type(cell(root, 'months', 0, 'days').querySelector('input'), '31');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: [...C, 'months', 0, 'days'], value: 31 }]);
    const before = calls.length;
    type(cell(root, 'months', 0, 'name').querySelector('input'), '  ');
    assert.equal(calls.length, before);
    table(root, 'months').querySelector('.st-tadd').click();
    assert.deepEqual(calls.at(-1), [{ op: 'insert', path: [...C, 'months', 4], value: { name: 'Month 5', days: 30 } }]);
});

test('moving a month keeps the seasons and holidays that name it by number on the same month', () => {
    const { calls, draw } = setup();
    table(draw(), 'months').querySelector('.st-trow[data-row="3"] .st-up').click();
    assert.deepEqual(calls.at(-1), [{ op: 'move', path: [...C, 'months', 3], to: 2 },
        { op: 'set', path: [...C, 'seasons'], value: [{ name: 'spring', months: ['Thaw', 'Bloom'] }, { name: 'autumn', months: ['harvest', 3] }] },
        { op: 'set', path: [...C, 'holidays'], value: [{ name: 'Lamp Night', month: 'Harvest', day: 12 }, { name: 'First Frost', month: 3, day: 1 }] }]);
});

test('removing a month nothing names is one edit; one a season and holiday name asks first, then takes it out of both', () => {
    const plain = setup({ edit: cal => { cal.months.push({ name: 'Spare', days: 5 }); } });
    table(plain.draw(), 'months').querySelector('.st-trow[data-row="4"] .st-remove').click();
    assert.deepEqual(plain.calls.at(-1), [{ op: 'remove', path: [...C, 'months', 4] }]);

    const { calls, went, draw } = setup({ other: (() => { const w = structuredClone(WORLD); w.content.start.date = { year: 611, month: 4, day: 1 }; return w; })() });
    table(draw(), 'months').querySelector('.st-trow[data-row="2"] .st-remove').click();
    assert.equal(calls.length, 0);
    assert.deepEqual(went.at(-1), ['calendar']);
    const root = draw();
    assert.match(root.querySelector('.st-cconfirm').textContent, /Remove Harvest\?.*Autumn names it, so it is taken out of autumn too\. The holiday Lamp Night goes with it\..*starts in month 4/);
    root.querySelector('.st-cremove').click();
    assert.deepEqual(calls.at(-1), [{ op: 'remove', path: [...C, 'months', 2] },
        { op: 'set', path: [...C, 'seasons'], value: [{ name: 'spring', months: ['Thaw', 'Bloom'] }, { name: 'autumn', months: [3] }] },
        { op: 'set', path: [...C, 'holidays'], value: [{ name: 'First Frost', month: 3, day: 1 }] }]);
});

test('a season takes a month as the calendar spells it, once; an unknown or taken month is refused in words', () => {
    const { calls, draw, keeps } = setup({ edit: cal => { cal.seasons[0].months = ['Thaw']; } });
    const root = draw();
    const add = cell(root, 'seasons', 0, 'months').querySelector('input.kadd');
    add.value = 'bloom'; add.dispatch('change');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: [...C, 'seasons', 0, 'months'], value: ['Thaw', 'Bloom'] }]);
    const count = calls.length;
    add.value = 'Frost'; add.dispatch('change');
    assert.equal(calls.length, count);
    assert.match(keeps.calendar.note, /Frost is in autumn: take it out there first/);
    add.value = 'Blom'; add.dispatch('change');
    assert.match(keeps.calendar.note, /"Blom" is not one of the calendar's months\. Did you mean Bloom\?/);
    assert.equal(calls.length, count);
});

test('a season month from the file that is not a month says so on its row, with the near month to use', () => {
    const { calls, draw } = setup({ edit: cal => { cal.seasons[1].months = ['Harvst', 4]; } });
    const row = table(draw(), 'seasons').querySelector('.st-trow[data-row="1"]');
    assert.match(row.querySelector('.st-tprob').textContent, /"Harvst" is not one of the calendar's months/);
    row.querySelector('.st-tfix').click();
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: [...C, 'seasons', 1, 'months'], value: ['Harvest', 4] }]);
});

test('removing the last season asks first, then takes the seasons out; adding one starts with a month in no season', () => {
    const { calls, draw } = setup({ edit: cal => { cal.seasons = [{ name: 'spring', months: ['Thaw'] }]; } });
    let root = draw();
    assert.match(table(root, 'seasons').querySelector('.st-tcount').textContent, /3 months in no season: Bloom, Harvest and Frost/);
    table(root, 'seasons').querySelector('.st-tadd').click();
    assert.deepEqual(calls.at(-1), [{ op: 'insert', path: [...C, 'seasons', 1], value: { name: 'season 2', months: ['Bloom'] } }]);
    table(root, 'seasons').querySelector('.st-remove').click();
    root = draw();
    assert.match(root.querySelector('.st-cconfirm').textContent, /Remove the last season\?.*spring, summer, autumn and winter/);
    root.querySelector('.st-cremove').click();
    assert.deepEqual(calls.at(-1), [{ op: 'remove', path: [...C, 'seasons'] }]);
});

test('holidays: a month picked by name, a day, add, and removing the last takes the key out; none says what a holiday is', () => {
    const { calls, draw } = setup();
    const root = draw();
    const month = cell(root, 'holidays', 0, 'month').querySelector('select');
    month.value = 'Thaw'; month.dispatch('change');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: [...C, 'holidays', 0, 'month'], value: 'Thaw' }]);
    type(cell(root, 'holidays', 0, 'day').querySelector('input'), '3');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: [...C, 'holidays', 0, 'day'], value: 3 }]);
    const none = setup({ edit: cal => { delete cal.holidays; } });
    const empty = table(none.draw(), 'holidays');
    assert.match(empty.textContent, /No holidays\. A holiday is a named day that comes back every year\./);
    empty.querySelector('.st-tadd').click();
    assert.deepEqual(none.calls.at(-1), [{ op: 'set', path: [...C, 'holidays'], value: [{ name: 'New holiday', month: 'Thaw', day: 1 }] }]);
    const one = setup({ edit: cal => { cal.holidays = [cal.holidays[0]]; } });
    table(one.draw(), 'holidays').querySelector('.st-remove').click();
    assert.deepEqual(one.calls.at(-1), [{ op: 'remove', path: [...C, 'holidays'] }]);
});

test('with a world open: the calendar fits its start date, or says what does not fit, with a way to Pairing', () => {
    const world = structuredClone(WORLD);
    world.content.start.date = { year: 611, month: 2, day: 1 };
    const fits = setup({ other: world });
    const card = fits.draw().querySelector('.st-fit');
    assert.equal(card.dataset.fit, 'yes');
    assert.match(card.textContent, /Fits the open world\..*starts on day 1 of month 2, Bloom, 611 FY/);
    card.querySelector('.st-pairing').click();
    assert.deepEqual(fits.went.at(-1), ['pairing']);
    const far = structuredClone(world);
    far.content.start.date.month = 9;
    const misfit = setup({ other: far }).draw().querySelector('.st-fit');
    assert.equal(misfit.dataset.fit, 'no');
    assert.match(misfit.textContent, /1 thing in .* does not fit this calendar.*has 4 months, not 9/);
});

test('the checker\'s problems show on their rows, and a format 3 pack draws the read-only card', () => {
    const { draw } = setup({ problems: [{ code: 'BAD_CALENDAR', path: 'content.calendar.months[1]', message: 'two months are called "Thaw".' },
        { code: 'BAD_CALENDAR', path: 'content.calendar.holidays[0].day', message: 'day must be a whole number from 1 to 30.' },
        { code: 'BAD_CALENDAR', path: 'content.calendar.era', message: 'era must be text of at most 24 characters.' }] });
    const root = draw();
    assert.match(table(root, 'months').querySelector('.st-trow[data-row="1"] .st-tprob').textContent, /two months are called/);
    assert.match(table(root, 'holidays').querySelector('.st-trow[data-row="0"] .st-tprob').textContent, /1 to 30/);
    assert.match(root.querySelector('[data-key="era"] .st-problem').textContent, /at most 24/);
    const legacy = setup({ legacy: true }).draw();
    assert.equal(legacy.querySelector('.st-table'), null);
    assert.ok(legacy.querySelector('.st-rec, .sgrp'));
});
