/**
 * Dead-export check for a removal: fails when a kept file still refers to a removed path, or to a removed export name of a path.
 * Entries are `path` (a file), `dir/` (everything under it) or `path#name`. Reads every relative specifier written as a string, so static imports,
 * re-exports, `import('./x.js')` and `new URL('./x.js', import.meta.url)` are all caught; computed ones are returned for a hand grep.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseModule } from '../codemap/parse-module.mjs';

const STRING_SPEC = /(['"`])(\.{1,2}\/[^'"`\n]*?)\1/g;
const CSS_URL = /url\(\s*(\.{1,2}\/[^)'"\s]*)\s*\)/g;
const COMPUTED = /\bimport\(\s*(?!['"`][^'"`$]*['"`]\s*\))|new\s+URL\(\s*(?!['"][^'"]*['"])[^)]*import\.meta\.url/;

/** Splits entry lines (blank and `#` lines skipped) into { files, dirs, names } where names maps path -> Set of export names. */
export function parseEntries(text) {
  const out = { files: new Set(), dirs: [], names: new Map() };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [file, name] = line.split('#');
    if (name) { if (!out.names.has(file)) out.names.set(file, new Set()); out.names.get(file).add(name); } else if (file.endsWith('/')) out.dirs.push(file);
    else out.files.add(file);
  }
  return out;
}

const isRemoved = (entries, p) => entries.files.has(p) || entries.dirs.some(d => p.startsWith(d));

function targets(file, spec, fileSet) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec.split(/[?#]/)[0]));
  return [base, `${base}.js`, `${base}/index.js`].filter(p => fileSet.has(p));
}

/**
 * `files`: [{ path, text }] of the whole tracked tree; `fileSet`: all tracked paths before the removal. Files that are themselves removed are not checked.
 * Returns { problems, byHand }: `problems` one string per (kept file, removed target), `byHand` the kept files with a computed import or URL.
 */
export function deadExportProblems(entries, files, fileSet) {
  const problems = [];
  const byHand = [];
  for (const file of files) {
    if (isRemoved(entries, file.path)) continue;
    const hits = new Set();
    for (const re of [STRING_SPEC, CSS_URL]) {
      for (const m of file.text.matchAll(re)) {
        for (const t of targets(file.path, m[2] ?? m[1], fileSet)) if (isRemoved(entries, t)) hits.add(t);
      }
    }
    for (const t of hits) problems.push(`${file.path}: refers to removed ${t}`);
    if (/\.m?js$/.test(file.path) && entries.names.size) {
      const parsed = parseModule(file.text);
      const links = [...Object.values(parsed.importBindings), ...parsed.exports.filter(e => e.from !== undefined).map(e => ({ from: e.from, imported: e.local ?? e.name }))];
      for (const link of links) {
        for (const t of targets(file.path, link.from, fileSet)) {
          const names = entries.names.get(t);
          if (names && (names.has(link.imported) || link.imported === '*')) problems.push(`${file.path}: imports removed export ${t}#${link.imported}`);
        }
      }
    }
    if (/\.m?js$/.test(file.path) && COMPUTED.test(file.text)) byHand.push(file.path);
  }
  return { problems, byHand };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entriesFile = process.argv[2];
  if (!entriesFile) { console.error('usage: dead-exports.mjs <entries file>   (lines: path, dir/ or path#name)'); process.exit(2); }
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const all = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);
  const files = all.filter(p => /\.(m?js|cjs|json|css|html)$/.test(p)).map(p => ({ path: p, text: fs.readFileSync(path.join(root, p), 'utf8') }));
  const { problems, byHand } = deadExportProblems(parseEntries(fs.readFileSync(entriesFile, 'utf8')), files, new Set(all));
  if (byHand.length) console.log(`computed specifiers, grep by hand:\n  ${byHand.join('\n  ')}`);
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('dead exports: no kept file refers to a removed path or export');
}
