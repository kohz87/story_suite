import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_FILE = /\.test\.js$/;

// Every *.test.js under tests/ and examples/<name>/tests/ (any depth below those), as package-relative posix paths.
function listTestFiles(pkgDir) {
  const found = [];
  const walk = (rel, underTests) => {
    for (const entry of fs.readdirSync(path.join(pkgDir, rel), { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(next, underTests || entry.name === 'tests');
      else if (entry.isFile() && underTests && TEST_FILE.test(entry.name)) found.push(next);
    }
  };
  for (const top of ['tests', 'examples']) {
    if (fs.existsSync(path.join(pkgDir, top))) walk(top, top === 'tests');
  }
  return found.sort();
}

// The globs a package's npm test script passes to `node --test`: the words after the --test flag
// up to the next flag, `&&` or `;`, with quotes removed.
function testGlobs(script) {
  const globs = [];
  for (const command of script.split(/&&|;|\|\|/)) {
    const words = command.trim().split(/\s+/);
    const at = words.indexOf('--test');
    if (at < 0) continue;
    for (const word of words.slice(at + 1)) {
      if (word.startsWith('-')) break;
      globs.push(word.replace(/^["']|["']$/g, ''));
    }
  }
  return globs;
}

/**
 * Returns one error per test file in the package that none of its npm test script's globs matches.
 */
export function unrunTests(pkgDir, label = path.basename(pkgDir)) {
  const manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  const globs = testGlobs(manifest.scripts?.test ?? '');
  const errors = [];
  if (globs.length === 0) errors.push(`${label}: its npm test script passes no globs to node --test`);
  for (const file of listTestFiles(pkgDir)) {
    if (!globs.some(glob => path.posix.matchesGlob(file, glob.replace(/^\.\//, '')))) {
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
