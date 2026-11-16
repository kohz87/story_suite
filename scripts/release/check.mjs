import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BUNDLE_SETS } from './entries.mjs';
import { buildBundleSet } from './bundle.mjs';
import { walkBundle } from './graph.mjs';
import { strayImportMeta } from './rewrite.mjs';
import { assertSafeOut } from './outdir.mjs';

export const RELEASE_VERSION = '0.1.0';
export const MAX_REQUESTS = 10;

// The release gate: the version is 0.1.0, nothing is tagged for it, and each bundle set builds, keeps its
// source maps, resolves every import() it contains, keeps import.meta.url pointing at the source location and loads in at most MAX_REQUESTS files. Returns
// { problems, rows }, one row per bundle set (name, bytes, requests, lazy chunks).
export async function checkRelease({ repoRoot, outRoot, sets = BUNDLE_SETS }) {
  assertSafeOut(outRoot, repoRoot);
  const problems = [];
  const version = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;
  if (version !== RELEASE_VERSION) problems.push(`package.json version is ${version}, the release is ${RELEASE_VERSION}`);
  const lockVersion = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8')).version;
  if (lockVersion !== version) problems.push(`package-lock.json version is ${lockVersion}, package.json says ${version}`);
  const tags = execFileSync('git', ['tag', '--list'], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(tag => tag.replace(/^[a-z-]*v?/i, '') === RELEASE_VERSION);
  if (tags.length) problems.push(`releases are not tagged; found tag ${tags.join(', ')}`);
  const rows = [];
  for (const set of sets) {
    const outDir = path.join(outRoot, set.name);
    const files = await buildBundleSet(set, outDir, repoRoot);
    const code = files.filter(file => file.endsWith('.js'));
    for (const file of code) if (!files.includes(`${file}.map`)) problems.push(`${set.name}: ${file} has no source map`);
    for (const file of code) if (strayImportMeta(fs.readFileSync(path.join(outDir, file), 'utf8'))) problems.push(`${set.name}: ${file} uses import.meta in a form the bundle does not rewrite`);
    const bytes = code.reduce((sum, file) => sum + fs.statSync(path.join(outDir, file)).size, 0);
    let requests = 0;
    let lazy = 0;
    for (const entry of set.entries.map(file => path.basename(file))) {
      const graph = walkBundle(outDir, entry);
      for (const gap of graph.missing) problems.push(`${set.name}: unresolved import ${gap}`);
      requests += graph.loaded.length;
      lazy += graph.lazy.length;
    }
    if (requests > MAX_REQUESTS) problems.push(`${set.name}: ${requests} requests at load, the limit is ${MAX_REQUESTS}`);
    rows.push({ name: set.name, bytes, requests, lazy });
  }
  return { problems, rows };
}
