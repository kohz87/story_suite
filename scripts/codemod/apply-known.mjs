// Splits an apply run's stale strings, verify problems and failing moved tests into new ones and the ones a shrink-only list already names.

/** The test files a `node --test` output lists as failing ("test at <file>:<line>:<col>" lines). */
export function failedTestFiles(output) {
  return [...new Set([...output.matchAll(/^test at (\S+?):\d+:\d+$/gm)].map(match => match[1]))];
}

/**
 * `lines` are `stale <file> <value>` and `test <file>` (blank and `#` lines are dropped by the loader). Returns
 * { stale, tests, unused }: the report's stale entries that are not listed, the failing test files that are not
 * listed (all failing files when the output names none), and the listed lines that did not occur (to remove).
 */
export function splitApplyKnown(report, ran, lines) {
  const listed = new Set(lines);
  const used = new Set();
  const stale = report.stale.filter(item => {
    const line = `stale ${item.file} ${item.value}`;
    if (listed.has(line)) { used.add(line); return false; }
    return true;
  });
  let tests = [];
  if (ran && ran.status !== 0) {
    const failed = failedTestFiles(ran.output);
    tests = failed.length ? failed.filter(file => { const line = `test ${file}`; if (listed.has(line)) { used.add(line); return false; } return true; }) : ['(a test run failed and named no file)'];
  }
  return { stale, tests, unused: lines.filter(line => !used.has(line)) };
}

/** Drops the verify problems that a `stale <file> <value>` line names; returns { fresh, covered } (covered is a count). */
export function dropKnownProblems(problems, lines) {
  const listed = new Set(lines.filter(line => line.startsWith('stale ')));
  const fresh = problems.filter(problem => {
    const hit = /^(.+): package-relative string "(.*)" would go stale$/.exec(problem);
    return !(hit && listed.has(`stale ${hit[1]} ${hit[2]}`));
  });
  return { fresh, covered: problems.length - fresh.length };
}
