import fs from 'node:fs';
import path from 'node:path';
import { layoutMapper } from './layout-map.mjs';

// Splits an apply run's stale strings, verify problems and failing moved tests into new ones and the ones a shrink-only list already names.

/** The failing tests a `node --test` output lists, as `<file>:<line>` ("test at <file>:<line>:<col>" lines). */
export function failedTests(output) {
  return [...new Set([...output.matchAll(/^test at (\S+?:\d+):\d+$/gm)].map(match => match[1]))];
}

/**
 * The `stale <file> <value>` lines whose value still occurs in the file at its current path: `file` is named as of the
 * old layout, so it is looked for where the layout put it, then at its own path (a deleted or missing file has none).
 */
export function occurringStale(root, ruleSets, lines) {
  const map = layoutMapper(ruleSets);
  const found = new Set();
  for (const line of lines.filter(item => item.startsWith('stale '))) {
    const [, file, ...rest] = line.split(' ');
    const where = [map(file), file].map(name => path.join(root, name)).find(abs => fs.existsSync(abs));
    if (where && fs.readFileSync(where, 'utf8').includes(rest.join(' '))) found.add(line);
  }
  return found;
}

/**
 * `lines` are `stale <file> <value>` and `test <file>:<line>` (blank and `#` lines are dropped by the loader). Returns
 * { stale, tests, unused }: the report's stale entries that are not listed, the failing tests (file:line) that are not
 * listed (all of them when the output names none), and the listed lines that did not occur (to remove), only for files
 * this run moved (another area's lines are not its business). A `test` line is never unused when no tests ran. A `stale`
 * line is unused only when its value no longer occurs in the file (`occurring`, from `occurringStale`; without it none is).
 */
export function splitApplyKnown(report, ran, lines, occurring = null) {
  const listed = new Set(lines);
  const used = new Set();
  const stale = report.stale.filter(item => {
    const line = `stale ${item.file} ${item.value}`;
    if (listed.has(line)) { used.add(line); return false; }
    return true;
  });
  let tests = [];
  if (ran && ran.status !== 0) {
    const failed = failedTests(ran.output);
    tests = failed.length ? failed.filter(file => { const line = `test ${file}`; if (listed.has(line)) { used.add(line); return false; } return true; }) : ['(a test run failed and named no file)'];
  }
  const mine = new Set((report.plan?.moves ?? []).flatMap(move => [move.from, move.to]));
  const fileOf = line => line.split(' ')[1].replace(/:\d+$/, '');
  const gone = line => (line.startsWith('test ') ? Boolean(ran) : Boolean(occurring) && !occurring.has(line));
  return { stale, tests, unused: lines.filter(line => !used.has(line) && gone(line) && (!report.plan || mine.has(fileOf(line)))) };
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
