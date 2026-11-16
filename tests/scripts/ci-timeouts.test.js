import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');

// Splits the "jobs:" block into [name, text] pairs (jobs sit at two-space indent).
function jobs() {
  const body = ci.slice(ci.indexOf('\njobs:\n') + 6);
  const parts = body.split(/^  ([a-z][\w-]*):\n/m);
  const out = [];
  for (let i = 1; i < parts.length; i += 2) out.push([parts[i], parts[i + 1]]);
  return out;
}

test('ci.yml has jobs to check', () => {
  assert.ok(jobs().length >= 6);
});

test('every CI job has timeout-minutes between 1 and 120', () => {
  for (const [name, text] of jobs()) {
    const m = text.match(/^ {4}timeout-minutes: (\d+)$/m);
    assert.ok(m, `job ${name} has no timeout-minutes`);
    const minutes = Number(m[1]);
    assert.ok(minutes >= 1 && minutes <= 120, `job ${name} timeout-minutes ${minutes} is out of range`);
  }
});

test('every node --test run in CI sets --test-timeout', () => {
  const sources = [ci, fs.readFileSync(path.join(root, 'scripts/ci/suite-tests.sh'), 'utf8')];
  for (const src of sources) {
    for (const line of src.split('\n')) {
      if (/^\s*#/.test(line)) continue;
      if (/\bnode\b[^|]*\s--test(\s|$)/.test(line)) {
        assert.match(line, /--test-timeout=\d+/, `no --test-timeout on: ${line.trim()}`);
      }
    }
  }
});

// node ignores --test-timeout after the globs, so CI repeats each package test command with the flag in front.
// These tests keep each repeated command equal to its package.json script, so they cannot drift apart.
const noFlag = (cmd) => cmd.replace(/ --test-timeout=\d+/, '');
const script = (file, name) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')).scripts[name];
const step = (job, name) => {
  const text = jobs().find(([n]) => n === job)?.[1] ?? '';
  const at = text.indexOf(`- name: ${name}\n`);
  assert.ok(at >= 0, `no step ${name} in job ${job}`);
  const rest = text.slice(at + 1).split(/^ {6}- name:/m)[0];
  return { env: rest, run: rest.match(/^ +run: (.+)$/m)?.[1].trim(), block: rest.match(/^ +run: \|\n((?: {10}.+\n?)+)/m)?.[1] };
};
const jobNames = () => jobs().map(([n]) => n);

test('CI commands equal their package.json scripts plus the timeout flag', () => {
  const [rules, ui, sb, sd, nsd] = ['rules', 'ui', 'story-block', 'story-director', 'npc-state-delta'];
  for (const j of [rules, ui, sb, sd, nsd]) assert.ok(jobNames().includes(j), `job ${j} missing`);
  assert.equal(noFlag(step(rules, 'Script tests').run), script('package.json', 'test:scripts'));
  assert.equal(noFlag(step(ui, 'UI tests').run), script('package.json', 'test:ui'));
  assert.equal(noFlag(step(sd, 'Behavioral tests').run), script('packages/story-director/package.json', 'test'));
  // Story Block's script sets the heap through NODE_OPTIONS; the CI step must set the same value in its env.
  const sbScript = script('packages/story-block/package.json', 'test');
  const heap = sbScript.match(/^NODE_OPTIONS="(--max-old-space-size=\d+) \$NODE_OPTIONS" /);
  assert.ok(heap, 'Story Block test script no longer sets the heap the expected way');
  const sbStep = step(sb, 'Behavioral tests');
  assert.equal(noFlag(sbStep.run), sbScript.replace(heap[0], ''));
  assert.match(sbStep.env, new RegExp(`^ +NODE_OPTIONS: ${heap[1]}$`, 'm'));
  // NPC State's first command is the one CI runs with the timeout; the other two must match the script as-is.
  const nsdLines = step(nsd, 'Full verification').block.trim().split('\n').map((l) => l.trim());
  assert.equal(nsdLines.map(noFlag).join(' && '), script('packages/npc-state-delta/package.json', 'test'));
});
