import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const scope = (env) => spawnSync('bash', [path.join(root, 'scripts/ci/ui-walk-scope.sh')], { encoding: 'utf8', env: { PATH: process.env.PATH, ...env } }).stdout.trim();
const pr = (files, headRef = 'fix/x') => scope({ EVENT: 'pull_request', HEAD_REF: headRef, FILES: files.join('\n') });

test('the walk runs for a manual run and for a release pull request, whatever it changed', () => {
  assert.equal(scope({ EVENT: 'workflow_dispatch' }), 'run=true');
  assert.equal(pr(['README.md'], 'release/0.1.2'), 'run=true');
});

test('the walk runs for a pull request that touches the UI, the SDK, a settings file, css, a pack UI file or the walk', () => {
  for (const file of ['ui/mount.js', 'core/sdk/ports.js', 'modules/people/settings-page.js', 'modules/story-block/rpg/settings.js', 'suite.css', 'packs/ersveil/ui/card.js', 'scripts/ui-walk/walk-plan.mjs', 'scripts/ci/ui-walk-run.sh', '.github/workflows/ui-walk.yml']) {
    assert.equal(pr([file]), 'run=true', file);
  }
});

test('the walk is skipped for a pull request that touches none of them, and for a push', () => {
  assert.equal(pr(['docs/dev/ci.md', 'modules/people/store.js', 'core/engine/turn.js', 'packs/ersveil/lore.json', 'tests/ui/a.test.js']), 'run=false');
  assert.equal(scope({ EVENT: 'push', FILES: 'ui/mount.js' }), 'run=false');
});

test('the workflow runs the walk at the three sizes in dark and light, uploads the table, and uses the SillyTavern tag it pins', () => {
  const text = fs.readFileSync(path.join(root, '.github/workflows/ui-walk.yml'), 'utf8');
  for (const size of ['1920x1080', '1280x800', '390x844']) assert.ok(text.includes(`"${size}"`), size);
  assert.ok(text.includes('theme: [dark, light]'));
  assert.match(text, /SILLYTAVERN_TAG: \d+\.\d+\.\d+\n/);
  assert.ok(text.includes('actions/upload-artifact@v4'));
  assert.ok(/timeout-minutes: \d+/.test(text));
});
