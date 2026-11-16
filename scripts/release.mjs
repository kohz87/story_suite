import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRelease } from './release/check.mjs';
import { assertSafeOut } from './release/outdir.mjs';

// node scripts/release.mjs [--check] [--out <folder>]
// Builds the bundles of every extension into <folder> (default dist/release, git-ignored) and runs the release gate.
// --check builds into a temporary folder and leaves nothing behind. The source tree is never changed.
const repoRoot = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const outFlag = args.indexOf('--out');
if (outFlag >= 0 && (!args[outFlag + 1] || args[outFlag + 1].startsWith('--'))) {
  console.error('release: --out needs a folder, for example --out dist/release');
  process.exit(2);
}
const outRoot = checkOnly ? fs.mkdtempSync(path.join(os.tmpdir(), 'story-suite-release-')) : path.resolve(outFlag >= 0 ? args[outFlag + 1] : path.join(repoRoot, 'dist/release'));
if (!checkOnly) {
  try { assertSafeOut(outRoot, repoRoot); } catch (error) { console.error(error.message); process.exit(2); }
}
let result;
try {
  result = await checkRelease({ repoRoot, outRoot });
} finally {
  if (checkOnly) fs.rmSync(outRoot, { recursive: true, force: true });
}
const { problems, rows } = result;
for (const row of rows) console.log(`${row.name}: ${(row.bytes / 1024).toFixed(0)} KiB, ${row.requests} requests at load, ${row.lazy} lazy chunks`);
for (const problem of problems) console.error(`release: ${problem}`);
process.exit(problems.length ? 1 : 0);
