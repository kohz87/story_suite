// Finds a file named as of the old layout on a checkout of either layout: where the name says, else where the layout rules put it.
import fs from 'node:fs';
import path from 'node:path';
import { loadLayoutRules } from '../codemod/load-layout-rules.mjs';
import { layoutMapper } from '../codemod/layout-map.mjs';

let mapper = null;

/** Repo-relative `rel` (posix, old layout) → the repo-relative path that exists in `root`: itself, else its layout-mapped home. */
export function atEitherLayout(root, rel) {
  if (fs.existsSync(path.join(root, rel))) return rel;
  mapper ??= layoutMapper(loadLayoutRules());
  const moved = mapper(rel);
  return fs.existsSync(path.join(root, moved)) ? moved : rel;
}

/** `name`, a path inside package `dir` as of the old layout → its path from that package folder (posix; `../..` when the file left it). */
export function fromPackage(root, dir, name) {
  const rel = atEitherLayout(root, path.posix.join(dir, name));
  return path.posix.relative(dir, rel);
}

const OLD_FILES = path.join(import.meta.dirname, '../../docs/merge/layout-old-files.txt');
let reverse = null;

/** New path → the one old path the frozen list (every file of main before the move that the rules move) sends there; throws if two do. */
function oldNames() {
  if (reverse) return reverse;
  mapper ??= layoutMapper(loadLayoutRules());
  reverse = new Map();
  for (const line of fs.readFileSync(OLD_FILES, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const moved = mapper(line);
    if (reverse.has(moved)) throw new Error(`layout-paths: ${reverse.get(moved)} and ${line} both move to ${moved}`);
    reverse.set(moved, line);
  }
  return reverse;
}

/**
 * Repo-relative `rel` (posix, as the layout has it now) → the name that file had in the old layout, read from the frozen list of old files.
 * A file the list does not send to `rel` (no rule moved it, or it was added after the move) keeps its name. Host-import depth in a bundle
 * is counted from this OLD location, because the host specifiers were not rewritten.
 */
export function oldLocation(rel) {
  return oldNames().get(rel) ?? rel;
}
