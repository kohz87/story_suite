import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import fs from 'node:fs';
import path from 'node:path';
import { BUNDLE_SETS } from '../../scripts/release/entries.mjs';
import { buildBundleSet } from '../../scripts/release/bundle.mjs';
import { buildDist } from '../../scripts/play/dist.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

// Every import specifier that leaves a bundle (a host file: starts with `/` or `../`) is what the host SillyTavern resolves, so it must be the text
// recorded in fixtures/host-specifiers.json. A host import that lost or gained a `../` stops the extension from loading. The repo root is the extension
// folder, so a file's host imports are written for the depth of the file itself; the bundle rewrites them from the extension folder.
const repoRoot = path.resolve(import.meta.dirname, '../..');
const recorded = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/host-specifiers.json'), 'utf8'));

function hostSpecifiers(dir) {
  const found = new Set();
  const visit = folder => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) { visit(file); continue; }
      if (!/\.m?js$/.test(entry.name)) continue;
      walk.full(acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' }), node => {
        const spec = node.source?.value;
        if (typeof spec === 'string' && (spec.startsWith('/') || spec.startsWith('../'))) found.add(spec);
      });
    }
  };
  visit(dir);
  return [...found].sort();
}

const tmp = () => tempDir('host-specs-');

test('the release bundle imports exactly the recorded host specifiers', async () => {
  const out = tmp();
  try {
    await buildBundleSet(BUNDLE_SETS[0], path.join(out, 'set'), repoRoot);
    assert.deepEqual(hostSpecifiers(path.join(out, 'set')), recorded.bundle);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('the play build imports the same host specifiers as the release bundle', async () => {
  const out = tmp();
  try {
    await buildDist({ repo: repoRoot, source: repoRoot, commit: 'HEAD', out, write: false });
    assert.deepEqual(hostSpecifiers(out), recorded.bundle);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

// The unbundled install (a dev checkout or the replica's symlink of the repo root) loads the source files themselves: every host specifier of the
// graph reached from index.js is resolved from where that file is served, against a fake public/ tree, and must name a file the host has.
test('the unbundled entry graph names only host files that exist, from where each file is served', () => {
  const pub = tmp();
  try {
    const hostFiles = ['script.js', 'scripts/extensions.js', 'scripts/utils.js', 'scripts/extensions/shared.js'];
    for (const file of hostFiles) { fs.mkdirSync(path.dirname(path.join(pub, file)), { recursive: true }); fs.writeFileSync(path.join(pub, file), ''); }
    const served = path.join(pub, 'scripts/extensions/third-party/story_suite');
    const seen = new Set([path.join(repoRoot, 'index.js')]);
    const queue = [...seen];
    const targets = new Set();
    while (queue.length) {
      const file = queue.shift();
      const here = path.dirname(path.relative(repoRoot, file));
      walk.full(acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true }), node => {
        const spec = node.source?.value;
        if (typeof spec !== 'string' || !(spec.startsWith('.') || spec.startsWith('/'))) return;
        const inRepo = spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null;
        if (inRepo && !path.relative(repoRoot, inRepo).startsWith('..')) {
          if (/\.m?js$/.test(inRepo) && !seen.has(inRepo)) { seen.add(inRepo); queue.push(inRepo); }
          return;
        }
        const target = spec.startsWith('/') ? path.join(pub, spec) : path.resolve(served, here, spec);
        assert.ok(fs.existsSync(target), `${path.relative(repoRoot, file)}: ${spec} resolves to ${path.relative(pub, target)}, which the host does not have`);
        targets.add(`/${path.relative(pub, target)}`);
      });
    }
    assert.deepEqual([...targets].sort(), recorded.targets);
  } finally { fs.rmSync(pub, { recursive: true, force: true }); }
});
