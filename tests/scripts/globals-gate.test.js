import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { exceptionPaths, gateProblems, globalHits } from '../../scripts/checks/globals-gate.mjs';

const file = (name, text) => ({ path: name, text });

test('every removed name is found in a scanned root, and nothing outside the roots or the browser APIs is', () => {
  for (const text of ['globalThis.NPCStateDelta', 'x.NPCStateDeltaCast.render()', 'window.StorySuite', 'globalThis.StorySuite?.api', 'html[data-npc-state-delta-story-block-v2="1"]', 'data.npcStateDeltaStoryBlockV2', 'data.npcStateDeltaLauncherV2', 'data-npc-state-delta-launcher="keep"']) {
    assert.deepEqual(globalHits([file('modules/people/a.js', text)]), ['modules/people/a.js'], text);
  }
  assert.deepEqual(globalHits([file('tests/a.js', 'globalThis.NPCStateDelta'), file('scripts/a.js', 'window.StorySuite')]), []);
  assert.deepEqual(globalHits([file('modules/a.js', 'window.confirm(globalThis.StoryBlock); const x = __NPCStateDeltaLifecycle; mountNpcStateDeltaDossierUi(); connectStorySuite()')]), []);
});

test('a hit outside the list fails, a listed file passes, a listed file without a hit fails', () => {
  assert.deepEqual(gateProblems({ hits: ['modules/a.js'], exceptions: new Set() }), ['modules/a.js: names a removed global or DOM flag']);
  assert.deepEqual(gateProblems({ hits: ['modules/a.js'], exceptions: new Set(['modules/a.js']) }), []);
  assert.match(gateProblems({ hits: [], exceptions: new Set(['modules/a.js']) })[0], /has no hit; take it off the list/);
});

test('an entry the base list did not have fails; a base without a list is a first introduction', () => {
  const exceptions = new Set(['modules/a.js', 'modules/b.js']);
  const hits = ['modules/a.js', 'modules/b.js'];
  assert.deepEqual(gateProblems({ hits, exceptions, base: new Set(['modules/a.js']) }), ['modules/b.js: added to docs/merge/global-exceptions.txt; the list may only shrink']);
  assert.deepEqual(gateProblems({ hits, exceptions, base: null }), []);
});

test('the list skips comments and blank lines', () => {
  assert.deepEqual([...exceptionPaths('# why\n\nmodules/a.js\n  modules/b.js  \n')], ['modules/a.js', 'modules/b.js']);
});

test('the real tree passes (the script exits 0)', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  execFileSync(process.execPath, [path.join(root, 'scripts/checks/globals-gate.mjs')], { cwd: root, stdio: 'pipe' });
});
