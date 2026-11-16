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
const child = path.join(import.meta.dirname, 'release-run/child.mjs');
const pack = path.join(repoRoot, 'examples/packs/ersveil/pack.json');
const seeded = path.join(repoRoot, 'tests/suite/qa/helpers/seeded.js');
const SB_LAZY = BUNDLE_SETS[0].lazy;
const KIT = [
  `export { createRuntime } from '${path.join(repoRoot, 'core/runtime.js')}';`,
  `export { createStore } from '${path.join(repoRoot, 'core/store.js')}';`,
  `export { createCommandBus } from '${path.join(repoRoot, 'core/commands.js')}';`,
  `export { setRpgLib } from '${path.join(repoRoot, 'modules/rpg/rpg-lazy.js')}';`,
  `export * as leanRpg from '${path.join(repoRoot, 'modules/rpg/index.js')}';`,
  `export { createFakeContext } from '${path.join(repoRoot, 'testkit/fake-st.js')}';`,
].join('\n');
const run = (kitFile, sd, nsd) => JSON.parse(execFileSync(process.execPath, [child, kitFile, sd, nsd, pack, seeded], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim().split('\n').at(-1));

let out;
let fromSource;
let fromBundle;
before(async () => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'release-run-'));
  const kit = path.join(out, 'kit.js');
  fs.writeFileSync(kit, KIT);
  // One bundle set for the one extension; the three entries stand for the suite's parts the harness starts one by one.
  await buildBundleSet({ name: 'suite', entries: [kit, path.join(repoRoot, 'ui/legacy/director/module.js'), path.join(repoRoot, 'modules/people/storysuite-v2.js')], lazy: SB_LAZY }, path.join(out, 'suite'), repoRoot);
  fromSource = run(kit, path.join(repoRoot, 'ui/legacy/director/module.js'), path.join(repoRoot, 'modules/people/storysuite-v2.js'));
  fromBundle = run(path.join(out, 'suite/kit.js'), path.join(out, 'suite/module.js'), path.join(out, 'suite/storysuite-v2.js'));
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

test('the one bundle set gives the same results as the source in the suite host', () => {
  assert.deepEqual(fromBundle, fromSource);
});

test('the RPG library came from a separate lazy chunk of the bundle, loaded on demand', () => {
  assert.ok(fs.readdirSync(path.join(out, 'suite')).some(file => /^rpg-.*\.js$/.test(file)));
});
