// sdk.flag(name): the read-only internal flag reader for the sibling modules; off by default and when the reader throws.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSdk } from '../../src/v2/sdk.js';

const make = flag => createSdk({ store: {}, bus: {}, registry: { features: () => [] }, settings: () => ({}), ...(flag ? { flag } : {}) }).sdk;

test('sdk.flag is off with no reader, follows the reader at each call, and reads a throw as off', () => {
    assert.equal(make().flag('suite.isolatedApply'), false);
    let on = false;
    const sdk = make(name => on && name === 'suite.isolatedApply');
    assert.equal(sdk.flag('suite.isolatedApply'), false);
    on = true;
    assert.equal(sdk.flag('suite.isolatedApply'), true);
    assert.equal(sdk.flag('suite.other'), false);
    assert.equal(make(() => { throw new Error('x'); }).flag('a'), false);
});
