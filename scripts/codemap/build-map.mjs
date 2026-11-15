import { isTestFile } from '../checks/code-files.mjs';
import { countLines } from '../checks/count-lines.mjs';
import { exportNames } from './export-names.mjs';
import { parseModule } from './parse-module.mjs';
import { resolveSpecifier } from './resolve-spec.mjs';

export const MAX_EXPORTS = 4;
const MODULE_EXT = /\.(?:m?js|cjs)$/;
const REFUSED_EXT = /\.(?:jsx|tsx|ts|mts|cts)$/;
const EMPTY = { exports: [], imports: [], commonJs: false, facade: false };

function resolveInternalImports(filePath, specifiers, fileSet) {
  const resolved = specifiers.map(spec => resolveSpecifier(filePath, spec, fileSet)).filter(Boolean);
  return Array.from(new Set(resolved)).sort();
}

/**
 * Builds codemap rows and validation problems for a set of repo files.
 */
export function buildMap({ files, readSource, jobs }) {
  const sortedFiles = files.slice().sort();
  const fileSet = new Set(sortedFiles);
  const problems = [];
  const byPath = new Map();
  const parsedByPath = new Map();

  for (const filePath of sortedFiles) {
    const source = readSource(filePath);
    const parsed = MODULE_EXT.test(filePath) ? parseModule(source) : EMPTY;
    parsedByPath.set(filePath, parsed);
    const isTest = isTestFile(filePath);
    const imports = resolveInternalImports(filePath, parsed.imports, fileSet);

    if (REFUSED_EXT.test(filePath)) {
      problems.push(`${filePath}: JSX and TypeScript are not used in this repo`);
    } else if (parsed.exports.some(exp => exp.kind === 'unparsable')) {
      problems.push(`${filePath}: cannot be parsed as an ES module`);
    } else if (parsed.commonJs) {
      problems.push(`${filePath}: uses the name module/exports (CommonJS is not allowed here; rename it)`);
    }

    if (!isTest) {
      const rawJob = jobs[filePath];
      if (!rawJob || !rawJob.trim()) {
        problems.push(`${filePath}: no job sentence in docs/codemap/jobs.json`);
      }
    }

    byPath.set(filePath, {
      path: filePath,
      job: isTest ? '' : (jobs[filePath] ?? '').trim(),
      exports: parsed.exports.map(e => e.signature),
      imports,
      importedBy: [],
      lines: countLines(source),
      tests: [],
    });
  }

  // Star re-exports need every file parsed first, so the export limit is checked in a second pass.
  for (const filePath of sortedFiles) {
    if (isTestFile(filePath)) continue;
    const { names, unresolved } = exportNames(filePath, parsedByPath, fileSet);
    for (const from of new Set(unresolved)) problems.push(`${filePath}: export * from ${from} cannot be counted; list the names`);
    if (names.size > MAX_EXPORTS && !parsedByPath.get(filePath).facade) {
      problems.push(`${filePath}: ${names.size} exports (one job per file allows at most ${MAX_EXPORTS})`);
    }
  }

  for (const row of byPath.values()) {
    const importerIsTest = isTestFile(row.path);
    if (importerIsTest) {
      row.job = row.imports.length > 0 ? `Tests for ${row.imports.join(', ')}.` : 'Tests.';
    }
    for (const targetPath of row.imports) {
      const target = byPath.get(targetPath);
      target.importedBy.push(row.path);
      if (importerIsTest) target.tests.push(row.path);
    }
  }

  for (const row of byPath.values()) {
    row.importedBy.sort();
    row.tests.sort();
  }

  for (const jobPath of Object.keys(jobs)) {
    if (!fileSet.has(jobPath)) {
      problems.push(`${jobPath}: has a job in docs/codemap/jobs.json but the file does not exist`);
    }
  }

  problems.sort();
  return { rows: Array.from(byPath.values()), problems };
}
