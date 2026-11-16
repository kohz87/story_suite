// Builds the one installable play extension from a commit of main: bundles the one extension from the root index.js, copies
// its runtime assets, writes the root manifest/stylesheet/BUILD.txt, and adds one commit to
// the local `play` branch. Never pushes.
//
//   node scripts/play/dist.mjs [--repo DIR] [--commit REF] [--out DIR] [--branch play] [--no-commit]
//
// --source DIR reads an already extracted source tree (used by tests and by a sandbox that cannot
// run git); it still needs --commit for BUILD.txt.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBundleSet } from '../release/bundle.mjs';
import { DIST_SET, writeRootFiles } from './dist-sets.mjs';
import { copyRuntimeAssets } from './dist-assets.mjs';
import { commitFolder, extractSource, fullCommit } from './dist-git.mjs';

/** Parses the CLI options; every option takes a value except --no-commit. */
export function parseArgs(argv) {
  const out = { repo: process.cwd(), commit: 'origin/main', branch: 'play', write: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--no-commit') { out.write = false; continue; }
    if (!['--repo', '--commit', '--out', '--source', '--branch'].includes(arg) || argv[i + 1] === undefined) throw new Error(`usage: dist.mjs [--repo DIR] [--commit REF] [--out DIR] [--source DIR] [--branch NAME] [--no-commit] (bad argument: ${arg})`);
    out[arg.slice(2)] = argv[i + 1];
    i += 1;
  }
  return out;
}

/** Builds the extension folder and, unless write is false, commits it to the local branch. */
export async function buildDist({ repo = process.cwd(), commit = 'origin/main', out, source = null, branch = 'play', write = true, now = new Date() } = {}) {
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
    await buildBundleSet(DIST_SET, outDir, sourceDir);
    copyRuntimeAssets(sourceDir, outDir);
    writeRootFiles(outDir, { commit: full, builtAt: now.toISOString(), sourceDir });
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
