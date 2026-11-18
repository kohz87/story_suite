// The game Weather editor (ST-GWEATHER): the style, the climate × season grid (own, built-in, any season, any climate), the open cell's lines,
// writing own lines from the built-in ones, a season the calendar lacks, two tables for one cell, the open world's regions, and a pack with no weather.
// Edited packs still pass the game's own pack checker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/game-weather.js';
import { openDoc } from '../../../studio/model/doc.js';
import { apply } from '../../../studio/model/edits.js';
import { validatePack } from '../../../packs/validate.js';
import { CLIMATE_TABLES, TEMPERATE } from '../../../modules/time/weather.js';

const GAME = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/game4-mini.json', import.meta.url), 'utf8'));
const W = ['content', 'weather'];
const SEASONS = [{ name: 'wet', months: ['Thaw', 'Bloom'] }, { name: 'dry', months: ['Harvest', 'Frost'] }];

function host(weather, opts = {}) {
    installFakeDom();
    const content = structuredClone(GAME.content);
    if (weather === undefined) delete content.weather; else content.weather = structuredClone(weather);
    if (opts.seasons) content.calendar = { ...content.calendar, seasons: structuredClone(opts.seasons) };
    const me = { doc: openDoc({ doc: { ...structuredClone(GAME), content } }), patches: [], kept: {} };
    me.ctx = () => ({ doc: me.doc, kind: 'game', legacy: false, other: opts.world ?? null, problems: [], focus: null, keep: id => (me.kept[id] ??= {}), go: () => {},
        commit: patches => { me.patches.push(patches); const result = apply(me.doc, patches); if (result.ok) me.doc = result.doc; return result; } });
    me.draw = () => (me.root = editSection({ key: 'weather', where: 'content', value: me.doc.doc.content.weather, count: 1 }, me.ctx())[0]);
    me.weather = () => me.doc.doc.content.weather;
    me.check = () => validatePack(me.doc.doc).errors ?? [];
    me.cell = (row, col) => me.root.querySelector(`.st-gcell[data-row="${row}"][data-col="${col}"]`);
    return me;
}
const edit = (input, value) => { input.value = value; input.dispatch('change'); };

test('the grid has every climate and "Any climate", the built-in seasons and "any season"; with no tables every cell reads the built-in lines', () => {
    const me = host({ style: 'climate' });
    const root = me.draw();
    assert.deepEqual(root.querySelectorAll('.st-grid .st-grow').map(row => row.dataset.row), ['temperate', 'cold', 'frozen', 'highland', 'arid', 'warm', 'tropical', 'coastal', 'sea', 'underground', '*']);
    assert.deepEqual(root.querySelectorAll('.st-ghead span').map(span => span.textContent), ['Climate', 'spring', 'summer', 'autumn', 'winter', 'any season']);
    assert.equal(me.cell('cold', 'autumn').textContent, 'Built-in');
    assert.equal(me.cell('underground', 'winter').textContent, 'Built-in · all year');
    assert.equal(me.cell('cold', '*').textContent, '—');
    assert.ok(root.querySelector('.st-grow[data-row="*"]').classList.contains('muted'));
    assert.match(root.querySelector('.st-grid .gt').textContent, /Climate × season · 0 own cells/);
});

test('the style is set by the segmented switch; "Own tables" brings the "Any climate" row in; the narrator style says the tables are not read', () => {
    const me = host({ style: 'climate', tables: [{ climate: 'cold', season: 'winter', weather: ['ice'] }] });
    me.draw().querySelector('.st-wstyle').querySelectorAll('button')[1].click();
    assert.deepEqual(me.patches.at(-1), [{ op: 'set', path: [...W, 'style'], value: 'tables' }]);
    assert.equal(me.draw().querySelector('.st-grow[data-row="*"]').classList.contains('muted'), false);
    me.draw().querySelector('.st-wstyle').querySelectorAll('button')[2].click();
    assert.match(me.draw().querySelector('.st-wstory').textContent, /kept but not read/);
    assert.deepEqual(me.check(), []);
});

