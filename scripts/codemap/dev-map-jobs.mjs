/**
 * Reads a package's hand-written docs/dev/codemap.md bullets (`- \`path\`: job`) into a map from
 * package-relative path to job sentence.
 */
export function devMapJobs(text) {
  const jobs = {};
  for (const line of (text ?? '').split('\n')) {
    const match = /^- `([^`]+)`: (.+?)\s*$/.exec(line);
    if (match && !(match[1] in jobs)) jobs[match[1]] = match[2];
  }
  return jobs;
}
