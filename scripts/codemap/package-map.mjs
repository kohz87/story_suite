import { buildMap, MAX_EXPORTS } from './build-map.mjs';
import { devMapJobs } from './dev-map-jobs.mjs';
import { headerJob } from './header-job.mjs';
import { renderFeatures } from './package-features.mjs';
import { renderMap } from './render-map.mjs';

// Job sentence order: the package's docs/codemap/jobs-<pkg>.json, then its hand-written docs/dev/codemap.md,
// then the first sentence of the file's own opening comment. A file with none of them is a problem.
function resolveJobs({ prefix, files, readSource, explicit, devMap }) {
  const jobs = {};
  for (const filePath of files) {
    const rel = filePath.slice(prefix.length);
    const job = explicit[rel] ?? devMap[rel] ?? (/\.(?:m?js|css|sh)$/.test(rel) ? headerJob(readSource(filePath)) : null);
    if (job) jobs[filePath] = job;
  }
  return jobs;
}

const stripAll = (prefix, list) => list.map(p => p.slice(prefix.length));

/**
 * One package's map: a row for every code file (tests and helpers included), the feature entry-point
 * index and the one-job-per-file backlog. `files` are repo paths under packages/<pkg>/; the rendered
 * paths are relative to the package. Returns the markdown, the problems and the backlog count.
 */
export function packageMap({ pkg, prefix = `packages/${pkg}/`, files, readSource, explicitJobs = {}, devMapText = '', features = [] }) {
  const jobsFile = `docs/codemap/jobs-${pkg}.json`;
  const jobs = resolveJobs({ prefix, files, readSource, explicit: explicitJobs, devMap: devMapJobs(devMapText) });
  for (const rel of Object.keys(explicitJobs)) jobs[prefix + rel] = explicitJobs[rel];
  const built = buildMap({ files, readSource, jobs, jobsFile, legacyPackage: true });
  const rows = built.rows.map(row => ({
    ...row,
    job: row.job.replaceAll(prefix, ''),
    path: row.path.slice(prefix.length),
    imports: stripAll(prefix, row.imports),
    importedBy: stripAll(prefix, row.importedBy),
    tests: stripAll(prefix, row.tests),
  }));
  const featureOut = renderFeatures(features, new Set(rows.map(r => r.path)), `docs/codemap/features-${pkg}.json`);
  const backlog = [
    '', '## One job per file: backlog', '',
    `Files with more than ${MAX_EXPORTS} exports (legacy; pure re-export facades are exempt; split when moving out of \`packages/\`).`,
  ];
  if (built.overLimit.length > 0) backlog.push('');
  for (const { path: p, count } of built.overLimit) backlog.push(`- \`${p.slice(prefix.length)}\`: ${count} exports`);
  const header = renderMap(rows, {
    title: `Code map: ${prefix.slice(0, -1)}`,
    source: `each file's job sentence (${jobsFile}, the package's docs/dev/codemap.md, or the file's opening comment) and the source`,
  });
  return {
    markdown: header.replace(/\n$/, '') + '\n' + [...featureOut.lines, ...backlog].join('\n') + '\n',
    problems: [...built.problems, ...featureOut.problems].sort(),
    backlog: built.overLimit.length,
    rows: rows.length,
    lines: rows.reduce((n, r) => n + r.lines, 0),
  };
}
