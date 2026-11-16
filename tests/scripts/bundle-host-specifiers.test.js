import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BUNDLE_SETS } from '../../scripts/release/entries.mjs';
import { buildBundleSet } from '../../scripts/release/bundle.mjs';
import { buildDist } from '../../scripts/play/dist.mjs';

// Every import specifier that leaves a bundle (a host file: starts with `/` or `../`) is what the host SillyTavern resolves, so it must be the text
// main's builds wrote, recorded in fixtures/host-specifiers.json. A host import that lost or gained a `../` stops the extension from loading.
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

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'host-specs-'));

test('the release bundles import the same host files, written the same way, as main\'s release', async () => {
  const out = tmp();
  try {
    const got = {};
    for (const set of BUNDLE_SETS) {
      await buildBundleSet(set, path.join(out, set.name), repoRoot);
      const specs = hostSpecifiers(path.join(out, set.name));
      if (specs.length) got[set.name] = specs;
    }
    assert.deepEqual(got, recorded.release);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('the play build imports the same host files, written the same way, as main\'s play build', async () => {
  const out = tmp();
  try {
    await buildDist({ repo: repoRoot, source: repoRoot, commit: 'HEAD', out, write: false });
    const got = {};
    for (const name of fs.readdirSync(out)) {
      if (!fs.statSync(path.join(out, name)).isDirectory()) continue;
      const specs = hostSpecifiers(path.join(out, name));
      if (specs.length) got[name] = specs;
    }
    assert.deepEqual(got, recorded.play);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
