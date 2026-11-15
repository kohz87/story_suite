import path from 'node:path';
import { isTestFile } from '../checks/code-files.mjs';
import { countLines } from '../checks/count-lines.mjs';
import { parseModule } from './parse-module.mjs';

export const MAX_EXPORTS = 4;
const MODULE_EXT = /\.(?:m?js|cjs|ts)$/;

function resolveInternalImports(filePath, specifiers, fileSet) {
  const dir = path.posix.dirname(filePath);
  const resolved = new Set();
  for (const spec of specifiers) {
    if (!spec.startsWith('./') && !spec.startsWith('../')) continue;
    const target = path.posix.normalize(path.posix.join(dir, spec));
    if (fileSet.has(target)) resolved.add(target);
  }
  return Array.from(resolved).sort();
}

// A file whose exports are all re-exports (a folder's index.js, or a facade kept for existing imports).
function isPureReexportFile(parsedExports) {
  return parsedExports.length > 0 && parsedExports.every(exp => exp.kind === 'reexport');
}

/**
 * Builds codemap rows and validation problems for a set of repo files.
 */
export function buildMap({ files, readSource, jobs }) {
  const sortedFiles = files.slice().sort();
  const fileSet = new Set(sortedFiles);
  const problems = [];
  const byPath = new Map();

  for (const filePath of sortedFiles) {
    const source = readSource(filePath);
    const parsed = MODULE_EXT.test(filePath) ? parseModule(source) : { exports: [], imports: [], commonJs: false };
    const isTest = isTestFile(filePath);
    const imports = resolveInternalImports(filePath, parsed.imports, fileSet);

    if (parsed.exports.some(exp => exp.kind === 'unparsable')) {
      problems.push(`${filePath}: cannot be parsed as an ES module`);
    } else if (parsed.commonJs) {
      problems.push(`${filePath}: CommonJS exports are not allowed here (use ES modules)`);
    }

    if (!isTest) {
      const rawJob = jobs[filePath];
      if (!rawJob || !rawJob.trim()) {
        problems.push(`${filePath}: no job sentence in docs/codemap/jobs.json`);
      }
      if (parsed.exports.length > MAX_EXPORTS && !isPureReexportFile(parsed.exports)) {
        problems.push(
          `${filePath}: ${parsed.exports.length} exports (one job per file allows at most ${MAX_EXPORTS})`,
        );
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
