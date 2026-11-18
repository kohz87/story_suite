import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import fs from 'node:fs';
import path from 'node:path';
import { BUNDLE_SETS } from '../../scripts/release/entries.mjs';
import { buildBundleSet } from '../../scripts/release/bundle.mjs';
import { buildDist } from '../../scripts/play/dist.mjs';
import { studioFiles } from '../../scripts/release/studio.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

// Every import specifier that leaves a bundle (a host file: starts with `/` or `../`) is what the host SillyTavern resolves, so it must be the text
// recorded in fixtures/host-specifiers.json. A host import that lost or gained a `../` stops the extension from loading. The repo root is the extension
// folder, so a file's host imports are written for the depth of the file itself; the bundle rewrites them from the extension folder.
const repoRoot = path.resolve(import.meta.dirname, '../..');
const recorded = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/host-specifiers.json'), 'utf8'));

// `skip`: files (paths from dir, posix) left out of the scan.
function hostSpecifiers(dir, skip = new Set()) {
  const found = new Set();
  const visit = folder => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) { visit(file); continue; }
      if (!/\.m?js$/.test(entry.name) || skip.has(path.relative(dir, file).split(path.sep).join('/'))) continue;
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

// The play build also carries the Pack Studio: studio/index.html and the source files it reaches, copied unbundled at their own paths. Their `../`
// imports are files of the build, not of the host: each must resolve to a file inside the build. The bundle's own files are what the host resolves.
test('the play build imports the same host specifiers as the release bundle; the Studio it carries imports only its own files', async () => {
  const out = tmp();
  try {
    await buildDist({ repo: repoRoot, source: repoRoot, commit: 'HEAD', out, write: false });
    const studio = studioFiles(repoRoot).files.filter(file => /\.m?js$/.test(file));
    assert.ok(studio.length > 0 && fs.existsSync(path.join(out, 'studio/index.html')), 'the play build carries the Studio');
    assert.deepEqual(hostSpecifiers(out, new Set(studio)), recorded.bundle);
    for (const file of studio) {
      assert.equal(fs.readFileSync(path.join(out, file), 'utf8'), fs.readFileSync(path.join(repoRoot, file), 'utf8'), `${file} is the source file`);
      walk.full(acorn.parse(fs.readFileSync(path.join(out, file), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' }), node => {
        const spec = node.source?.value;
        if (typeof spec !== 'string' || !(spec.startsWith('.') || spec.startsWith('/'))) return;
        const target = path.resolve(out, path.dirname(file), spec);
        assert.ok(!spec.startsWith('/') && !path.relative(out, target).startsWith('..') && fs.existsSync(target), `${file}: ${spec} is not a file of the play build`);
      });
    }
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
