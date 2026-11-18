// F42: `hidden: true` is a module field the host reads (the module stays out of the lists), so it is not logged as unknown on every load.
import test from 'node:test';
import assert from 'node:assert/strict';
import { definitionWarnings } from '../../core/registry/registry-checks-parts/warnings.js';

test('hidden is a known module field; a made-up one still warns', () => {
    assert.deepEqual(definitionWarnings({ id: 'x', hidden: true }), []);
    assert.match(definitionWarnings({ id: 'x', hiddenish: true }).join(' '), /"hiddenish" is not a module field/);
});
