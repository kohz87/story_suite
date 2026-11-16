// src/v2/module/merge.js: flag `suite.isolatedApply` keeps the other parts' answers when one part throws; off, it rejects as before.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeHook } from '../../../ui/legacy/director/module/merge.js';
import { LIVE_HOST } from '../../../ui/legacy/director/module/shared.js';

const shared = () => ({ env: { fights: false }, story: {} });
const boom = () => { throw new Error('bad weather'); };
const good = lines => () => ({ lines, commands: [{ type: 'x.do' }] });
const entries = [['time', good(['a'])], ['weather', boom], ['cast', async () => ({ lines: ['c'], problems: [{ code: 'NOTE', message: 'n' }] })]];
const on = name => name === 'suite.isolatedApply';

for (const hook of ['afterCapture', 'beforeGenerate']) {
    test(`${hook}: flag off, a throwing part rejects the whole hook (as before)`, async () => {
        await assert.rejects(() => mergeHook(hook, entries, shared)({}), /bad weather/);
        await assert.rejects(() => mergeHook(hook, entries, shared, () => false)({}), /bad weather/);
    });
    test(`${hook}: flag on, the other parts' lines, commands and problems are kept and the failure names the part`, async () => {
        const out = await mergeHook(hook, entries, shared, on)({});
        assert.deepEqual(out.lines, ['a', 'c']);
        assert.deepEqual(out.commands, [{ type: 'x.do' }]);
        assert.deepEqual(out.problems, [{ code: 'FAILED', message: `${hook} failed (weather): bad weather` }, { code: 'NOTE', message: 'n' }]);
    });
}

test('flag on, nothing throws: the answer is exactly the flag-off answer', async () => {
    const fine = entries.filter(([ns]) => ns !== 'weather');
    assert.deepEqual(await mergeHook('afterCapture', fine, shared, on)({}), await mergeHook('afterCapture', fine, shared)({}));
});

test('a flag reader that throws reads as off; the live host reads off with no Story Block', () => {
    assert.equal(LIVE_HOST.flag('suite.isolatedApply'), false);
    return assert.rejects(() => mergeHook('afterCapture', entries, shared, () => { throw new Error('x'); })({}), /bad weather/);
});
