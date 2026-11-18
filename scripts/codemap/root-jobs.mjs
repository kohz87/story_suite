import { headerJob } from './header-job.mjs';

/**
 * Job sentences for files under the source roots (scripts/layout.json) that jobs.json does not cover: the
 * first sentence of the file's own opening comment. Returns a map from repo path to job; `explicit` wins.
 */
export function sourceRootJobs({ files, readSource, explicit }) {
  const jobs = {};
  for (const filePath of files) {
    if (explicit[filePath]) continue;
    const job = /\.(?:m?js|css|sh)$/.test(filePath) ? headerJob(readSource(filePath)) : null;
    if (job) jobs[filePath] = job;
  }
  return jobs;
}
