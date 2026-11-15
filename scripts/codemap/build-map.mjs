import { isTestFile } from '../checks/code-files.mjs';
import { countLines } from '../checks/count-lines.mjs';
import { nulProblem } from '../checks/nul-check.mjs';
import { exportNames } from './export-names.mjs';
import { parseModule } from './parse-module.mjs';
import { resolveSpecifier } from './resolve-spec.mjs';

export const MAX_EXPORTS = 4;
const MODULE_EXT = /\.(?:m?js|cjs)$/;
// Parsed (or refused) languages, plus style, the UI harness page (html) and the allowed script types, which are listed but not parsed.
const MAPPED_EXT = /\.(?:m?js|cjs|jsx|tsx|ts|mts|cts|css|html|sh|bash|py|ya?ml)$/;
const REFUSED_EXT = /\.(?:jsx|tsx|ts|mts|cts)$/;
// Makefile and Dockerfile hold build commands: they get a job row (no exports parsed). The rest are only size-checked.
const BUILD_FILES = new Set(['Makefile', 'Dockerfile']);
const EXTENSIONLESS_OK = new Set(['Makefile', 'Dockerfile', '.gitignore', '.gitattributes', '.nvmrc', '.npmrc', 'CODEOWNERS']);
const EMPTY = { exports: [], imports: [], commonJs: false, facade: false };

function resolveInternalImports(filePath, specifiers, fileSet) {
  const resolved = specifiers.map(spec => resolveSpecifier(filePath, spec, fileSet)).filter(Boolean);
  return Array.from(new Set(resolved)).sort();
}

/**
 * Builds codemap rows and validation problems for a set of repo files.
 */
export function buildMap({ files, readSource, jobs }) {
  const problems = [];
  const sortedFiles = [];
  const jsFiles = new Set();
  for (const filePath of files.slice().sort()) {
    const nul = nulProblem(filePath, readSource(filePath));
    if (nul) problems.push(nul);
    if (MODULE_EXT.test(filePath)) jsFiles.add(filePath);
    if (MAPPED_EXT.test(filePath)) { sortedFiles.push(filePath); continue; }
    // Outside packages/ every file needs an extension (a script without one hides its language); only
    // these well-known names are accepted, as text that is size-checked but not parsed.
    const base = filePath.split('/').pop();
    const extensionless = !base.replace(/^\.+/, '').includes('.');
    if (!extensionless) problems.push(`${filePath}: this language is not used in this repo`);
    else if (!filePath.startsWith('packages/') && !EXTENSIONLESS_OK.has(base)) problems.push(`${filePath}: files need an extension here`);
    else if (BUILD_FILES.has(base)) sortedFiles.push(filePath);
  }
  const fileSet = new Set(sortedFiles);
  const byPath = new Map();
  const parsedByPath = new Map();

  for (const filePath of sortedFiles) {
    const source = readSource(filePath);
    const parsed = jsFiles.has(filePath) ? parseModule(source) : EMPTY;
    parsedByPath.set(filePath, parsed);
    const isTest = isTestFile(filePath);
    const imports = resolveInternalImports(filePath, parsed.imports, fileSet);

    if (REFUSED_EXT.test(filePath)) {
      problems.push(`${filePath}: JSX and TypeScript are not used in this repo`);
    } else if (parsed.exports.some(exp => exp.kind === 'unparsable')) {
      problems.push(`${filePath}: cannot be parsed as an ES module`);
    } else if (filePath.endsWith('.cjs')) {
      problems.push(`${filePath}: CommonJS is not allowed here`);
    } else if (parsed.commonJs) {
      problems.push(`${filePath}: uses the name module, exports, require, __filename or __dirname (CommonJS is not allowed here; rename it)`);
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
  // Test files and test helpers under tests/ are exempt from the export cap only; an uncountable
  // `export * from` is still a problem for them.
  for (const filePath of sortedFiles) {
    const { names, unresolved } = exportNames(filePath, parsedByPath, fileSet);
    for (const from of new Set(unresolved)) problems.push(`${filePath}: export * from ${from} cannot be counted; list the names`);
    if (!isTestFile(filePath) && names.size > MAX_EXPORTS && !parsedByPath.get(filePath).facade) {
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
