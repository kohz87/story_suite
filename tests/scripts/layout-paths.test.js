import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { oldLocation } from '../../scripts/release/layout-paths.mjs';
import { loadLayoutRules } from '../../scripts/codemod/load-layout-rules.mjs';
import { layoutMapper } from '../../scripts/codemod/layout-map.mjs';

const listFile = path.resolve(import.meta.dirname, '../../docs/merge/layout-old-files.txt');
const oldFiles = fs.readFileSync(listFile, 'utf8').split('\n').filter(line => line && !line.startsWith('#'));

test('oldLocation returns the real old name of every moved file (two rules reach modules/people/legacy/relationship-*, only one file did)', () => {
  const map = layoutMapper(loadLayoutRules());
  const wrong = oldFiles.filter(file => oldLocation(map(file)) !== file);
  assert.deepEqual(wrong.slice(0, 5), []);
  assert.equal(oldLocation('modules/people/legacy/relationship-map.js'), 'packages/npc-state-delta/relationship-map.js');
  assert.equal(oldLocation('modules/people/core/core-mechanics.js'), 'packages/npc-state-delta/core-mechanics.js');
});

test('a file no rule moved, or one added after the move, keeps its name', () => {
  assert.equal(oldLocation('tests/scripts/layout-paths.test.js'), 'tests/scripts/layout-paths.test.js');
  assert.equal(oldLocation('modules/people/never-existed.js'), 'modules/people/never-existed.js');
});

test('the frozen list has no two files that move to the same place', () => {
  const map = layoutMapper(loadLayoutRules());
  const seen = new Map();
  for (const file of oldFiles) {
    const moved = map(file);
    assert.ok(!seen.has(moved), `${seen.get(moved)} and ${file} both move to ${moved}`);
    seen.set(moved, file);
  }
});

// The NPC State CI job installs no packages: the helpers that reach layout-paths must load without the source parser (acorn).
test('layout-paths loads and answers with acorn unavailable', () => {
  const hook = "export async function resolve(s, c, n) { if (/^acorn/.test(s)) throw new Error('blocked ' + s); return n(s, c); }";
  const target = path.resolve(import.meta.dirname, '../../scripts/release/layout-paths.mjs');
  const code = [
    "import { register } from 'node:module';",
    `register('data:text/javascript,' + encodeURIComponent(${JSON.stringify(hook)}));`,
    `const m = await import(${JSON.stringify(target)});`,
    "console.log(m.oldLocation('modules/people/core/core-mechanics.js'));",
  ].join('\n');
  assert.equal(execFileSync('node', ['--input-type=module', '-e', code], { encoding: 'utf8' }).trim(), 'packages/npc-state-delta/core-mechanics.js');
});
