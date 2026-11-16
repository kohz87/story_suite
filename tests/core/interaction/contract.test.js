// The interaction contract names every refusal code and applies only valid per-kind limit overrides.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_CODES, DEFAULT_LIMITS, interactionError, limitsFor } from '../../../src/v2/interaction/contract.js';
import { ERROR_CODES as FACADE_CODES } from '../../../src/v2/interaction.js';

test('the contract has the planned codes, plain refusals and the facade re-exports them', () => {
    assert.deepEqual(Object.keys(ERROR_CODES).sort(), [
        'BUSY', 'CHANGED', 'CLAIMED', 'DAMAGED', 'ENDED', 'FEATURE_OFF', 'INVALID', 'NOT_READY',
        'NOT_YOURS', 'NO_INPUT', 'NO_LONGER_DONE', 'NO_REPLY', 'REFUSED', 'TOO_BIG',
    ]);
    assert.equal(FACADE_CODES.NOT_YOURS, 'NOT_YOURS');
    assert.deepEqual(interactionError('CHANGED', 'Fight'), {
        code: 'CHANGED',
        message: 'What the Fight read has changed; discard it and start again.',
    });
    assert.equal(interactionError('INVALID', 'Fight', 'Choose an action for each member.').message,
        'Choose an action for each member.');
});

test('limits default, override one field at a time, and stay frozen', () => {
    const limits = limitsFor({ limits: { steps: 2, inputBytes: 64, noteTokens: null } });
    assert.equal(limits.steps, 2);
    assert.equal(limits.inputBytes, 64);
    assert.equal(limits.noteTokens, null);
    assert.equal(limits.stepInputs, DEFAULT_LIMITS.stepInputs);
    assert.equal(Object.isFrozen(limits), true);
    assert.equal(limitsFor({ limits: { steps: -1, stepInputs: 1.5 } }).steps, 99);
});
