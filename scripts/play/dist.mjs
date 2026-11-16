// Builds the one installable play extension from a commit of main: bundles the four tools, copies
// their runtime assets, writes the root manifest/entry/stylesheet/BUILD.txt, and adds one commit to
// the local `play` branch. Never pushes.
//
//   node scripts/play/dist.mjs [--repo DIR] [--commit REF] [--out DIR] [--branch play] [--install-folder story_suite] [--no-commit]
//
// --source DIR reads an already extracted source tree (used by tests and by a sandbox that cannot
// run git); it still needs --commit for BUILD.txt.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBundleSet } from '../release/bundle.mjs';
import { DIST_SETS, writeRootFiles } from './dist-sets.mjs';
import { copyRuntimeAssets } from './dist-assets.mjs';
import { commitFolder, extractSource, fullCommit } from './dist-git.mjs';

// SillyTavern's installer names the folder after the repo, so the tools sit one folder deeper: third-party/<folder>/<tool>/.
export const DEFAULT_INSTALL_FOLDER = 'story_suite';

/** Parses the CLI options; every option takes a value except --no-commit. */
export function parseArgs(argv) {
  const out = { repo: process.cwd(), commit: 'origin/main', branch: 'play', write: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--no-commit') { out.write = false; continue; }
    if (!['--repo', '--commit', '--out', '--source', '--branch', '--install-folder'].includes(arg) || argv[i + 1] === undefined) throw new Error(`usage: dist.mjs [--repo DIR] [--commit REF] [--out DIR] [--source DIR] [--branch NAME] [--install-folder NAME] [--no-commit] (bad argument: ${arg})`);
    out[arg === '--install-folder' ? 'installFolder' : arg.slice(2)] = argv[i + 1];
    i += 1;
  }
  return out;
}

/** Builds the extension folder and, unless write is false, commits it to the local branch. */
export async function buildDist({ repo = process.cwd(), commit = 'origin/main', out, source = null, branch = 'play', write = true, installFolder = DEFAULT_INSTALL_FOLDER, now = new Date() } = {}) {
  let sourceDir = source;
  let full = commit;
  let cleanup = null;
  if (!sourceDir) {
    full = fullCommit(repo, commit);
    sourceDir = extractSource(repo, full);
    cleanup = () => fs.rmSync(sourceDir, { recursive: true, force: true });
  }
  const outDir = path.resolve(out ?? path.join(repo, 'dist/play'));
  try {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    for (const set of DIST_SETS) {
      const dir = path.join(outDir, set.name);
      await buildBundleSet({ ...set, installAt: `${installFolder}/${set.name}` }, dir, sourceDir);
      copyRuntimeAssets(path.join(sourceDir, set.dir), dir, set);
    }
    writeRootFiles(outDir, { commit: full, builtAt: now.toISOString() });
    const sha = write ? commitFolder({ repo, folder: outDir, branch, message: `Play build from ${full}` }) : null;
    return { outDir, commit: full, sha };
  } finally {
    cleanup?.();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await buildDist(args);
  console.log(`${result.outDir}\tsource ${result.commit}\t${result.sha ? `branch ${args.branch} at ${result.sha}` : 'not committed'}`);
}
