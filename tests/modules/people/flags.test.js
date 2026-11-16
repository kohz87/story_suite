// The rollout flags read off unless stored true, every time they are asked (the people domain no longer reads one).
import test from 'node:test';
import assert from 'node:assert/strict';
import { flagOn, FLAGS } from '../../../core/runtime/flags.js';

test('flag reads off unless stored true, every time it is asked', () => {
    const root = { storySuite: {} };
    assert.equal(flagOn(root, FLAGS.isolatedApply), false);
    root.storySuite.flags = { [FLAGS.isolatedApply]: 'yes' };
    assert.equal(flagOn(() => root, FLAGS.isolatedApply), false);
    root.storySuite.flags[FLAGS.isolatedApply] = true;
    assert.equal(flagOn(() => root, FLAGS.isolatedApply), true);
    assert.equal(flagOn(() => { throw new Error('x'); }, FLAGS.isolatedApply), false);
});
