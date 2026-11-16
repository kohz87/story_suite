// Finds a file named as of the old layout on a checkout of either layout: where the name says, else where the layout rules put it.
import fs from 'node:fs';
import path from 'node:path';
import { loadLayoutRules } from '../codemod/cli.mjs';
import { layoutMapper } from '../codemod/layout-map.mjs';
import { ruleKey } from '../codemod/rules.mjs';

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

let reverse = null;
const found = new Map();

/**
 * Repo-relative `rel` (posix, as the layout has it now) → the name that file had in the old layout, found by running the rules
 * backwards and keeping the candidate the rules really send to `rel` (the longest matching rule wins). A file no rule moved keeps its name.
 */
export function oldLocation(rel) {
  if (found.has(rel)) return found.get(rel);
  const sets = loadLayoutRules();
  mapper ??= layoutMapper(sets);
  reverse ??= sets.flatMap(set => set.rules).filter(rule => rule.to !== null);
  let best = null;
  for (const rule of reverse) {
    const to = rule.to.replace(/\*$/, '');
    if (!(rule.from.endsWith('*') ? rel.startsWith(to) : rel === to || rel.startsWith(`${to}/`))) continue;
    const candidate = ruleKey(rule) + rel.slice(to.length);
    if (mapper(candidate) === rel && (!best || to.length > best.to.length)) best = { to, candidate };
  }
  const old = best ? best.candidate : rel;
  found.set(rel, old);
  return old;
}
