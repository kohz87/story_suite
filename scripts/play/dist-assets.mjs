// Copies the files the bundles reach by URL (CSS, fonts, images) into the same folder as their bundle.

import fs from 'node:fs';
import path from 'node:path';
import { oldLocation } from '../release/layout-paths.mjs';

const RUNTIME_FILE = /\.(css|woff2?|ttf|otf|png|jpe?g|webp|gif|svg)$/i;

function copyTree(from, to) {
  if (!fs.existsSync(from)) return;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(source, target);
    else if (entry.isFile() && RUNTIME_FILE.test(entry.name)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
  }
}

// The new roots hold the files the old package folders held. The bundle names every module by its OLD place in the package
// (import.meta.url is rewritten to it), so a stylesheet, font or image beside a moved module is copied to its old place under the set's folder.
const NEW_ROOTS = ['core', 'modules', 'ui', 'assets'];

function copyMoved(sourceDir, outDir, set) {
  const walk = rel => fs.readdirSync(path.join(sourceDir, rel), { withFileTypes: true }).flatMap(entry => {
    const child = `${rel}/${entry.name}`;
    return entry.isDirectory() ? walk(child) : entry.isFile() && RUNTIME_FILE.test(entry.name) ? [child] : [];
  });
  for (const root of NEW_ROOTS) {
    if (!fs.existsSync(path.join(sourceDir, root))) continue;
    for (const file of walk(root)) {
      const old = oldLocation(file);
      if (old === file || !old.startsWith(`${set.dir}/`)) continue;
      const inside = old.slice(set.dir.length + 1);
      if (!(set.assets ?? []).some(top => inside.startsWith(`${top}/`)) && !(set.topCss && !inside.includes('/') && inside.endsWith('.css'))) continue;
      const target = path.join(outDir, inside);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(sourceDir, file), target);
    }
  }
}

/** Copies the asset roots of one set, plus its top-level CSS, to the bundle folder (no source JS). `sourceDir` is the set's folder, `repoDir` the whole tree. */
export function copyRuntimeAssets(sourceDir, outDir, set, repoDir = null) {
  if (repoDir) copyMoved(repoDir, outDir, set);
  for (const root of set.assets ?? []) copyTree(path.join(sourceDir, root), path.join(outDir, root));
  if (!set.topCss || !fs.existsSync(sourceDir)) return;
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.css')) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.copyFileSync(path.join(sourceDir, entry.name), path.join(outDir, entry.name));
    }
  }
}
