// Test helper: builds a throwaway git repo from a { path: text } map and runs git in it.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export function writeFiles(root, files) {
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
}

export function toyRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codemod-toy-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'toy@example.com');
  git(root, 'config', 'user.name', 'Toy');
  writeFiles(root, files);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'toy');
  return root;
}

export const TOY = {
  'pkg/src/store.js': "import { run } from './runtime/run.js';\nexport const store = run;\n",
  'pkg/src/store-parts/a.js': "import { store } from '../store.js';\nexport const a = store;\n",
  'pkg/src/runtime/run.js': 'export const run = 1;\n',
  'pkg/src/ui/view.js': "import { store } from '../store.js';\nconst css = new URL('./view.css', import.meta.url);\nexport const load = () => import('../runtime/run.js');\nexport { store };\n",
  // A tiny all-import facade: every line changes, so only a two-step diff check can judge it.
  'pkg/src/ui/index.js': "export * from '../store.js';\n",
  'pkg/src/ui/view.css': 'a {}\n',
  'pkg/tests/store.test.js': "import { store } from '../src/store.js';\nimport fs from 'node:fs';\nfs.readFileSync(new URL('../src/ui/view.css', import.meta.url));\nexport { store };\n",
};

export const TOY_RULES = {
  area: 'toy',
  scope: ['pkg'],
  rules: [
    { from: 'pkg/src/store', to: 'core/store', stem: true },
    { from: 'pkg/src/runtime', to: 'core/runtime' },
    { from: 'pkg/src/ui', to: 'ui/legacy' },
    { from: 'pkg/tests', to: 'tests/core' },
  ],
};
