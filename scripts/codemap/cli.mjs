import fs from 'node:fs';
import path from 'node:path';
import { listCodeFiles } from '../checks/code-files.mjs';
import { buildMap } from './build-map.mjs';
import { renderMap } from './render-map.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const mode = process.argv[2];

if (mode !== '--write' && mode !== '--check') {
  console.error('usage: node scripts/codemap/cli.mjs --write|--check');
  process.exit(1);
}

const files = listCodeFiles(repoRoot).filter(p => !p.startsWith('packages/'));
const jobsPath = path.join(repoRoot, 'docs/codemap/jobs.json');
const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
const readSource = relPath => fs.readFileSync(path.join(repoRoot, relPath), 'utf8');

const { rows, problems } = buildMap({ files, readSource, jobs });
const rendered = renderMap(rows);
const mapPath = path.join(repoRoot, 'docs/codemap.md');

if (mode === '--write') {
  fs.mkdirSync(path.dirname(mapPath), { recursive: true });
  fs.writeFileSync(mapPath, rendered, 'utf8');
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  console.log(`wrote docs/codemap.md (${rows.length} files)`);
  process.exit(0);
}

const current = fs.existsSync(mapPath) ? fs.readFileSync(mapPath, 'utf8') : '';
let failed = false;
if (current !== rendered) {
  console.error('docs/codemap.md is stale: run npm run codemap');
  failed = true;
}
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  failed = true;
}
if (failed) process.exit(1);

console.log(`code map: ${rows.length} files, up to date`);
