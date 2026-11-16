import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The page globals and DOM flags NPC State and Story Suite v1 used to publish stay gone (B3 F2). A hit in core/, ui/, modules/ or
// packs/ fails the check unless its file is on docs/merge/global-exceptions.txt, a list that may only shrink and whose entries must
// still have a hit. StoryBlock and the browser APIs (window.confirm and the like) are not on the list.
const EXCEPTIONS = 'docs/merge/global-exceptions.txt';
const ROOTS = ['core/', 'ui/', 'modules/', 'packs/'];
const PATTERNS = [
  /\bNPCStateDelta(Cast)?\b/,
  /(globalThis|window)\.StorySuite\b/,
  /data-npc-state-delta-(story-block|launcher)/,
  /\bnpcStateDelta(StoryBlock|Launcher)(V2)?\b/,
];

/** The exception paths in the list text: one per line, blank lines and `#` lines skipped. */
export function exceptionPaths(text) {
  return new Set(text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')));
}

/** The paths from `files` ([{ path, text }]) under a scanned root whose text names a removed global or flag. */
export function globalHits(files) {
  return files.filter(file => ROOTS.some(root => file.path.startsWith(root)) && PATTERNS.some(pattern => pattern.test(file.text))).map(file => file.path);
}

/** Problems: a hit outside the exceptions, an exception without a hit, an exception the base list did not have (`base`: a Set, or null for a first list). */
export function gateProblems({ hits, exceptions, base = null }) {
  const problems = [];
  for (const hit of hits) if (!exceptions.has(hit)) problems.push(`${hit}: names a removed global or DOM flag`);
  for (const entry of exceptions) {
    if (!hits.includes(entry)) problems.push(`${entry}: on ${EXCEPTIONS} but has no hit; take it off the list`);
    if (base && !base.has(entry)) problems.push(`${entry}: added to ${EXCEPTIONS}; the list may only shrink`);
  }
  return problems.sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, '../..');
  const baseRef = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : null;
  let base = null;
  if (baseRef) {
    try { base = exceptionPaths(execFileSync('git', ['show', `${baseRef}:${EXCEPTIONS}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { base = null; }
  }
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);
  const files = tracked.filter(name => ROOTS.some(r => name.startsWith(r)) && /\.(m?js|css|html)$/.test(name) && fs.existsSync(path.join(root, name)))
    .map(name => ({ path: name, text: fs.readFileSync(path.join(root, name), 'utf8') }));
  const listPath = path.join(root, EXCEPTIONS);
  const exceptions = exceptionPaths(fs.existsSync(listPath) ? fs.readFileSync(listPath, 'utf8') : '');
  const problems = gateProblems({ hits: globalHits(files), exceptions, base });
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(`globals gate: no removed global or flag outside the ${exceptions.size} listed files`);
}
