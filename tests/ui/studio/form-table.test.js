// The Studio's table editors (ST-FORM4, mock MK-7): the row table (typed cells, move, remove, add with a maximum, problems and fixes, Go to focus)
// and the grid (cell states, the open cell, the phone's column switch, the legend).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { rowTable, gridTable } from '../../../studio/form/table.js';

const MONTHS = [['January', 31, 'winter'], ['February', 28, 'winter'], ['March', 31, 'spring']];
const COLS = [{ key: 'name', label: 'Name', type: 'text' }, { key: 'days', label: 'Days', type: 'number', min: 1 }, { key: 'season', label: 'Season', type: 'tag', phone: false }];

function months(extra = {}) {
    installFakeDom();
    const got = [];
    const on = { change: (...args) => got.push(['change', ...args]), add: () => got.push(['add']), move: (...args) => got.push(['move', ...args]), remove: at => got.push(['remove', at]) };
    const rows = MONTHS.map(([name, days, season]) => ({ values: { name, days, season } }));
    const table = rowTable({ key: 'months', title: 'Months', noun: 'month', columns: COLS, rows, max: 60, addLabel: '+ Add a month', foot: '3 of 60 months · 90 days a year', ...extra }, on);
    return { table, got, rows: () => table.querySelectorAll('.st-trow') };
}

test('a row table draws a numbered row per record with its title, header, typed cells and foot', () => {
    const { table, rows } = months();
    assert.equal(table.querySelector('.gt').textContent, 'Months · 3');
    assert.deepEqual(table.querySelector('.st-thead').querySelectorAll('span').map(s => s.textContent), ['#', 'Name', 'Days', 'Season', '']);
    assert.equal(rows().length, 3);
    assert.deepEqual(rows().map(r => r.querySelector('.st-tn').textContent), ['1', '2', '3']);
    assert.equal(rows()[1].querySelector('[data-col="name"] input').value, 'February');
    assert.equal(rows()[1].querySelector('[data-col="days"] input').value, '28');
    assert.equal(rows()[1].querySelector('[data-col="season"] .tg2').textContent, 'winter');
    assert.equal(rows()[1].querySelector('[data-col="days"] .st-tlab').textContent, 'Days');
    assert.ok(rows()[1].querySelector('[data-col="season"]').classList.contains('st-nophone'));
    assert.match(table.style.getPropertyValue('--st-cols'), /^28px minmax\(0, 2fr\) minmax\(88px, 130px\) minmax\(0, 1fr\) minmax\(0, 144px\)$/);
    assert.equal(table.querySelector('.st-tcount').textContent, '3 of 60 months · 90 days a year');
});

test('a text cell and a number cell report a committed change; a blank number is null and a bad one is ignored', () => {
    const { got, rows } = months();
    const name = rows()[2].querySelector('[data-col="name"] input');
    name.value = 'Marchen'; name.dispatch('change');
    const days = rows()[2].querySelector('[data-col="days"] input');
    days.value = '30'; days.dispatch('change');
    days.value = ''; days.dispatch('change');
    days.value = 'many'; days.dispatch('change');
    assert.deepEqual(got, [['change', 2, 'name', 'Marchen'], ['change', 2, 'days', 30], ['change', 2, 'days', null]]);
});

test('move and remove name the row; the first cannot move up, the last cannot move down', () => {
    const { got, rows } = months();
    const first = rows()[0];
    assert.equal(first.querySelector('.st-up').hasAttribute('disabled'), true);
    assert.equal(first.querySelector('.st-down').getAttribute('aria-label'), 'Move January down');
    assert.equal(rows()[2].querySelector('.st-down').hasAttribute('disabled'), true);
    first.querySelector('.st-down').click();
    rows()[1].querySelector('.st-up').click();
    rows()[2].querySelector('.st-remove').click();
    assert.deepEqual(got, [['move', 0, 1], ['move', 1, -1], ['remove', 2]]);
});

test('add runs until the maximum; at the maximum it is off and the foot says how many', () => {
    const open = months();
    open.table.querySelector('.st-tadd').click();
    assert.deepEqual(open.got, [['add']]);
    const full = months({ max: 3, foot: undefined });
    assert.equal(full.table.querySelector('.st-tadd').hasAttribute('disabled'), true);
    full.table.querySelector('.st-tadd').click();
    assert.deepEqual(full.got, []);
    assert.equal(full.table.querySelector('.st-tcount').textContent, '3 of 3');
});

