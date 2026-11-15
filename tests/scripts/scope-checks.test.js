import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMap } from '../../scripts/codemap/build-map.mjs';
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

test('outside packages/, extensionless files are refused except an allow-list', () => {
  const refused = p => buildMap({ files: [p], readSource: () => 'echo hi\n', jobs: {} }).problems;
  for (const p of ['scripts/run', 'bin/tool', 'core/extensionless', 'LICENSE', 'docs/NOTES']) assert.deepEqual(refused(p), [`${p}: files need an extension here`], p);
  assert.deepEqual(refused('bin/tool2'), ['bin/tool2: files need an extension here']);
  assert.deepEqual(buildMap({ files: ['core/t'], readSource: () => '#!/usr/bin/env node\nmodule.exports = 1;\n', jobs: {} }).problems, ['core/t: files need an extension here']);
});

test('allow-listed extensionless names are accepted as text; packages/ is exempt', () => {
  const names = ['.gitignore', '.gitattributes', '.nvmrc', '.npmrc', 'CODEOWNERS', '.github/CODEOWNERS'];
  assert.deepEqual(buildMap({ files: names, readSource: () => 'x\n', jobs: {} }).problems, []);
  assert.deepEqual(buildMap({ files: ['packages/a/LICENSE', 'packages/a/VERSION'], readSource: () => 'x\n', jobs: {} }).problems, []);
  assert.deepEqual(buildMap({ files: ['core/Makefile.bak'], readSource: () => 'x\n', jobs: {} }).problems, ['core/Makefile.bak: this language is not used in this repo']);
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
