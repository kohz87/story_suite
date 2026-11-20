import test from 'node:test';
import assert from 'node:assert/strict';
import { bumpPersonaStamp, personaStamp } from '../../../ui/select/persona-stamp.js';

// Owner, 20 Nov: "when I changed the persona image, the suite doesn't get updated".
test('a persona picture event bumps the stamp, always upward, so the same file name is fetched again', () => {
  const before = personaStamp();
  const one = bumpPersonaStamp(5);
  assert.ok(one > before);
  const two = bumpPersonaStamp(1);
  assert.ok(two > one, 'never goes back, even with an earlier clock');
  assert.equal(personaStamp(), two);
});
