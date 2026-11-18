import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMarkdown, countResults } from '../../scripts/ui-walk/walk-report.mjs';
import { record, fail } from '../../scripts/ui-walk/walk-record.mjs';

const base = { combo: '1280x800-dark', section: 'look' };

function sample() {
  const ok = record(base, { id: 'host.sendPending', label: 'Send pending note', kind: 'sw' }, { from: true, to: false, checks: { shown: true, stored: true, reopen: true, reload: true, restored: true } });
  const bad = record(base, { id: 'host.font', label: 'Font', kind: 'seg' }, { from: 'Nunito', to: 'Theme | font', checks: { shown: true, stored: true } });
  fail(bad, 'effect', 'suite look changes: nothing changed');
  bad.shots.push('/tmp/out/1280x800-dark__look__host.font__change.png');
  const skip = record({ ...base, combo: '390x844-light' }, { id: 'act:Reset Look to defaults', label: 'Reset Look to defaults', kind: 'act' }, { status: 'skip', notes: ['action button'] });
  return [ok, bad, skip];
}

test('fail marks the record and its check, and keeps the note', () => {
  const [, bad] = sample();
  assert.equal(bad.status, 'fail');
  assert.equal(bad.checks.effect, false);
  assert.deepEqual(bad.notes, ['suite look changes: nothing changed']);
});

test('countResults counts pass, fail and skip per run', () => {
  assert.deepEqual(countResults(sample()), { '1280x800-dark': { pass: 1, fail: 1, skip: 0 }, '390x844-light': { pass: 0, fail: 0, skip: 1 } });
});

test('toMarkdown: counts, a failures table naming the failed check and screenshot, and every control', () => {
  const md = toMarkdown(sample(), { url: 'http://127.0.0.1:8006', character: 'Ersveil_Blade', notes: ['a note'] });
  assert.match(md, /^# Settings walk/);
  assert.match(md, /- a note/);
  assert.match(md, /\| 1280x800-dark \| 1 \| 1 \| 0 \|/);
  assert.match(md, /\| 1280x800-dark \| look \| `host\.font` \| Font \| effect \| suite look changes: nothing changed \| 1280x800-dark__look__host\.font__change\.png \|/);
  assert.match(md, /Theme \\\| font/, 'a pipe in a value is escaped');
  assert.match(md, /`host\.sendPending` \| sw \| true \| false \| {2}\| {2}\| {2}\| ok \| {2}\| ok \| {2}\| ok \| ok \| ok \| PASS/, 'walk, click, visible empty; shown ok; effect empty; stored ok; redraw empty; reopen, reload, restored ok');
  assert.match(md, /`act:Reset Look to defaults` \| act .* SKIP \| action button \|/);
});

test('toMarkdown says None when nothing failed', () => {
  const md = toMarkdown(sample().filter(r => r.status !== 'fail'));
  assert.match(md, /## Failures\n\nNone\./);
});
