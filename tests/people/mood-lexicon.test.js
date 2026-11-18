// The mood lexicon's curly apostrophe and the scanner's mood numbers (kept from the old dossier panel's tests, B4-5).
import test from 'node:test';
import assert from 'node:assert/strict';

test('mood lexicon tokens keep a curly apostrophe; scanner numbers must be numbers or numeric strings', async () => {
  const { plainMoodWords, moodNumbers } = await import('../../modules/people/meters/npc-mood.js');
  assert.deepEqual(plainMoodWords('she isn\u2019t angry'), [], 'curly n\u2019t negates like the straight one');
  assert.deepEqual(plainMoodWords("she isn't angry"), []);
  assert.deepEqual(moodNumbers({ moodV: '2', moodA: -1, moodD: 0 }), { v: 2, a: -1, d: 0 });
  for (const bad of [true, [2], ' ', {}]) assert.equal(moodNumbers({ moodV: bad, moodA: 1, moodD: 1 }), null, `${JSON.stringify(bad)} is not a number`);
});
