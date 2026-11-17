/**
 * The per-unit removal recipe in one command: backup, git rm, dead-export check, git grep empty, shrink-only lists, code map, touched tests.
 * `node scripts/b4/unit.mjs <unit> --entries <file> [--grep <text>]... [--test <folder>]... [--base origin/main] [--to <backup root>] [--plan]`.
 * The entries file is the dead-exports format (path, dir/, path#name). Stops at the first failing step and says which one.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BACKUP_ROOT, backupFiles } from './backup.mjs';
import { deadExportProblems, parseEntries } from './dead-exports.mjs';
import { LISTS, addedEntries, staleEntries } from './shrink.mjs';

const TEXT_FILE = /\.(m?js|cjs|json|css|html)$/;
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
const tracked = root => git(root, ['ls-files', '-z']).split('\0').filter(Boolean);
const readLines = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** The tracked files an entries set removes (files, plus everything under each `dir/`). */
export function removedFiles(entries, all) {
  return all.filter(p => entries.files.has(p) || entries.dirs.some(d => p.startsWith(d)));
}

/** The ordered steps for a unit. Each `run()` returns a list of problem strings (empty = pass); `--plan` prints only the names. */
export function recipeSteps({ root, unit, entries, greps, tests, base, to }) {
  const all = tracked(root);
  const gone = removedFiles(entries, all);
  const run = (cmd, args) => () => (spawnSync(cmd, args, { cwd: root, stdio: 'inherit' }).status === 0 ? [] : [`${cmd} ${args.join(' ')} failed`]);
  return [
    { name: 'backup', run: () => { backupFiles({ root, unit, dest: path.join(to, unit), paths: gone, commitOf: p => git(root, ['log', '-1', '--format=%h', '--', p]).trim() }); return []; } },
    { name: 'git rm', run: () => { git(root, ['rm', '-q', '--', ...gone]); return []; } },
    { name: 'dead exports', run: () => {
      const files = tracked(root).filter(p => TEXT_FILE.test(p)).map(p => ({ path: p, text: readLines(root, p) }));
      const { problems, byHand } = deadExportProblems(entries, files, new Set(all));
      if (byHand.length) console.log(`computed specifiers, grep by hand:\n  ${byHand.join('\n  ')}`);
      return problems;
    } },
    { name: 'git grep empty', run: () => greps.flatMap(text => {
      const hit = spawnSync('git', ['grep', '-n', '-F', '-e', text, '--', '.', ':!docs/history', ':!CHANGELOG.md'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
      return hit.status === 1 ? [] : [`git grep "${text}" still finds:\n${hit.stdout}`];
    }) },
    { name: 'shrink-only lists', run: () => LISTS.flatMap(list => {
      const before = spawnSync('git', ['show', `${base}:${list}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
      const text = fs.existsSync(path.join(root, list)) ? readLines(root, list) : '';
      return [...addedEntries(before.status === 0 ? before.stdout : '', text).map(l => `${list}: entry added: ${l}`),
        ...staleEntries(text, { files: new Set(gone), dirs: entries.dirs }).map(l => `${list}: entry names a removed path, take it off: ${l}`)];
    }) },
    { name: 'code map', run: () => [...run('npm', ['run', 'codemap'])(), ...run('node', ['scripts/codemap/cli.mjs', '--check'])()] },
    { name: 'touched tests', run: tests.length ? run('node', ['--test', ...tests.map(t => `${t}/**/*.test.js`)]) : () => ['no --test folder given: name the touched test folders'] },
  ];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [unit, ...rest] = process.argv.slice(2);
  const opt = (flag, many) => rest.flatMap((a, i) => (a === flag ? [rest[i + 1]] : [])).slice(0, many ? undefined : 1);
  const entriesFile = opt('--entries')[0];
  if (!unit || unit.startsWith('--') || !entriesFile) { console.error('usage: unit.mjs <unit> --entries <file> [--grep text]... [--test folder]... [--base ref] [--to dir] [--plan]'); process.exit(2); }
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const steps = recipeSteps({ root, unit, entries: parseEntries(fs.readFileSync(entriesFile, 'utf8')), greps: opt('--grep', true), tests: opt('--test', true), base: opt('--base')[0] ?? 'origin/main', to: opt('--to')[0] ?? BACKUP_ROOT });
  if (rest.includes('--plan')) { console.log(steps.map((s, i) => `${i + 1}. ${s.name}`).join('\n')); process.exit(0); }
  for (const step of steps) {
    console.log(`== ${step.name}`);
    const problems = step.run();
    if (problems.length) { console.error(`${step.name} failed:\n${problems.join('\n')}`); process.exit(1); }
  }
  console.log(`unit ${unit}: every step passed`);
}
