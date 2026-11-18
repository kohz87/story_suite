// The Dry run page beyond the run itself (MK-5, STFC): the form's New seed and day chips, a run held while the pack has an error, the folded
// summary with its tiles, the tabs, the kind filters with quiet-day separators, and the seasons written as month numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { renderPage } from '../../../studio/views/timeline.js';
import { seasonsOf } from '../../../studio/dryrun/seasons.js';

const WORLD = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));
let made = 0;
function setup(extra = {}) {
    installFakeDom();
    globalThis.Worker = undefined;
    const world = structuredClone(WORLD);
    world.id = `form-${made += 1}`;
    const calls = [];
    const ctx = { doc: world, kind: 'world', other: null, problems: [], check: { errors: [], warnings: [] }, go: (...args) => { calls.push(args); if (args[0] === 'timeline') draw(); }, ...extra };
    const draw = () => { const page = document.createElement('div'); page.append(...renderPage(ctx)); document.body.replaceChildren(page); return page; };
    return { ctx, calls, draw };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 5));

test('the form: New seed, the 30 days / 1 year / 3 years chips and a wide Run N days button', () => {
    const { draw } = setup();
    const page = draw();
    const before = page.querySelector('[data-key="seed"] input').value;
    page.querySelector('.st-dry-newseed').click();
    const after = document.body.querySelector('[data-key="seed"] input').value;
    assert.notEqual(after, before);
    assert.match(after, /^\d{4}$/);
    document.body.querySelector('.st-dchip[data-days="1095"]').click();
    assert.equal(document.body.querySelector('[data-key="days"] input').value, '1095');
    assert.equal(document.body.querySelector('.st-dchip[data-days="1095"]').getAttribute('aria-pressed'), 'true');
    assert.equal(document.body.querySelector('.st-dry-run').textContent, 'Run 1,095 days');
    assert.ok(document.body.querySelector('.st-dry-date'));
});

test('an error in the pack holds Run and says to fix it first, with Go to the first; warnings do not', () => {
    const errors = [{ part: 'cast', rec: 'cast.2', field: 'name', message: 'x' }, { part: 'lore', rec: 'lore.0', message: 'y' }];
    const { draw, calls } = setup({ check: { errors, warnings: [] } });
    const page = draw();
    assert.notEqual(page.querySelector('.st-dry-run').getAttribute('disabled'), null);
    assert.match(page.querySelector('.st-dry-blocked').textContent, /Fix the 2 problems first\./);
    page.querySelector('.st-dry-first').click();
    assert.deepEqual(calls.at(-1), ['cast', 'cast.2', 'name']);
    const warned = setup({ check: { errors: [], warnings: [{ message: 'w' }] } }).draw();
    assert.equal(warned.querySelector('.st-dry-run').getAttribute('disabled'), null);
    assert.equal(warned.querySelector('.st-dry-blocked'), null);
});

test('after a run: the form folds to the summary with Change and Run again; tiles; tabs; quiet days between day cards', async () => {
    const { draw } = setup();
    draw().querySelector('.st-dry-run').click();
    await settle();
    const body = document.body;
    assert.equal(body.querySelector('.st-dry-form'), null);
    assert.ok(body.querySelector('.st-dry-change') && body.querySelector('.st-dry-again'));
    assert.equal(body.querySelectorAll('.st-tile').length, 6);
    assert.deepEqual(body.querySelectorAll('.st-dtab').map(tab => tab.textContent), ['Timeline', 'Holds', 'Curves', 'Cast']);
    assert.ok(body.querySelector('.st-quiet') || body.querySelectorAll('.st-day').length <= 1);
    body.querySelector('.st-dry-change').click();
    assert.ok(document.body.querySelector('.st-dry-form'));
    document.body.querySelector('.st-dtab[data-tab="holds"]').click();
    assert.ok(document.body.querySelector('.st-dry-holds'));
});

test('the dry run reads seasons written with month numbers as the chat does', () => {
    const calendar = { months: [{ name: 'Frost', days: 30 }, { name: 'Thaw', days: 30 }, { name: 'Bloom', days: 30 }], seasons: [{ name: 'Winter', months: [1, 2] }, { name: 'Spring', months: ['Bloom'] }] };
    assert.deepEqual(seasonsOf(calendar).map(season => season.months), [['Frost', 'Thaw'], ['Bloom']]);
    assert.equal(seasonsOf({ months: calendar.months }), null);
});

test('after a run, an error in the pack holds Run again and opens the form with its fix-first note; Start › opens the world Start', async () => {
    const { ctx, draw, calls } = setup();
    draw().querySelector('.st-dry-run').click();
    await settle();
    assert.equal(document.body.querySelector('.st-dry-again').getAttribute('disabled'), null);
    ctx.check = { errors: [{ part: 'map', rec: 'places.0', field: ['region'], message: 'x' }], warnings: [] };
    const page = draw();
    assert.notEqual(page.querySelector('.st-dry-again').getAttribute('disabled'), null, 'Run again is held');
    assert.match(page.querySelector('.st-dry-blocked').textContent, /Fix the 1 problem first\./);
    const runs = calls.length;
    page.querySelector('.st-dry-again').click(); // a held button that is clicked anyway starts nothing
    assert.equal(calls.length, runs);
    page.querySelectorAll('.st-dry-note button.lnk')[0].click();
    assert.deepEqual(calls.at(-1), ['conditions', 'start']);
});
