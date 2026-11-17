import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BUNDLE_SETS } from './entries.mjs';
import { buildBundleSet } from './bundle.mjs';
import { walkBundle } from './graph.mjs';
import { strayImportMeta } from './rewrite.mjs';
import { assertSafeOut } from './outdir.mjs';
import { versionProblems } from './versions.mjs';
import { stylesheetRequests } from './css.mjs';

export const RELEASE_VERSION = '0.1.0';
export const MAX_REQUESTS = 10;

// The bundle's chunk name for a module or chunk file: 'modules/rpg/view/index.js' and 'view-RM242NFQ.js' both give 'view' (esbuild names a chunk after its module's folder when the module is index.js).
const chunkOf = file => { const base = path.basename(file, '.js').replace(/-[A-Z0-9]{8}$/, ''); return base === 'index' ? path.basename(path.dirname(file)) : base; };

// The release gate: the version is 0.1.0 and every place that carries it agrees, nothing is tagged for it, and each bundle set builds, keeps its
// source maps, resolves every import() it contains, keeps import.meta.url pointing at the source location and loads in at most MAX_REQUESTS files (JS and CSS together; the stylesheet is joined into one). Returns
// { problems, rows }, one row per bundle set (name, bytes, requests, lazy chunks). afterBuild(outDir, set), when given, runs on each built set before it is measured (tests use it to plant a bad build).
export async function checkRelease({ repoRoot, outRoot, sets = BUNDLE_SETS, afterBuild = null }) {
  assertSafeOut(outRoot, repoRoot);
  const problems = [];
  const version = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;
  if (version !== RELEASE_VERSION) problems.push(`package.json version is ${version}, the release is ${RELEASE_VERSION}`);
  problems.push(...versionProblems(repoRoot, version));
  const tags = execFileSync('git', ['tag', '--list'], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(tag => tag.replace(/^[a-z-]*v?/i, '') === RELEASE_VERSION);
  if (tags.length) problems.push(`releases are not tagged; found tag ${tags.join(', ')}`);
  const rows = [];
  for (const set of sets) {
    const outDir = path.join(outRoot, set.name);
    const files = await buildBundleSet(set, outDir, repoRoot);
    if (afterBuild) await afterBuild(outDir, set);
    const code = files.filter(file => file.endsWith('.js'));
    for (const file of code) if (!files.includes(`${file}.map`)) problems.push(`${set.name}: ${file} has no source map`);
    for (const file of code) if (strayImportMeta(fs.readFileSync(path.join(outDir, file), 'utf8'))) problems.push(`${set.name}: ${file} uses import.meta in a form the bundle does not rewrite`);
    const bytes = code.reduce((sum, file) => sum + fs.statSync(path.join(outDir, file)).size, 0);
    const loaded = new Set();
    const fetchedLater = new Set();
    for (const entry of set.entries.map(file => path.basename(file))) {
      const graph = walkBundle(outDir, entry);
      for (const gap of graph.missing) problems.push(`${set.name}: unresolved import ${gap}`);
      for (const file of graph.loaded) loaded.add(file);
      // A chunk the entry awaits at start (`eager`) is a request of the load, with what it pulls in.
      for (const file of graph.lazy) {
        const own = chunkOf(file);
        if ((set.eager ?? []).some(module => chunkOf(module) === own)) for (const extra of walkBundle(outDir, file).loaded) loaded.add(extra);
        else fetchedLater.add(file);
      }
    }
    const cssEntry = fs.existsSync(path.join(repoRoot, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8')).css : null;
    if (cssEntry && !fs.existsSync(path.join(outDir, cssEntry))) problems.push(`${set.name}: the manifest names the stylesheet ${cssEntry} and the build has none`);
    const requests = loaded.size + stylesheetRequests(outDir, cssEntry);
    const lazy = [...fetchedLater].filter(file => !loaded.has(file)).length;
    if (requests > MAX_REQUESTS) problems.push(`${set.name}: ${requests} requests at load, the limit is ${MAX_REQUESTS}`);
    rows.push({ name: set.name, bytes, requests, lazy });
  }
  return { problems, rows };
}
