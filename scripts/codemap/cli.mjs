import fs from 'node:fs';
import path from 'node:path';
import { listCodeFiles, listRepoFiles } from '../checks/code-files.mjs';
import { packageScopeProblems } from '../checks/package-scope.mjs';
import { loadLayout } from '../layout.mjs';
import { buildMap } from './build-map.mjs';
import { packageOutputs } from './package-outputs.mjs';
import { renderMap } from './render-map.mjs';
import { sourceRootJobs } from './root-jobs.mjs';

// CODEMAP_ROOT lets the tests run this CLI on a small throwaway repo.
const repoRoot = process.env.CODEMAP_ROOT ?? path.resolve(import.meta.dirname, '../..');
const mode = process.argv[2];

if (mode !== '--write' && mode !== '--check') {
  console.error('usage: node scripts/codemap/cli.mjs --write|--check');
  process.exit(1);
}

const allFiles = listCodeFiles(repoRoot);
const abs = relPath => path.join(repoRoot, relPath);
const readSource = relPath => fs.readFileSync(abs(relPath), 'utf8');
const readOptional = relPath => (fs.existsSync(abs(relPath)) ? readSource(relPath) : '');

const jobs = JSON.parse(readOptional('docs/codemap/jobs.json') || '{}');
const layout = loadLayout();
const rootFiles = allFiles.filter(p => !layout.isPackageFile(p));
const rootJobs = sourceRootJobs({ files: rootFiles.filter(layout.isSourceFile), readSource, readOptional, layout, repoRoot, explicit: jobs });
const built = buildMap({ files: rootFiles, readSource, jobs: { ...rootJobs, ...jobs }, isLegacyFile: layout.isPackageFile });
const problems = [...built.problems, ...packageScopeProblems(listRepoFiles(repoRoot), readSource, layout.isPackageFile)];
const outputs = [{ mapPath: 'docs/codemap.md', markdown: renderMap(built.rows), summary: `${built.rows.length} files` }];
for (const out of packageOutputs({ files: allFiles.filter(layout.isPackageFile), readSource, readOptional, layout })) {
  outputs.push(out);
  problems.push(...out.problems);
}
problems.sort();

let failed = problems.length > 0;
for (const problem of problems) console.error(problem);
for (const { mapPath, markdown, summary } of outputs) {
  if (mode === '--write') {
    fs.mkdirSync(path.dirname(abs(mapPath)), { recursive: true });
    fs.writeFileSync(abs(mapPath), markdown, 'utf8');
    console.log(`wrote ${mapPath} (${summary})`);
  } else if (readOptional(mapPath) !== markdown) {
    console.error(`${mapPath} is stale: run npm run codemap`);
    failed = true;
  } else {
    console.log(`code map: ${mapPath} ${summary}, up to date`);
  }
}
if (failed) process.exit(1);
