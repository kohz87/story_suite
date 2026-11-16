// What the one play extension contains: the single bundle set of the release build, the runtime assets its CSS and code
// resolve, and the root files that make it one extension.

import fs from 'node:fs';
import path from 'node:path';
import { BUNDLE_SETS } from '../release/entries.mjs';

/** The one bundle set: the same as the release build packs. */
export const DIST_SET = BUNDLE_SETS[0];

/** The source folders and root files a play build reads (and `git archive` extracts). */
export const SOURCES = ['core', 'modules', 'ui', 'packs', 'assets', 'index.js', 'suite.css', 'manifest.json'];

/** Writes the root files of the extension: the repo's manifest (named as the play build) and the build record. The stylesheet and entry are the repo's own. */
export function writeRootFiles(outDir, { commit, builtAt, sourceDir }) {
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceDir, 'manifest.json'), 'utf8'));
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({ ...manifest, display_name: 'Story Suite (play build)' }, null, 2)}\n`);
  fs.copyFileSync(path.join(sourceDir, manifest.css), path.join(outDir, manifest.css));
  fs.writeFileSync(path.join(outDir, 'BUILD.txt'), `Story Suite (play build)\nsource commit: ${commit}\nbuilt: ${builtAt}\n`);
}
