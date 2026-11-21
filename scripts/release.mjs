import fs from 'node:fs';
import path from 'node:path';
import { checkRelease } from './release/check.mjs';
import { assertSafeOut } from './release/outdir.mjs';
import { copyStudio } from './release/studio.mjs';
import { writeVersions } from './release/versions.mjs';
import { renderReadme } from './ai-readme/build.mjs';
import { tempDir } from './temp-dir.mjs';

// node scripts/release.mjs [--check] [--out <folder>]
// Builds the bundles of every extension into <folder> (default dist/release, git-ignored) and runs the release gate.
// node scripts/release.mjs <version> writes that version into every place that carries it (see release/versions.mjs) and builds nothing; AI-README.md is regenerated so its version line follows.
// The Pack Studio (studio/ and the files it reaches) is copied into each extension folder beside the bundle.
// --check builds into a temporary folder and leaves nothing behind. The source tree is never changed.
const repoRoot = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const bump = args.find((arg, at) => !arg.startsWith('--') && args[at - 1] !== '--out');
if (bump) {
  // AI-README.md carries the version (a generated line), so it is rewritten with the other places.
  try { writeVersions(repoRoot, bump); fs.writeFileSync(path.join(repoRoot, 'AI-README.md'), await renderReadme(repoRoot), 'utf8'); } catch (error) { console.error(error.message); process.exit(2); }
  console.log(`release: version ${bump} written (AI-README.md too); run release:check`);
  process.exit(0);
}
const checkOnly = args.includes('--check');
const outFlag = args.indexOf('--out');
if (outFlag >= 0 && (!args[outFlag + 1] || args[outFlag + 1].startsWith('--'))) {
  console.error('release: --out needs a folder, for example --out dist/release');
  process.exit(2);
}
const outRoot = checkOnly ? tempDir('story-suite-release-') : path.resolve(outFlag >= 0 ? args[outFlag + 1] : path.join(repoRoot, 'dist/release'));
if (!checkOnly) {
  try { assertSafeOut(outRoot, repoRoot); } catch (error) { console.error(error.message); process.exit(2); }
}
let result;
const studioProblems = [];
try {
  // The Pack Studio goes into the extension's output folder after its bundle is built (release/studio.mjs).
  result = await checkRelease({ repoRoot, outRoot, afterBuild: outDir => { studioProblems.push(...copyStudio(repoRoot, outDir)); } });
} finally {
  if (checkOnly) fs.rmSync(outRoot, { recursive: true, force: true });
}
const { rows } = result;
const problems = [...result.problems, ...studioProblems];
for (const row of rows) console.log(`${row.name}: ${(row.bytes / 1024).toFixed(0)} KiB, ${row.requests} requests at load, ${row.lazy} lazy chunks`);
for (const problem of problems) console.error(`release: ${problem}`);
process.exit(problems.length ? 1 : 0);
