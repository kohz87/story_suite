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
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'play-dist-moved-'));
  await buildDist({ repo, commit: 'c'.repeat(40), source: repo, out: path.join(out, 'x'), write: false });
});
after(() => fs.rmSync(out, { recursive: true, force: true }));

const at = (...parts) => path.join(out, 'x', ...parts);

test('the play build copies the stylesheets and fonts that now live under modules/, core/ and assets/ to the old place its bundle names', () => {
  for (const file of [
    'story-block/src/v2/lean-rpg/view/lean-rpg.css', 'story-block/src/v2/lean-rpg/board/board.css', 'story-block/src/v2/screens/block-maps.css',
    'story-block/assets/fonts/nunito/nunito-latin-400.woff2', 'npc-state-delta/style.css', 'npc-state-delta/suite.css', 'ui/legacy/view/host.css', 'ui/css/next-hide.css',
  ]) assert.ok(fs.existsSync(at(file)), `${file} is in the build`);
});

test('the bundle names a moved module by its old place in the set, so a stylesheet beside it resolves to the copied file', () => {
  const view = fs.readdirSync(at('story-block')).find(name => /^view-.*\.js$/.test(name));
  const code = fs.readFileSync(at('story-block', view), 'utf8');
  assert.match(code, /new URL\("src\/v2\/lean-rpg\/view\/index-parts\/mount\.js", import\.meta\.url\)/);
  assert.doesNotMatch(code, /new URL\("\.\.\/\.\.\/modules\//);
  const base = at('story-block', 'src/v2/lean-rpg/view/index-parts/');
  for (const sheet of ['../lean-rpg.css', '../bars.css', '../check-card.css', '../../board/board.css', '../../board/fight-start.css']) {
    assert.ok(fs.existsSync(path.resolve(base, sheet)), `${sheet} resolves`);
  }
});
