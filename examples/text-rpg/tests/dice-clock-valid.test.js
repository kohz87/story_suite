// A reply's dice record keeps the story clock it was rolled at (training sessions); the domain must accept it, or every `? try` of that reply
// is refused as an invalid state (owner's live chat, 23 Nov: all tries refused, "dice.<reply>.clock is not a known field").
import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/domain/validate.js';
import { initialState } from '../src/domain/shape.js';

test('a dice record with a clock is valid; a bad clock is named', () => {
    const slice = { ...initialState(), dice: { sw_a: { list: [3, 12, 18], floor: 0, clock: 321535240 } } };
    assert.deepEqual(validate(slice), []);
    const used = { ...initialState(), dice: { sw_a: { list: [3, 12, 18], floor: 1, clock: 5, used: 2, hardest: 2, threat: 2 } } };
    assert.deepEqual(validate(used), []);
    const bad = { ...initialState(), dice: { sw_a: { list: [3, 12, 18], floor: 0, clock: -1 } } };
    assert.ok(validate(bad).some(problem => /clock/.test(problem)));
});
