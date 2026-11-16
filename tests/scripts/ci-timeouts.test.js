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
