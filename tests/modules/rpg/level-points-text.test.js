// One level-point rule everywhere: Combat Rules v1 gives 1 point per level gained; the wizard's note, the Character's own prompt and RPG.md say so (a starting level adds none).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RPG_STRINGS } from '../../../modules/rpg/strings.js';
import { V1 } from '../../../modules/rpg/combat/numbers.js';

test('the wizard says a level gained later gives 1 point, not that every level does', () => {
  const w = RPG_STRINGS.wizard;
  assert.equal(V1.stat.perLevel, 1);
  for (const note of [w.statsNoteStandard, w.statsNoteImportStandard]) {
    assert.match(note, /level you gain later gives 1 more point/);
    assert.ok(!/Every level gives/.test(note));
  }
});

test('RPG.md names the Combat Rules v1 rule (1 per level) and the earlier one (every third level) apart', () => {
  const docs = readFileSync(new URL('../../../docs/v2/RPG.md', import.meta.url), 'utf8');
  assert.match(docs, /each level gained gives 1 stat point/);
  assert.ok(!/\nlevel \(3, 6, 9 and so on\) gives \*\*1 stat point\*\* to spend, and the Party card/.test(docs));
});
