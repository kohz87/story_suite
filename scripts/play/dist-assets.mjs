// Copies the files the bundles reach by URL (CSS, fonts, images) into the same folder as their bundle.

import fs from 'node:fs';
import path from 'node:path';

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

/** Copies the asset roots of one set, plus its top-level CSS, to the bundle folder (no source JS). */
export function copyRuntimeAssets(sourceDir, outDir, set) {
  for (const root of set.assets ?? []) copyTree(path.join(sourceDir, root), path.join(outDir, root));
  if (!set.topCss || !fs.existsSync(sourceDir)) return;
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.css')) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.copyFileSync(path.join(sourceDir, entry.name), path.join(outDir, entry.name));
    }
  }
}
