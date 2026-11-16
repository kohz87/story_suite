import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../..'));
  const packagesDir = path.join(root, 'packages');
  const errors = fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(packagesDir, entry.name, 'package.json')))
    .flatMap(entry => unrunTests(path.join(packagesDir, entry.name)));
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
  console.log('package test globs: every test file is run by its package npm test');
}
