import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Browser ad and privacy blockers refuse URLs with these words: a file the extension loads under such a name fails to load
// in a reader's SillyTavern (fingerprint.js stopped NPC State from starting on 19 Nov), while tests and the bundled build pass.
const BLOCKED = /(fingerprint|analytic|telemetry|beacon|pixel|advert|tracking|\/ads?[-_./])/i;

test('no file the browser loads has a name ad and privacy blockers refuse', () => {
  const files = execFileSync('git', ['ls-files', '--', 'index.js', 'core', 'modules', 'ui', 'packs', 'studio'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.deepEqual(files.filter(f => BLOCKED.test(f)), []);
});
