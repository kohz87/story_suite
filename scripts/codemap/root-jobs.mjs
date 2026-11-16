import { devMapJobs } from './dev-map-jobs.mjs';
import { headerJob } from './header-job.mjs';

/**
 * Job sentences for files under the source roots (scripts/layout.json) that jobs.json does not cover: first a
 * `- \`path\`: job` bullet in a package's docs/dev/codemap.md (the path read as a repo path), then the first
 * sentence of the file's own opening comment. Returns a map from repo path to job; `explicit` wins.
 */
export function sourceRootJobs({ files, readSource, readOptional, layout, repoRoot, explicit }) {
  const bullets = {};
  for (const dir of layout.packageDirs(repoRoot)) {
    Object.assign(bullets, devMapJobs(readOptional(`${dir}/${layout.packageDevMap}`)));
  }
  const jobs = {};
  for (const filePath of files) {
    if (explicit[filePath]) continue;
    const job = bullets[filePath] ?? (/\.(?:m?js|css|sh)$/.test(filePath) ? headerJob(readSource(filePath)) : null);
    if (job) jobs[filePath] = job;
  }
  return jobs;
}
