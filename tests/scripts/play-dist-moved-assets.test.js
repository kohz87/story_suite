import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDist } from '../../scripts/play/dist.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let out;

before(async () => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'play-dist-real-'));
  await buildDist({ repo, commit: 'c'.repeat(40), source: repo, out: path.join(out, 'x'), write: false });
});
after(() => fs.rmSync(out, { recursive: true, force: true }));

const at = (...parts) => path.join(out, 'x', ...parts);

test('the play build copies the stylesheets and fonts to the same path they have in the source tree', () => {
  for (const file of [
    'manifest.json', 'suite.css', 'modules/rpg/view/lean-rpg.css', 'modules/rpg/board/board.css', 'assets/fonts/nunito/nunito-latin-400.woff2', 'ui/legacy/view/host.css', 'ui/css/next-hide.css',
  ]) assert.ok(fs.existsSync(at(file)), `${file} is in the build`);
});

test('the bundle names a module by its path from the extension folder, so a stylesheet beside it resolves to the copied file', () => {
  const view = fs.readdirSync(at()).find(name => /^view-.*\.js$/.test(name));
  const code = fs.readFileSync(at(view), 'utf8');
  assert.match(code, /new URL\("modules\/rpg\/view\/index-parts\/mount\.js", import\.meta\.url\)/);
  const base = at('modules/rpg/view/index-parts/');
  for (const sheet of ['../lean-rpg.css', '../bars.css', '../check-card.css', '../../board/board.css', '../../board/fight-start.css']) {
    assert.ok(fs.existsSync(path.resolve(base, sheet)), `${sheet} resolves`);
  }
});
