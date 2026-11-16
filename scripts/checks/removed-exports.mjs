import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIST = 'docs/merge/removed-exports.txt';

/** The names in the list text: one per line, blank lines and `#` lines skipped. */
export function removedNames(listText) {
  return listText.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
}

/** One problem string per (file, name) where a name from the list occurs as a word in the file's text. `files`: [{ path, text }]. */
export function removedExportProblems(names, files) {
  const problems = [];
  if (!names.length) return problems;
  const pattern = new RegExp(`\\b(${names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g');
  for (const file of files) {
    const seen = new Set();
    for (const match of file.text.matchAll(pattern)) seen.add(match[1]);
    for (const name of seen) problems.push(`${file.path}: ${name} was removed (${LIST})`);
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../..'));
  const names = removedNames(fs.readFileSync(path.join(root, LIST), 'utf8'));
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);
  const files = tracked
    .filter(name => /\.(m?js)$/.test(name) && !name.includes('/tests/') && !name.startsWith('tests/'))
    .map(name => ({ path: name, text: fs.readFileSync(path.join(root, name), 'utf8') }));
  const problems = removedExportProblems(names, files);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(`removed exports: none of ${names.length} names is used`);
}
