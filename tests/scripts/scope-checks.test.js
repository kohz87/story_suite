import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMap } from '../../scripts/codemap/build-map.mjs';
import { isExtensionlessJs } from '../../scripts/codemap/extensionless-js.mjs';
import { nulProblem } from '../../scripts/checks/nul-check.mjs';
import { packageScopeProblems } from '../../scripts/checks/package-scope.mjs';

const map = SRC => buildMap({ files: Object.keys(SRC), readSource: p => SRC[p], jobs: Object.fromEntries(Object.keys(SRC).map(p => [p, 'A job.'])) }).problems;
const FIVE = 'export const a=1,b=2,c=3,d=4,e=5;\n';

test('a NUL byte is a problem, in any file', () => {
  assert.equal(nulProblem('a.mjs', '/*\0*/\n'), 'a.mjs: contains a NUL byte; text files must not');
  assert.equal(nulProblem('a.mjs', 'ok\n'), null);
  assert.deepEqual(map({ 'core/nul.mjs': '/*\0*/\n' + FIVE }), [
    'core/nul.mjs: 5 exports (one job per file allows at most 4)',
    'core/nul.mjs: contains a NUL byte; text files must not',
  ].sort());
  assert.deepEqual(buildMap({ files: ['core/x.dat'], readSource: () => 'a\0b', jobs: {} }).problems, ['core/x.dat: contains a NUL byte; text files must not', 'core/x.dat: this language is not used in this repo'].sort());
});

test('extensionless JavaScript: node shebang or ES module syntax', () => {
  assert.equal(isExtensionlessJs('#!/usr/bin/env node\nexport const a = 1;\n'), true);
  assert.equal(isExtensionlessJs('#!/usr/bin/node\n'), true);
  assert.equal(isExtensionlessJs(FIVE), true);
  assert.equal(isExtensionlessJs("import fs from 'node:fs';\n"), true);
  for (const text of ['#!/bin/sh\nexport A=1\n', '#!/usr/bin/env python3\n', 'MIT License\n\nPermission is hereby granted\n', 'node_modules\ndist\n', 'all:\n\techo hi\n', '']) {
    assert.equal(isExtensionlessJs(text), false, text);
  }
});

test('extensionless JavaScript gets the export limit, a job and the CommonJS refusal', () => {
  assert.deepEqual(map({ 'core/extensionless': FIVE }), ['core/extensionless: 5 exports (one job per file allows at most 4)']);
  assert.deepEqual(map({ 'bin/tool': '#!/usr/bin/env node\n' + FIVE }), ['bin/tool: 5 exports (one job per file allows at most 4)']);
  assert.match(map({ 'bin/tool': '#!/usr/bin/env node\nmodule.exports = 1;\n' })[0], /CommonJS is not allowed/);
  const noJob = buildMap({ files: ['core/extensionless'], readSource: () => 'export const a = 1;\n', jobs: {} });
  assert.deepEqual(noJob.problems, ['core/extensionless: no job sentence in docs/codemap/jobs.json']);
});

test('other extensionless text stays unmapped; other shebangs are not used here', () => {
  const SRC = { LICENSE: 'MIT\n', '.gitignore': 'node_modules\n', Makefile: 'all:\n\techo hi\n' };
  assert.deepEqual(buildMap({ files: Object.keys(SRC), readSource: p => SRC[p], jobs: {} }).problems, []);
  assert.deepEqual(buildMap({ files: ['scripts/run'], readSource: () => '#!/bin/sh\necho hi\n', jobs: {} }).problems, ['scripts/run: this language is not used in this repo']);
});

test('workflow YAML is a mapped file type that needs a job', () => {
  const r = buildMap({ files: ['.github/workflows/ci.yml'], readSource: () => 'name: x\n', jobs: {} });
  assert.deepEqual(r.problems, ['.github/workflows/ci.yml: no job sentence in docs/codemap/jobs.json']);
});

test('a nested package.json is not allowed outside packages/', () => {
  const read = () => '{"type":"module"}';
  assert.deepEqual(packageScopeProblems(['package.json', 'packages/a/package.json', 'packages/a/x/package.json'], read), []);
  assert.deepEqual(
    packageScopeProblems(['package.json', 'core/revb1f/commonjs/package.json', 'package.json.bak', 'tests/package.json'], read),
    ['core/revb1f/commonjs/package.json: nested package.json is not allowed here', 'tests/package.json: nested package.json is not allowed here'],
  );
});

test('the root package.json must have "type": "module"', () => {
  const problem = ['package.json: the root package.json must have "type": "module"'];
  assert.deepEqual(packageScopeProblems(['package.json'], () => '{"type":"commonjs"}'), problem);
  assert.deepEqual(packageScopeProblems(['package.json'], () => '{}'), problem);
  assert.deepEqual(packageScopeProblems(['package.json'], () => 'not json'), problem);
});
