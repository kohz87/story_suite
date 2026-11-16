// Copies the files the bundle reaches by URL (CSS, fonts, images) to the same place in the build as in the source tree, so a stylesheet beside a module resolves.

import fs from 'node:fs';
import path from 'node:path';

const RUNTIME_FILE = /\.(css|woff2?|ttf|otf|png|jpe?g|webp|gif|svg)$/i;
const ROOTS = ['core', 'modules', 'ui', 'packs', 'assets'];

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

/** Copies every runtime asset under the source roots (no source JS) to the same path under `outDir`. */
export function copyRuntimeAssets(sourceDir, outDir) {
  for (const root of ROOTS) copyTree(path.join(sourceDir, root), path.join(outDir, root));
}
