import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runApply, runVerify } from '../../../scripts/codemod/area-commands.mjs';
import { loadLayoutRules } from '../../../scripts/codemod/cli.mjs';
import { git, toyRepo } from '../codemod-toy.js';

const sink = () => ({ text: '', write(chunk) { this.text += chunk; } });
const streams = () => ({ stdout: sink(), stderr: sink() });
const rules = loadLayoutRules();
const HOME = 'docs/history/packages/story-block/package.json';
const FILES = {
  'packages/story-block/package.json': '{ "version": "2.33.0" }\n',
  'packages/story-block/manifest.json': '{ "version": "2.33.0" }\n',
  'packages/story-block/testkit/matrix/report.js': "import { readFileSync } from 'node:fs';\nexport const v = readFileSync(new URL('../../package.json', import.meta.url), 'utf8');\n",
  'tests/core/bootstrap.test.js': "import { readFileSync } from 'node:fs';\nexport const v = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));\n",
};

// Runs the areas in order on a toy repo holding the real rules' files; returns each area's exit code.
function stack(areas) {
  const root = toyRepo(FILES);
  const runs = areas.map(area => {
    const base = git(root, 'rev-parse', 'HEAD').trim();
    const io = streams();
    const code = runApply(root, rules, area, { dry: false, ...io });
    return { area, base, code, io, tip: git(root, 'rev-parse', 'HEAD').trim(), moves: git(root, 'rev-parse', 'HEAD~1').trim() };
  });
  return { root, runs };
}

for (const areas of [['shared'], ['core', 'shared'], ['core', 'legacy-ui', 'shared']]) {
  test(`shared, after ${areas.slice(0, -1).join(' + ') || 'nothing'}: the package.json that two files read moves, and they follow it`, () => {
    const { root, runs } = stack(areas);
    for (const run of runs) assert.equal(run.code, 0, `${run.area}: ${run.io.stderr.text}${run.io.stdout.text}`);
    assert.ok(git(root, 'ls-files', HOME).trim(), 'the file is at its new home');
    const where = git(root, 'grep', '-l', 'docs/history/packages/story-block/package.json', 'HEAD').trim().split('\n');
    assert.equal(where.length, 2, where.join('\n'));
    const last = runs.at(-1);
    const io = streams();
    assert.equal(runVerify(root, rules, 'shared', { base: last.base, moves: last.moves, rewrites: last.tip, tip: last.tip, ...io }), 0, io.stderr.text);
  });
}
