// Reads a tree's files and JS sources either from the working tree or from a git ref (no checkout needed).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { trackedFiles } from './plan.mjs';

/** Runs git in `root` and returns stdout as a Buffer. */
export const readGit = (root, args, input) => execFileSync('git', args, { cwd: root, input, maxBuffer: 1 << 30 });

/** File contents at `ref`, read through one `git cat-file --batch` per chunk of names; yields [name, text]. */
export function* contentsAt(root, ref, names) {
  for (let start = 0; start < names.length; start += 400) {
    const chunk = names.slice(start, start + 400);
    const out = readGit(root, ['cat-file', '--batch'], chunk.map(name => `${ref}:${name}`).join('\n') + '\n');
    let at = 0;
    for (const name of chunk) {
      const eol = out.indexOf(10, at);
      const size = Number(out.subarray(at, eol).toString().split(' ')[2]);
      yield [name, out.subarray(eol + 1, eol + 1 + size).toString('utf8')];
      at = eol + 1 + size + 1;
    }
  }
}

/**
 * Returns { files: sorted paths, sources: [name, text] pairs of the JS files } for `ref`, or for the working tree
 * (tracked files as they are on disk) when `ref` is null.
 */
export function snapshot(root, ref = null) {
  const files = ref ? readGit(root, ['ls-tree', '-r', '--name-only', ref]).toString().split('\n').filter(Boolean).sort() : trackedFiles(root);
  const js = files.filter(name => /\.m?js$/.test(name));
  const sources = ref ? contentsAt(root, ref, js) : js.map(name => [name, fs.readFileSync(path.join(root, name), 'utf8')]);
  return { files, sources };
}
