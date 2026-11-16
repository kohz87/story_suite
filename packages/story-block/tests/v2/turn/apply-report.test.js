// The apply report (turn/apply-report.js), the card's "could not finish" row and the Inspector's grouping (suite.isolatedApply).
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReport, moduleFailures } from '../../../src/v2/turn/apply-report.js';
import { inspectorProblemsFor } from '../../../src/v2/ui-host/inspector-problems.js';
import { changesCardScreen } from '../../../src/v2/screens/index.js';
import { core, queries, show, stocked, text } from '../screens/helpers.js';

const problems = [
    { module: 'a', index: 4, code: 'FAILED', message: 'turn failed: torn' },
    { module: 'a', index: 4, code: 'FAILED', message: 'turn failed: torn' },
    { module: 'b', index: 4, code: 'TIMEOUT', message: 'afterCapture did not answer' },
    { module: 'b', index: 4, code: 'FAILED', line: '+ item x', message: 'a line, not a module failure' },
    { module: 'c', index: 5, code: 'FAILED', message: 'another reply' },
    { index: 4, code: 'FAILED', message: 'no module' },
    { module: 'd', index: 4, code: 'LIMITED', message: 'a note' },
];

test('moduleFailures: this reply\'s FAILED or TIMEOUT Problems that name a module and no line, once each, with the display name', () => {
    assert.deepEqual(moduleFailures(problems, 4, id => id.toUpperCase()), [
        { module: 'a', name: 'A', reason: 'turn failed: torn', code: 'FAILED' },
        { module: 'b', name: 'B', reason: 'afterCapture did not answer', code: 'TIMEOUT' },
    ]);
    assert.deepEqual(moduleFailures(problems, 9), []);
    assert.deepEqual(moduleFailures(null, 4), []);
    const same = [{ module: 'a', index: 4, code: 'FAILED', message: 'x' }, { module: 'a', index: 4, code: 'TIMEOUT', message: 'x' }];
    assert.deepEqual(moduleFailures(same, 4).map(item => item.code), ['FAILED', 'TIMEOUT'], 'same message, two codes: two lines');
});

test('applyReport: receipts and Problems grouped by module, the failed list beside them', () => {
    const receipts = [{ module: 'a', type: 'a.x' }, { module: 'b', type: 'b.y' }, { module: 'a', type: 'a.z' }, { type: 'none' }];
    const report = applyReport({ receipts, problems, index: 4 });
    assert.deepEqual(Object.keys(report.byModule), ['a', 'b', 'd']);
    assert.equal(report.byModule.a.receipts.length, 2);
    assert.equal(report.byModule.a.problems.length, 2);
    assert.equal(report.byModule.d.problems[0].code, 'LIMITED');
    assert.deepEqual(report.failed.map(item => item.module), ['a', 'b']);
    assert.deepEqual(applyReport({ index: 1 }), { byModule: {}, failed: [] });
});

// main's changes card (before this step) for the same input: nothing changed, one refused line. Stored from origin/main's template.
const MAIN_CARD = "\n\n  \n    \n    \n    \n    \n    \n  \n  \n  \n  \n    \n  \n  \n  Nothing changed in the inventory or the scene.\n  \n    \n      \n      not applied: + item x — no such item\n    \n  \n  \n  \n";

test('card: with nothing failed (flag off) the card is byte-identical to main\'s; the row names the module and reason', () => {
    const module = core();
    const state = stocked(module);
    const draw = extra => show(changesCardScreen, { state, query: queries(module, state), changes: [], extra: { refused: [{ line: '+ item x', reason: 'no such item' }], ...extra } });
    const empty = draw({ moduleFailed: [] });
    assert.equal(empty.el.innerHTML, MAIN_CARD);
    assert.equal(draw({}).el.innerHTML, MAIN_CARD);
    assert.equal(empty.el.querySelectorAll('.module-failed').length, 0);
    const row = draw({ moduleFailed: [{ module: 'a', name: 'Alpha', reason: 'turn failed: <b>torn</b>' }] });
    assert.deepEqual(row.view.warnings, []);
    const items = row.el.querySelectorAll('.module-failed .line');
    assert.equal(items.length, 1);
    assert.equal(text(items[0]), 'Alpha could not finish this reply: turn failed: <b>torn</b>');
    assert.equal(row.el.querySelectorAll('.module-failed b').length, 0, 'the reason is text, never markup');
});

test('Inspector: flag off lists the problems as before; flag on groups a module failure under its name', () => {
    const store = { problems: () => [] };
    const notes = { refusedAt: () => [] };
    const runtime = { turn: { problems: () => problems.filter(item => item.module !== 'c') } };
    const off = inspectorProblemsFor(4, { store, runtime, notes });
    const on = inspectorProblemsFor(4, { store, runtime, notes, isolated: () => true, nameOf: id => `Mod ${id}` });
    assert.equal(on.length, off.length - 1, 'the repeated failure is listed once');
    assert.ok(off.some(item => item.message === 'turn failed: torn'));
    assert.ok(on.some(item => item.message === 'Mod a: turn failed: torn' && item.code === 'FAILED'));
    assert.ok(on.some(item => item.message === 'Mod b: afterCapture did not answer' && item.code === 'TIMEOUT'));
    assert.ok(on.some(item => item.message === '"+ item x": a line, not a module failure'));
});
