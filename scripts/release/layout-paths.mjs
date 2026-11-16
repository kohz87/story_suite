// Finds a file named as of the old layout on a checkout of either layout: where the name says, else where the layout rules put it.
import fs from 'node:fs';
import path from 'node:path';
import { loadLayoutRules } from '../codemod/cli.mjs';
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