test('opening a built-in cell shows the lines it reads; Write own lines copies them into a table for that climate and season', () => {
    const me = host({ style: 'climate' });
    me.draw();
    me.cell('cold', 'autumn').click();
    const open = me.root.querySelector('.st-wcell');
    assert.match(open.textContent, /Cold · autumn/);
    assert.deepEqual(open.querySelectorAll('.st-wbuilt li').map(li => li.textContent), [...CLIMATE_TABLES.cold.autumn]);
    open.querySelector('.st-wown').click();
    assert.deepEqual(me.patches.at(-1), [{ op: 'set', path: [...W, 'tables'], value: [{ climate: 'cold', season: 'autumn', weather: [...CLIMATE_TABLES.cold.autumn] }] }]);
    const root = me.draw();
    assert.equal(me.cell('cold', 'autumn').textContent, 'Own · 4');
    assert.match(root.querySelector('.st-grid .gt').textContent, /1 own cell/);
    assert.equal(root.querySelectorAll('.st-wcell .st-trow').length, 4);
    assert.match(root.querySelector('.st-wcell .st-tcount').textContent, /4 of 24 lines · at most 60 characters each/);
    assert.deepEqual(me.check(), []);
});

test('the open cell\'s lines: edit, blank removes a line, add, move, Use the built-in lines, and the last line out takes the table away', () => {
    const me = host({ style: 'climate', tables: [{ climate: 'temperate', season: 'autumn', weather: ['crisp', 'drizzle'] }] }, {});
    me.kept.weather = { open: { row: 'temperate', col: 'autumn' } };
    const lines = () => me.draw().querySelectorAll('.st-wcell .st-trow input');
    edit(lines()[0], ' crisp and clear ');
    assert.deepEqual(me.patches.at(-1), [{ op: 'set', path: [...W, 'tables', 0, 'weather', 0], value: 'crisp and clear' }]);
    me.root.querySelector('.st-wcell .st-tadd').click();
    assert.deepEqual(me.patches.at(-1), [{ op: 'insert', path: [...W, 'tables', 0, 'weather', 2], value: '' }]);
    const fresh = me.draw().querySelectorAll('.st-wcell .st-trow');
    assert.match(fresh[2].textContent, /can't be empty/);
    assert.ok(fresh[2].querySelector('input').classList.contains('st-at'));
    edit(fresh[2].querySelector('input'), '');
    assert.deepEqual(me.patches.at(-1), [{ op: 'remove', path: [...W, 'tables', 0, 'weather', 2] }]);
    me.draw().querySelector('.st-wcell button[aria-label="Move crisp and clear down"]').click();
    assert.deepEqual(me.weather().tables[0].weather, ['drizzle', 'crisp and clear']);
    me.draw().querySelector('.st-wbuiltin').click();
    assert.deepEqual(me.weather().tables[0].weather, [...TEMPERATE.autumn]);
    const single = host({ style: 'climate', tables: [{ climate: 'temperate', season: 'autumn', weather: ['crisp'] }] });
    single.kept.weather = { open: { row: 'temperate', col: 'autumn' } };
    single.draw().querySelector('.st-wcell button[aria-label="Remove crisp"]').click();
    assert.deepEqual(single.patches.at(-1), [{ op: 'remove', path: [...W, 'tables'] }]);
    assert.deepEqual(single.weather(), { style: 'climate' });
    assert.deepEqual(single.check(), []);
});

test('a climate\'s "any season" table covers its other seasons; an "Any climate" cell starts from the temperate lines', () => {
    const me = host({ style: 'tables', tables: [{ climate: 'arid', weather: ['dust', 'heat', 'wind'] }] });
    me.draw();
    assert.equal(me.cell('arid', '*').textContent, 'Own · 3');
    assert.equal(me.cell('arid', 'summer').textContent, 'Any season · 3');
    me.cell('*', 'spring').click();
    assert.match(me.root.querySelector('.st-wcell').textContent, /Any climate · spring.*Nothing is written for this cell/);
    me.root.querySelector('.st-wown').click();
    assert.deepEqual(me.patches.at(-1), [{ op: 'insert', path: [...W, 'tables', 1], value: { season: 'spring', weather: [...TEMPERATE.spring] } }]);
    assert.deepEqual(me.check(), []);
});

test('the calendar\'s own seasons are the columns; a table for a season it lacks gets a warned column and moves to a season', () => {
    const me = host({ style: 'climate', tables: [{ climate: 'temperate', season: 'monsoon', weather: ['rain'] }] }, { seasons: SEASONS });
    const root = me.draw();
    assert.deepEqual(root.querySelectorAll('.st-ghead span').map(span => span.textContent), ['Climate', 'wet', 'dry', 'any season', 'monsoon !']);
    assert.ok(me.cell('temperate', '?monsoon').classList.contains('warn'));
    const warn = root.querySelector('.st-wwarn');
    assert.match(warn.textContent, /Temperate · monsoon.*"monsoon" is not a season of this calendar, so this table is never read/);
    warn.querySelector('.st-wfix').click();
    const items = globalThis.document.querySelectorAll('.slist button');
    assert.deepEqual(items.map(item => item.dataset.id), ['wet', 'dry', '*']);
    items[0].click();
    assert.deepEqual(me.patches.at(-1), [{ op: 'set', path: [...W, 'tables', 0, 'season'], value: 'wet' }]);
    assert.equal(me.draw().querySelector('.st-wwarn'), null);
    assert.deepEqual(me.check(), []);
});

test('two tables for one cell: the cell and a warning say so; Show the second opens it and Remove it takes it out', () => {
    const me = host({ style: 'climate', tables: [{ climate: 'temperate', season: 'autumn', weather: ['a', 'b'] }, { climate: 'temperate', season: 'autumn', weather: ['c'] }] });
    const root = me.draw();
    assert.equal(me.cell('temperate', 'autumn').textContent, 'Own · 2 · 2 tables !');
    assert.match(root.querySelector('.st-wwarn').textContent, /Temperate · autumn has two tables.*Only the first is read: 2 lines\. The second has 1/);
    root.querySelectorAll('.st-wwarn .st-wfix')[0].click();
    assert.deepEqual(me.kept.weather.open, { row: 'temperate', col: 'autumn', at: 1 });
    assert.match(root.querySelector('.st-wcell .gt').textContent, /its second table/);
    assert.equal(root.querySelector('.st-wcell .st-trow input').value, 'c');
    root.querySelectorAll('.st-wwarn .st-wfix')[1].click();
    assert.deepEqual(me.patches.at(-1), [{ op: 'remove', path: [...W, 'tables', 1] }]);
    assert.equal(me.weather().tables.length, 1);
});

test('with a world open each climate counts its regions, and the open cell names one of them', () => {
    const world = { content: { regions: [{ id: 'fen', name: 'The Fen' }, { id: 'vale', name: 'The Vale', climate: 'temperate' }, { id: 'waste', name: 'The Waste', climate: 'arid' }] } };
    const me = host({ style: 'climate' }, { world });
    me.draw();
    assert.match(me.root.querySelector('.st-grow[data-row="temperate"] .st-glab').textContent, /2 regions · 1 with none/);
    assert.match(me.root.querySelector('.st-grow[data-row="arid"] .st-glab').textContent, /1 region$/);
    assert.match(me.root.querySelector('.st-grow[data-row="cold"] .st-glab').textContent, /no regions/);
    me.cell('temperate', 'spring').click();
    assert.match(me.root.querySelector('.st-wcell').textContent, /2 regions of the open world are temperate, The Fen among them/);
});

test('a pack with no weather offers to set it; a table naming an unknown climate is pointed to the JSON; the phone\'s column is kept', () => {
    const none = host(undefined);
    none.draw().querySelector('.st-wset').click();
    assert.deepEqual(none.patches.at(-1), [{ op: 'set', path: W, value: { style: 'climate' } }]);
    assert.deepEqual(none.check(), []);
    const odd = host({ style: 'climate', tables: [{ climate: 'swamp', weather: ['mire'] }] });
    assert.match(odd.draw().textContent, /names a climate the game does not know \("swamp"\)/);
    const phone = host({ style: 'climate' });
    phone.draw().querySelector('.st-gpick').querySelectorAll('button')[2].click();
    assert.equal(phone.kept.weather.column, 'autumn');
    assert.ok(phone.draw().querySelector('.st-gcell[data-row="cold"][data-col="autumn"]').classList.contains('on'));
});
