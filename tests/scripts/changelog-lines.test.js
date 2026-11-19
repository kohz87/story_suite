import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { changelogProblems, jobIdIn, MAX_BULLET } from '../../scripts/checks/changelog-lines.mjs';

test('short player bullets and real capitalised words pass', () => {
  const text = '# Changelog\n\n## 0.1.3 — 19 Nov 2026\n\nA summary.\n\n### Added\n\n- HP, MP and SP come from STR, VIT and DEX; NPC State keeps RPG dossiers as JSON.\n- A natural 20 meets the DC; WIS covers LUK.\n';
  assert.deepEqual(changelogProblems(text), []);
});

test('a bullet over the limit is refused with its line number', () => {
  const text = `## 0.1.3\n\n- ${'a'.repeat(MAX_BULLET)}\n`;
  assert.deepEqual(changelogProblems(text), [`CHANGELOG.md:3: a bullet of ${MAX_BULLET + 2} characters (at most ${MAX_BULLET}); put the detail in docs/history/CHANGELOG-detail.md`]);
});

test('job ids and batch names are refused, in bullets and in summaries', () => {
  for (const [line, id] of [['- Fixed in LF4E.', 'LF4E'], ['- SOAK2UI fixes.', 'SOAK2UI'], ['- See NB-1.', 'NB-1'], ['- B4-12 is in.', 'B4-12'], ['- PF4FIX done.', 'PF4FIX'], ['Found in the SOAK run.', 'SOAK'], ['- From batch review 2.', 'batch review 2'], ['- Batch 3 fixes.', 'Batch 3'], ['- A FIXBATCH line.', 'FIXBATCH']]) {
    assert.equal(jobIdIn(line), id, line);
    assert.equal(changelogProblems(line).length, 1, line);
  }
});

test('headings are not checked for job ids', () => {
  assert.deepEqual(changelogProblems('## 0.1.3 — 19 Nov 2026\n### For developers\n'), []);
});

test('the repo CHANGELOG.md passes', () => {
  const text = fs.readFileSync(path.join(import.meta.dirname, '../../CHANGELOG.md'), 'utf8');
  assert.deepEqual(changelogProblems(text), []);
});
