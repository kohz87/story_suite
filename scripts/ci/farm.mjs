import fs from 'node:fs';
import path from 'node:path';
import { loadLayout } from '../layout.mjs';

/**
 * Makes the sibling-folder farm some cross-package tests look in (STORY_SUITE_ROOT/<link>), from scripts/layout.json's
 * suiteFarm. An entry is a link to `dir`; with `at` the link is a folder holding `at` (a path inside it) that points to `dir`; with `files` it is a folder holding those names (inside it), each pointing to the repo file named,
 * so a tool that moved into the one tree still has the old folder shape beside it. Returns the folder it filled.
 */
export function makeFarm(repoRoot, farmRoot) {
  for (const { link, dir, at, files } of loadLayout(repoRoot).suiteFarm) {
    if (files) {
      for (const [name, real] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(farmRoot, link, name)), { recursive: true });
        fs.symlinkSync(path.join(repoRoot, real), path.join(farmRoot, link, name));
      }
      continue;
    }
    const target = path.join(repoRoot, dir);
    if (!at) { fs.symlinkSync(target, path.join(farmRoot, link)); continue; }
    fs.mkdirSync(path.dirname(path.join(farmRoot, link, at)), { recursive: true });
    fs.symlinkSync(target, path.join(farmRoot, link, at));
  }
  return farmRoot;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  console.log(makeFarm(path.resolve(process.argv[2]), path.resolve(process.argv[3])));
}
