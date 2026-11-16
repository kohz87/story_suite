import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLayout } from '../layout.mjs';
import { nodeTestPaths } from './test-command-args.mjs';

// Node's default test file patterns (the ones `node --test` uses when given no paths), any depth.
const TEST_NAME = /(\.test|-test|_test)\.(js|mjs|cjs)$|(^|\/)(test-[^/]*|test)\.(js|mjs|cjs)$/;
const IN_TEST_DIR = /(^|\/)test\/.*\.(js|mjs|cjs)$/;
const isTestFile = rel => TEST_NAME.test(rel) || IN_TEST_DIR.test(rel);

// Every file Node's default patterns would treat as a test under the package's test roots (tests/, test/ and
// the same folders inside examples/<name>/), as package-relative posix paths.
function listTestFiles(pkgDir) {
  const found = [];
  const walk = (rel, underRoot) => {
    for (const entry of fs.readdirSync(path.join(pkgDir, rel), { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(next, underRoot || entry.name === 'tests' || entry.name === 'test');
      else if (entry.isFile() && underRoot && isTestFile(next)) found.push(next);
    }
  };
  for (const top of ['tests', 'test', 'examples']) {
    if (fs.existsSync(path.join(pkgDir, top))) walk(top, top !== 'examples');
  }
  return found.sort();
}

// The paths and globs the package's npm test script really hands to `node --test`, command by command.
function testGlobs(script, pkgDir) {
  return script.split(/&&|;|\|\|/).flatMap(command => nodeTestPaths(command, pkgDir) ?? []);
}

/**
 * Returns one error per test file in the package that none of its npm test script's globs matches.
 */
export function unrunTests(pkgDir, label = path.basename(pkgDir)) {
  const manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  const globs = testGlobs(manifest.scripts?.test ?? '', pkgDir);
  const errors = [];
  if (globs.length === 0) errors.push(`${label}: its npm test script passes no globs to node --test`);
  for (const file of listTestFiles(pkgDir)) {
    if (!globs.some(glob => path.posix.matchesGlob(file, glob))) {
      errors.push(`${label}/${file} is not run by the package's npm test`);
    }
  }
  return errors;
}

// Every test file under the repo root's tests/ and examples/<name>/tests/ that none of the root npm test scripts (nor
// the globs of scripts/ci/suite-tests.sh) matches. Scripts that only call npm or bash add no globs themselves.
export function unrunRootTests(root) {
  if (!fs.existsSync(path.join(root, 'package.json'))) return [];
  const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts ?? {};
  const shell = fs.existsSync(path.join(root, 'scripts/ci/suite-tests.sh')) ? fs.readFileSync(path.join(root, 'scripts/ci/suite-tests.sh'), 'utf8') : '';
  const fromSuite = [...(shell.match(/^globs=\((.*)\)$/m)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map(m => m[1]);
  const globs = [...Object.entries(scripts).filter(([name]) => name.startsWith('test')).flatMap(([, script]) => testGlobs(script, root)), ...fromSuite];
  const errors = [];
  if (globs.length === 0) errors.push('the root package.json test scripts pass no globs to node --test');
  for (const file of listTestFiles(root)) {
    if (!globs.some(glob => path.posix.matchesGlob(file, glob))) errors.push(`${file} is not run by any root test script`);
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../..'));
  const errors = [...loadLayout().packageDirs(root)
    .filter(dir => fs.existsSync(path.join(root, dir, 'package.json')))
    .flatMap(dir => unrunTests(path.join(root, dir))), ...unrunRootTests(root)];
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
  console.log('package test globs: every test file is run by its package or root npm test');
}
