import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildBundleSet } from '../../scripts/release/bundle.mjs';
import { BUNDLE_SETS } from '../../scripts/release/entries.mjs';

// Runs the bundles, not only reads them: Story Block's host (wired as testkit/host.js wires it) with Story Director and NPC State Delta
// (the suite harness) on the source and on bundles of the same entries built with the release plugin, then
// compares what both report (register, two replies through capture, a query from each module, the RPG's lazy load).
const repoRoot = path.resolve(import.meta.dirname, '../..');
const pkg = name => path.join(repoRoot, 'packages', name);
const child = path.join(import.meta.dirname, 'release-run/child.mjs');
const pack = path.join(pkg('story-block'), 'examples/packs/ersveil/pack.json');
const seeded = path.join(pkg('story-block'), 'tests/v2/qa/helpers/seeded.js');
const SB_LAZY = BUNDLE_SETS.find(set => set.name === 'story-block').lazy;
const sbAt = rel => path.join(pkg('story-block'), rel);
const KIT = [
  `export { createRuntime } from '${path.join(repoRoot, 'core/runtime.js')}';`,
  `export { createStore } from '${path.join(repoRoot, 'core/store.js')}';`,
  `export { createCommandBus } from '${path.join(repoRoot, 'core/commands.js')}';`,
  `export { setRpgLib } from '${sbAt('src/v2/rpg-lazy.js')}';`,
  `export * as leanRpg from '${sbAt('src/v2/lean-rpg/index.js')}';`,
  `export { createFakeContext } from '${sbAt('testkit/fake-st.js')}';`,
].join('\n');
const SETS = [
  { name: 'story-block', dir: 'packages/story-block', entries: [], lazy: SB_LAZY },
  { name: 'story-director', dir: 'packages/story-director', entries: ['src/v2/module.js'], lazy: [] },
  { name: 'npc-state-delta', dir: 'packages/npc-state-delta', entries: ['src/storysuite-v2.js'], lazy: [] },
];
const run = (kitFile, sd, nsd) => JSON.parse(execFileSync(process.execPath, [child, kitFile, sd, nsd, pack, seeded], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim().split('\n').at(-1));

let out;
let fromSource;
let fromBundle;
before(async () => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'release-run-'));
  const kit = path.join(out, 'kit.js');
  fs.writeFileSync(kit, KIT);
  SETS[0].entries = [kit];
  for (const set of SETS) await buildBundleSet(set, path.join(out, set.name), repoRoot);
  fromSource = run(kit, path.join(repoRoot, 'ui/legacy/director/module.js'), path.join(pkg('npc-state-delta'), 'src/storysuite-v2.js'));
  fromBundle = run(path.join(out, 'story-block/kit.js'), path.join(out, 'story-director/module.js'), path.join(out, 'npc-state-delta/storysuite-v2.js'));
});
after(() => fs.rmSync(out, { recursive: true, force: true }));

test('the smoke run on the source does what it should (so the comparison is not of two empty results)', () => {
  assert.deepEqual(fromSource.errors, []);
  assert.deepEqual(fromSource.modules, ['npc-state-delta', 'story-block', 'story-director']);
  assert.equal(fromSource.packInstalled, true);
  assert.equal(fromSource.nsdRegistered, true);
  assert.deepEqual([fromSource.reply1, fromSource.reply2], ['ok', 'ok']);
  assert.deepEqual(fromSource.sbQueries.items, ['Bedroll x1', 'Bread x2']);
  assert.equal(typeof fromSource.sdQueries.time.minutes, 'number');
  // P3 (PEOPLE-PLAN.md, line 35 and the P3 section): no timeline participant, so npc.catchUp answers the idle null (adapter/identity.js); a store-backed NPC State has no catch-up to report.
  assert.equal(fromSource.nsdQueries.catchUp, null);
  assert.equal(fromSource.rpgBefore, false);
  assert.equal(fromSource.rpgLoad, true);
});

test('the bundles of the three packages give the same results as the source in the suite host', () => {
  assert.deepEqual(fromBundle, fromSource);
});

test('the RPG library came from a separate lazy chunk of the bundle, loaded on demand', () => {
  assert.ok(fs.readdirSync(path.join(out, 'story-block')).some(file => /^lean-rpg-.*\.js$/.test(file)));
});
