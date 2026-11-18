// SOAK2UI 7: the dossier's Edit window speaks to the reader: "NPC State", no developer wording ("NPC State Delta", "extension-owned JSON").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../modules/people/runtime/runtime-editor.js', import.meta.url), 'utf8');

test('the Edit window help line and kicker use reader wording', () => {
  assert.match(source, /Edits save to this story's NPC State\./u);
  assert.doesNotMatch(source, /extension-owned JSON|NPC State Delta's|LIVE DOSSIER/u);
});
