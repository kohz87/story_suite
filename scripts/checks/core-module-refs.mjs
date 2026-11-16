// The core-module gate: the core's turn, prompt, sdk, registry, commands, interaction and old-view host code names no RPG or fight-board word, except the lines in docs/merge/core-module-refs.txt (which may only shrink).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIST = 'docs/merge/core-module-refs.txt';
const WORDS = /lean-rpg|board|fight|RPG_|rpgLib/i;
const SCOPE = /^(core\/(turn|turn-parts|prompt|prompt-parts|sdk|sdk-parts|registry|registry-parts|commands|commands-parts|interaction)(\/|\.js$)|ui\/legacy\/ui-host(\/|\.js$))/;
const SEP = ' :: ';

/** A line without its comment: a whole-line comment is empty, a trailing `// …` after a space is cut. */
export function codePart(line) {
  const text = line.trim();
  if (text.startsWith('//') || text.startsWith('*') || text.startsWith('/*')) return '';
  return text.replace(/\s\/\/.*$/, '').trim();
}

/** The sorted, de-duplicated `path :: code line` entries of every in-scope line that has a word. `files`: [{ path, text }]. */
export function moduleRefHits(files) {
  const hits = new Set();
  for (const file of files) {
    if (!SCOPE.test(file.path) || !/\.m?js$/.test(file.path)) continue;
    for (const line of file.text.split(/\r?\n/)) {
      const code = codePart(line);
      if (code && WORDS.test(code)) hits.add(`${file.path}${SEP}${code}`);
    }
  }
  return [...hits].sort();
}

/** The entries of the list text: one per line, blank lines and `#` lines skipped. */
export function parseRefList(text) {
  return new Set(text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')));
}

/** One problem per unlisted hit, per listed entry that no line matches any more (remove it), and per entry the base list did not have. */
export function moduleRefProblems(hits, listed, base = null) {
  const problems = [];
  const found = new Set(hits);
  for (const hit of hits) if (!listed.has(hit)) problems.push(`${hit.replace(SEP, ': ')}: a core file names an RPG or fight word; move it into its module or, for a reviewed exception, list it in ${LIST}`);
  for (const entry of listed) if (!found.has(entry)) problems.push(`${entry.replace(SEP, ': ')}: listed in ${LIST} but no line matches; remove it (the list only shrinks)`);
  if (base) for (const entry of listed) if (!base.has(entry)) problems.push(`${entry.replace(SEP, ': ')}: added to ${LIST}`);
  return problems.sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, '../..');
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  const tracked = git(['ls-files', '-z']).split('\0').filter(name => SCOPE.test(name));
  const hits = moduleRefHits(tracked.map(name => ({ path: name, text: fs.readFileSync(path.join(root, name), 'utf8') })));
  const listed = parseRefList(fs.readFileSync(path.join(root, LIST), 'utf8'));
  const flag = process.argv.indexOf('--base');
  let base = null;
  if (flag >= 0) {
    const ref = process.argv[flag + 1];
    if (!ref) { console.error('core module refs: --base needs a git ref'); process.exit(1); }
    try { base = parseRefList(git(['show', `${ref}:${LIST}`])); } catch { base = null; } // a base before the list has nothing to compare
  }
  const problems = moduleRefProblems(hits, listed, base);
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log(`core module refs: ${hits.length} listed lines, none new`);
}