test('without move the rows have only remove (coins); an empty table says so and has no header', () => {
    installFakeDom();
    const coins = rowTable({ title: 'Coins', columns: [{ key: 'name', label: 'Coin', type: 'text' }, { key: 'worth', label: 'Worth', type: 'number', unit: 'copper' }], rows: [{ values: { name: 'silver', worth: 10 } }], move: false },
        { remove: () => {}, move: () => {} });
    assert.equal(coins.querySelector('.st-up'), null);
    assert.ok(coins.querySelector('.st-remove'));
    assert.equal(coins.querySelector('[data-col="worth"] .num span').textContent, 'copper');
    const none = rowTable({ title: 'Holidays', columns: COLS, rows: [], empty: 'No holidays.', addLabel: '+ Add a holiday' }, { add: () => {} });
    assert.equal(none.querySelector('.gt').textContent, 'Holidays · 0');
    assert.equal(none.querySelector('.st-thead'), null);
    assert.equal(none.querySelector('.st-tempty').textContent, 'No holidays.');
    assert.equal(none.querySelector('.st-tadd').textContent, '+ Add a holiday');
});

test('a chips cell adds on Enter without repeats and removes by chip, sending the whole list', () => {
    installFakeDom();
    const got = [];
    const table = rowTable({ title: 'Seasons', columns: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'months', label: 'Months', type: 'chips', placeholder: 'Add a month' }],
        rows: [{ values: { name: 'spring', months: ['March', 'April'] } }] }, { change: (...args) => got.push(args) });
    const add = table.querySelector('[data-col="months"] input.kadd');
    add.value = ' May '; add.dispatch('keydown', { key: 'Enter' });
    add.value = 'March'; add.dispatch('keydown', { key: 'Enter' });
    table.querySelector('button[aria-label="Remove April"]').click();
    assert.deepEqual(got, [[0, 'months', ['March', 'April', 'May']], [0, 'months', ['March']]]);
});

test('a select cell keeps a value not in its options, and a static cell shows text', () => {
    installFakeDom();
    const got = [];
    const table = rowTable({ columns: [{ key: 'month', label: 'Month', type: 'select', options: ['January', 'February'] }, { key: 'from', label: 'From', type: 'static' }],
        rows: [{ values: { month: 'Octobre', from: 30 } }] }, { change: (...args) => got.push(args) });
    const select = table.querySelector('select');
    assert.deepEqual(select.querySelectorAll('option').map(o => o.textContent), ['Octobre', 'January', 'February']);
    select.value = 'February'; select.dispatch('change');
    assert.deepEqual(got, [[0, 'month', 'February']]);
    assert.equal(table.querySelector('.st-tstatic').textContent, '30');
});

test('a row problem shows under the row with its fix; bad cells are marked; a Go to focus marks the control', () => {
    const fixed = [];
    const { rows } = months({ rows: [{ values: { name: 'Octobre', days: 31 }, bad: ['name'], problem: { text: '"Octobre" is not one of the calendar\'s months.', fix: { label: 'Use October', run: () => fixed.push(true) } } },
        { values: { name: 'May', days: 31 }, problem: { text: 'Two months share a name.', level: 'warning' } }], focus: { row: 1, col: 'days' } });
    const bad = rows()[0];
    assert.ok(bad.classList.contains('bad'));
    assert.match(bad.querySelector('.st-tprob').textContent, /^✕ "Octobre" is not one/);
    assert.equal(bad.querySelector('[data-col="name"] input').getAttribute('aria-invalid'), 'true');
    assert.ok(bad.querySelector('[data-col="name"]').classList.contains('bad'));
    bad.querySelector('.st-tfix').click();
    assert.deepEqual(fixed, [true]);
    assert.ok(rows()[1].querySelector('.st-tprob').classList.contains('warn'));
    assert.match(rows()[1].querySelector('.st-tprob').textContent, /^! Two months/);
    assert.ok(rows()[1].querySelector('[data-col="days"] input').classList.contains('st-at'));
    assert.equal(bad.querySelector('.st-at'), null);
});

