import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { tempDir } from '../../scripts/temp-dir.mjs';
import { renderReadme, handWrittenProblems } from '../../scripts/ai-readme/build.mjs';
import { generatedTables } from '../../scripts/ai-readme/tables.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');
const CLI = path.join(REPO, 'scripts/ai-readme/build.mjs');

// A copy of the real repo's code folders, so a test can break one thing without touching the worktree.
function copyRepo() {
  const dir = tempDir('ai-readme-');
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const rel of ['core', 'packs', 'studio', 'modules', 'ui', 'docs/dev', 'docs/v2', 'docs/codemap.md', 'docs/codemap/jobs.json', 'authoring-kit/reference', 'authoring-kit/check.mjs', 'examples/packs/ersveil/pack.json', 'tests/suite/static-prompt.golden.json', 'scripts/release.mjs', 'scripts/codemap', 'scripts/ai-readme', 'package.json']) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.cpSync(path.join(REPO, rel), path.join(dir, rel), { recursive: true, filter: src => !src.endsWith('node_modules') });
  }
  execFileSync('git', ['add', '-A'], { cwd: dir });
  return dir;
}
const run = (dir, mode) => {
  const r = spawnSync('node', [CLI, mode], { env: { ...process.env, AI_README_ROOT: dir }, encoding: 'utf8' });
  return { status: r.status, out: r.stdout + r.stderr };
};
const withRepo = fn => async () => {
  const dir = copyRepo();
  try { await fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};

test('AI-README.md in the repo is current', async () => {
  assert.equal(fs.readFileSync(path.join(REPO, 'AI-README.md'), 'utf8'), await renderReadme(REPO));
});

test('the real hand-written parts name only files and exports that exist', () => {
  assert.deepEqual(handWrittenProblems(REPO), []);
});

test('a hand-written part naming a missing file or export is a problem', withRepo(dir => {
  const part = path.join(dir, 'docs/dev/ai-readme/rules.md');
  fs.appendFileSync(part, '\nSee `core/nothing-here.js`, `packs/limits.js#NO_SUCH_EXPORT` and `packs/limits.js#LIMITS`.\n');
  const problems = handWrittenProblems(dir);
  assert.equal(problems.length, 2, problems.join('\n'));
  assert.match(problems[0], /does not exist: core\/nothing-here\.js/);
  assert.match(problems[1], /does not export NO_SUCH_EXPORT/);
}));

test('--check fails on a stale file, --write repairs it, and a second --check passes', withRepo(dir => {
  assert.equal(run(dir, '--check').status, 1);
  assert.equal(run(dir, '--write').status, 0);
  const ok = run(dir, '--check');
  assert.equal(ok.status, 0, ok.out);
  assert.equal(run(dir, '--write').status, 0);
  fs.appendFileSync(path.join(dir, 'AI-README.md'), 'hand edit\n');
  assert.equal(run(dir, '--check').status, 1);
}));

test('the tables follow the code: a new pack limit shows up in the table', withRepo(async dir => {
  // Modules load once per path, so the edit is made before the first import from this copy.
  const limits = path.join(dir, 'packs/limits-parts/core.js');
  fs.writeFileSync(limits, fs.readFileSync(limits, 'utf8').replace('    errors: 20,', '    errors: 20,\n    brandNewLimit: 7,'));
  const tables = await generatedTables(dir);
  assert.match(tables.limits, /`brandNewLimit` \| 7/);
  assert.match(tables.limits, /`packBytes`/);
  assert.match(tables.studio, /\| Lore \| World \|/);
  assert.doesNotMatch((await generatedTables(REPO)).limits, /brandNewLimit/);
}));

test('the output holds no model names and no counts of files', async () => {
  const text = await renderReadme(REPO);
  assert.doesNotMatch(text, /\b(claude|gpt|gemini|sonnet|opus|haiku|fable)\b/i);
  assert.doesNotMatch(text, /\b\d+ (files|modules|exports)\b/i);
});

test('a marker naming no table fails the build', withRepo(async dir => {
  fs.appendFileSync(path.join(dir, 'docs/dev/ai-readme/rules.md'), '\n<!-- generated:nope -->\n');
  await assert.rejects(renderReadme(dir), /unknown generated block "nope"/);
}));

test('each hand-written part has prose, not only headings and markers', () => {
  for (const part of ['purpose', 'concepts', 'rules', 'modules', 'packs']) {
    const prose = fs.readFileSync(path.join(REPO, `docs/dev/ai-readme/${part}.md`), 'utf8')
      .split('\n').filter(line => line.trim() && !/^#/.test(line) && !/^<!--/.test(line));
    assert.ok(prose.length >= 5, `${part}.md has only ${prose.length} lines of prose`);
  }
});

test('the guide says NPC State and keeps the rules from CLAUDE.md', async () => {
  const text = await renderReadme(REPO);
  assert.match(text, /\*\*NPC State\*\*/);
  assert.doesNotMatch(text, /\bNSD\b/);
  for (const rule of ['450 lines', 'Replay == live', 'static-prompt.golden.json', 'interaction port']) assert.ok(text.includes(rule), `missing: ${rule}`);
});
