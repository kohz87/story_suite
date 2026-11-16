// What the one play extension contains, in SillyTavern's load order: the four bundled tools, the
// runtime assets their CSS and code resolve, and the root files that make them one extension.

import fs from 'node:fs';
import path from 'node:path';

/** One row per bundled tool: where it lives in the source tree, which bundle set it is, and the asset roots it keeps. */
export const DIST_SETS = [
  {
    name: 'story-block',
    dir: 'packages/story-block',
    entries: ['index.js'],
    lazy: ['src/v2/lean-rpg/index.js', 'src/v2/lean-rpg/view/index.js', 'src/v2/screens/ui-sample.js', 'src/v2/view/settings/diagnostics-page.js'],
    assets: ['src', 'assets'],
    topCss: true,
  },
  { name: 'story-director', dir: 'packages/story-director', entries: ['index.js'], lazy: [], assets: [], topCss: false },
  { name: 'npc-state-delta', dir: 'packages/npc-state-delta', entries: ['bootstrap.js'], lazy: [], assets: [], topCss: true },
  { name: 'ui', dir: 'ui', entries: ['st-entry.js'], lazy: [], assets: ['css'], topCss: false },
];

const entry = commit => [
  '// Story Suite play build: the four tools in the order SillyTavern used to load them.',
  `console.info('[Story Suite play build] source ${commit}');`,
  "import './story-block/index.js';",
  "import './story-director/index.js';",
  "import './npc-state-delta/bootstrap.js';",
  "import './ui/st-entry.js';",
  '',
].join('\n');

// Story Block's own manifest field, kept so its turn interceptor is still run by SillyTavern.
const MANIFEST = {
  display_name: 'Story Suite (play build)',
  loading_order: 25,
  requires: [],
  optional: [],
  generate_interceptor: 'storyBlockGenerationInterceptor',
  js: 'entry.js',
  css: 'style.css',
  author: 'kohz87',
  version: '0.1.0',
};

// One stylesheet for the extension; cross-package links resolve beside the copied package folders.
const STYLE = [
  '@import url(\'./story-block/src/v2/view/host.css\');',
  '@import url(\'./ui/css/next-hide.css\');',
  '@import url(\'./npc-state-delta/style.css\');',
  '',
].join('\n');

/** Writes the root files of the extension: manifest, entry, stylesheet and the build record. */
export function writeRootFiles(outDir, { commit, builtAt }) {
  const write = (file, text) => fs.writeFileSync(path.join(outDir, file), text);
  write('manifest.json', `${JSON.stringify(MANIFEST, null, 2)}\n`);
  write('entry.js', entry(commit));
  write('style.css', STYLE);
  write('BUILD.txt', `Story Suite (play build)\nsource commit: ${commit}\nbuilt: ${builtAt}\n`);
}