const CLIMATES = [{ key: 'temperate', label: 'Temperate', sub: '9 regions' }, { key: 'cold', label: 'Cold', sub: '4 regions' }, { key: 'any', label: 'Any climate', muted: true }];
const SEASONS = [{ key: 'spring', label: 'Spring' }, { key: 'autumn', label: 'Autumn' }, { key: 'monsoon', label: 'Monsoon', warn: true }];
const CELL = (row, col) => (row === 'any' ? { state: 'off' } : row === 'temperate' && col !== 'monsoon' ? { text: 'Own · 5', state: 'own' } : row === 'temperate' ? { text: 'Own · 4', state: 'own', warn: true } : { text: 'Built-in', state: 'built' });

function weather(extra = {}) {
    installFakeDom();
    const got = [];
    const grid = gridTable({ key: 'weather', title: 'Climate × season', corner: 'Climate', columns: SEASONS, rows: CLIMATES, cell: CELL, open: { row: 'temperate', col: 'autumn' },
        legend: [{ state: 'own', text: 'Own: this pack\'s lines' }, { state: 'built', text: 'Built-in' }], ...extra }, { open: (...args) => got.push(['open', ...args]), column: key => got.push(['column', key]) });
    return { grid, got, cell: (row, col) => grid.querySelector(`.st-gcell[data-row="${row}"][data-col="${col}"]`) };
}

test('the grid draws a header, a labelled row per climate and a cell per season with its state, and the open cell pressed', () => {
    const { grid, cell } = weather();
    assert.deepEqual(grid.querySelector('.st-ghead').querySelectorAll('span').map(s => s.textContent), ['Climate', 'Spring', 'Autumn', 'Monsoon !']);
    assert.deepEqual(grid.querySelectorAll('.st-grow').map(r => r.querySelector('.st-glab b').textContent), ['Temperate', 'Cold', 'Any climate']);
    assert.ok(grid.querySelector('.st-grow[data-row="any"]').classList.contains('muted'));
    assert.ok(cell('temperate', 'spring').classList.contains('own'));
    assert.ok(cell('cold', 'spring').classList.contains('built'));
    assert.equal(cell('temperate', 'autumn').getAttribute('aria-pressed'), 'true');
    assert.equal(cell('temperate', 'spring').getAttribute('aria-pressed'), 'false');
    assert.ok(cell('temperate', 'monsoon').classList.contains('warn'));
    assert.match(cell('temperate', 'monsoon').textContent, /Own · 4 !/);
    assert.equal(cell('any', 'spring').hasAttribute('disabled'), true);
    assert.equal(cell('any', 'spring').getAttribute('aria-label'), 'Any climate · Spring: off');
    assert.equal(grid.style.getPropertyValue('--st-gcols'), '3');
    assert.equal(grid.querySelectorAll('.st-glegend .st-gkey.own').length, 1);
});

test('a cell opens with its row and column; an off cell does not', () => {
    const { got, cell } = weather();
    cell('cold', 'autumn').click();
    cell('any', 'autumn').click();
    assert.deepEqual(got, [['open', 'cold', 'autumn']]);
});

test('the phone shows one column: the open one at first, then the one the switch picks, which is reported', () => {
    const { grid, got, cell } = weather();
    const on = () => grid.querySelectorAll('.st-gcell.on').map(c => `${c.dataset.row}.${c.dataset.col}`);
    assert.deepEqual(on(), ['temperate.autumn', 'cold.autumn', 'any.autumn']);
    const pick = grid.querySelector('.st-gpick');
    assert.equal(pick.querySelectorAll('button').length, 3);
    pick.querySelectorAll('button')[0].click();
    assert.deepEqual(on(), ['temperate.spring', 'cold.spring', 'any.spring']);
    assert.deepEqual(got, [['column', 'spring']]);
    assert.ok(!cell('temperate', 'autumn').classList.contains('on'));
    const kept = weather({ column: 'monsoon' });
    assert.ok(kept.cell('cold', 'monsoon').classList.contains('on'));
    const first = weather({ open: null });
    assert.ok(first.cell('cold', 'spring').classList.contains('on'));
});
