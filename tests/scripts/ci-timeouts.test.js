import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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

// Every node --test command in CI, with backslash-continued lines joined.
function testCommands() {
  const sources = [ci, fs.readFileSync(path.join(root, 'scripts/ci/suite-tests.sh'), 'utf8')];
  const out = [];
  for (const src of sources) {
    const lines = src.replace(/\\\n\s*/g, ' ').split('\n');
    for (const line of lines) {
      if (/^\s*#/.test(line)) continue;
      if (/\bnode\b[^|]*\s--test(\s|$)/.test(line)) out.push(line.trim());
    }
  }
  return out;
}

test('every node --test run in CI sets --test-timeout (at least 600000) and --test-force-exit before the test globs', () => {
  const cmds = testCommands();
  assert.ok(cmds.length >= 7, `expected at least 7 node --test commands, found ${cmds.length}`);
  for (const cmd of cmds) {
    const after = cmd.slice(cmd.search(/\s--test(\s|$)/) + 1);
    const m = after.match(/--test-timeout=(\d+)/);
    assert.ok(m, `no --test-timeout on: ${cmd}`);
    assert.ok(Number(m[1]) >= 600000, `--test-timeout below 600000 on: ${cmd}`);
    assert.ok(/--test-force-exit(\s|$)/.test(after), `no --test-force-exit on: ${cmd}`);
    // node ignores flags placed after the globs, so both must come before the first test path.
    const firstGlob = after.search(/\s["']?(\$packs|tests\/|\$\{globs)/);
    assert.ok(firstGlob > after.indexOf('--test-timeout') && firstGlob > after.indexOf('--test-force-exit'), `flags must come before the test globs on: ${cmd}`);
  }
});

// node ignores --test-timeout after the globs, so CI repeats each package test command with the flag in front.
// These tests keep each repeated command equal to its package.json script, so they cannot drift apart.
const noFlag = (cmd) => cmd.replace(/ --test-timeout=\d+/g, '').replace(/ --test-force-exit/g, '');
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

test('a hung test that holds a live handle is named and fails the run at the timeout', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-timeouts-'));
  try {
    fs.writeFileSync(path.join(dir, 'hang.test.js'), "import { test } from 'node:test';\ntest('hangs holding a handle', async () => { setInterval(() => {}, 1000); await new Promise(() => {}); });\n");
    fs.writeFileSync(path.join(dir, 'ok.test.js'), "import { test } from 'node:test';\ntest('healthy', () => {});\n");
    const r = spawnSync(process.execPath, ['--test', '--test-timeout=1500', '--test-force-exit', '--test-reporter=tap', 'hang.test.js', 'ok.test.js'], { cwd: dir, encoding: 'utf8', timeout: 20000, env: { ...process.env, NODE_TEST_CONTEXT: undefined } });
    assert.equal(r.status, 1, `expected exit 1, got ${r.status} ${r.signal}`);
    assert.match(r.stdout, /not ok \d+ - hangs holding a handle/);
    assert.match(r.stdout, /timed out after 1500ms/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
