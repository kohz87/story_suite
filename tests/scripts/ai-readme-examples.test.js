// The worked examples in AI-README.md are run: the module and its test with the testkit, and both packs with the pack checker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tempDir } from '../../scripts/temp-dir.mjs';
import { checkPack } from '../../authoring-kit/check.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');
const README = fs.readFileSync(path.join(REPO, 'AI-README.md'), 'utf8');
const block = tag => {
  const found = new RegExp('```' + tag + '\\n([\\s\\S]*?)\\n```').exec(README);
  assert.ok(found, `AI-README.md has no \`\`\`${tag} block`);
  return found[1];
};

test('the minimal module and its replay test pass in the testkit', () => {
  const dir = tempDir('ai-readme-example-');
  try {
    fs.writeFileSync(path.join(dir, 'lantern.js'), block('js module-example'));
    const testkit = pathToFileURL(path.join(REPO, 'testkit/index.js')).href;
    fs.writeFileSync(path.join(dir, 'lantern.test.js'), block('js test-example').replace('../../testkit/index.js', testkit));
    const result = spawnSync('node', ['--test', path.join(dir, 'lantern.test.js')], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the module example passes the registry checks', async () => {
  const dir = tempDir('ai-readme-example-');
  try {
    fs.writeFileSync(path.join(dir, 'lantern.js'), block('js module-example'));
    const { lantern } = await import(pathToFileURL(path.join(dir, 'lantern.js')).href);
    const { definitionProblems } = await import(pathToFileURL(path.join(REPO, 'core/registry.js')).href);
    assert.deepEqual(definitionProblems(lantern), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the minimal world pack and game pack pass the pack checker', () => {
  for (const tag of ['json pack-example', 'json game-example']) {
    const result = checkPack(block(tag));
    assert.equal(result.ok, true, `${tag}: ${JSON.stringify(result.errors)}`);
  }
});

test('the combat marks the guide names are the ones the fight kind sets', () => {
  const source = fs.readFileSync(path.join(REPO, 'modules/rpg/board/v1-kind.js'), 'utf8');
  for (const mark of ['fleeIdle', 'xpRule', 'gearStats', 'gearWear', 'speedFull', 'soakWhole']) {
    assert.ok(source.includes(`${mark}:`), `v1-kind.js sets no ${mark}`);
    assert.ok(README.includes(`| \`${mark}\` |`), `the guide's mark table lacks ${mark}`);
  }
});

test('the guide names the version the suite has', () => {
  const version = /SUITE_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(REPO, 'core/version.js'), 'utf8'))[1];
  assert.ok(README.includes(`**Version \`${version}\`**`));
});
