// Guards the recording output folder: it must sit outside every git checkout and outside --code, must be empty
// (or hold only files this tool listed in its manifest, removed with --fresh), so chat-derived records never land
// in a repo and stale results never reach a compare.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export const MANIFEST = 'dryrun-manifest.txt';

function nearestExisting(target) {
  let dir = path.resolve(target);
  while (!existsSync(dir)) dir = path.dirname(dir);
  return dir;
}

function inside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function listed(outDir) {
  try {
    const names = JSON.parse(readFileSync(path.join(outDir, MANIFEST), 'utf8')).files;
    return Array.isArray(names) ? names.filter(name => typeof name === 'string' && name === path.basename(name)) : [];
  } catch {
    return [];
  }
}

export function prepareOutDir({ outDir, repoRoot, fresh }) {
  const out = path.resolve(outDir);
  if (inside(out, path.resolve(repoRoot))) throw new Error(`--out ${out} is inside the --code repo: pick a folder outside every checkout`);
  const git = spawnSync('git', ['-C', nearestExisting(out), 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (git.status === 0) throw new Error(`--out ${out} is inside the git checkout ${git.stdout.trim()}: pick a folder outside every checkout`);
  if (!existsSync(out)) return;
  if (fresh) {
    for (const name of listed(out)) rmSync(path.join(out, name), { force: true });
    rmSync(path.join(out, MANIFEST), { force: true });
  }
  if (readdirSync(out).length > 0) {
    throw new Error(`--out ${out} is not empty${fresh ? ' (it holds files this tool did not write)' : ': use --fresh to clear the files this tool wrote'}`);
  }
}

export function writeManifest(outDir, files) {
  writeFileSync(path.join(outDir, MANIFEST), JSON.stringify({ files }));
}
