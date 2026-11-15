import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

import { loadChat } from '../../scripts/dryrun/load-chat.mjs';
import { compareRecords } from '../../scripts/dryrun/compare-records.mjs';
import { recordChat } from '../../scripts/dryrun/record-chat.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('loadChat reads .jsonl and .jsonl.gz exports', t => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'dryrun-load-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const header = { user_name: 'Reader', character_name: 'Guide', chat_metadata: {} };
  const msgs = [
    { name: 'Guide', is_user: false, is_system: false, mes: 'Welcome.' },
    { name: 'Reader', is_user: true, is_system: false, mes: 'Hello.' },
  ];
  const jsonl = [header, ...msgs].map(item => JSON.stringify(item)).join('\n') + '\n';

  const plainPath = path.join(dir, 'chat.jsonl');
  const gzPath = path.join(dir, 'chat.jsonl.gz');
  writeFileSync(plainPath, jsonl, 'utf8');
  writeFileSync(gzPath, gzipSync(Buffer.from(jsonl, 'utf8')));

  const fromPlain = loadChat(plainPath);
  const fromGz = loadChat(gzPath);

  assert.deepEqual(fromPlain, { header, messages: msgs });
  assert.deepEqual(fromGz, { header, messages: msgs });
});

test('compareRecords reports equal and unequal records with 20-diff cap and 200-char cut', () => {
  const base = {
    messageCount: 2,
    replyCount: 1,
    staticPrompts: { story_suite_static: 'rules' },
    replies: [{ index: 0, stateHash: 'abc', changes: { source: 'receipts', value: [] }, queries: { values: {} } }],
  };
  assert.deepEqual(compareRecords(base, structuredClone(base)), { equal: true, differences: [] });

  const longText = 'x'.repeat(250);
  const changed = structuredClone(base);
  changed.replies[0].stateHash = 'def';
  changed.staticPrompts.story_suite_static = longText;

  const diff = compareRecords(base, changed);
  assert.equal(diff.equal, false);
  assert.equal(diff.differences.length, 2);
  assert.equal(diff.differences[0].reply, null);
  assert.equal(diff.differences[0].field, 'staticPrompts.story_suite_static');
  assert.equal(diff.differences[0].after.length, 200);
  assert.equal(diff.differences[1].reply, 0);
  assert.equal(diff.differences[1].field, 'stateHash');

  const manyA = { replies: Array.from({ length: 25 }, (_, i) => ({ index: i, stateHash: `a${i}` })) };
  const manyB = { replies: Array.from({ length: 25 }, (_, i) => ({ index: i, stateHash: `b${i}` })) };
  const capped = compareRecords(manyA, manyB);
  assert.equal(capped.equal, false);
  assert.equal(capped.differences.length, 20);
});

test('recordChat records a 2-reply synthetic chat deterministically', async t => {
  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'dryrun-suite-'));
  const prevSuiteRoot = process.env.STORY_SUITE_ROOT;
  t.after(() => {
    if (prevSuiteRoot === undefined) delete process.env.STORY_SUITE_ROOT;
    else process.env.STORY_SUITE_ROOT = prevSuiteRoot;
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  symlinkSync(path.join(REPO_ROOT, 'packages', 'story-block'), path.join(tmpRoot, 'Story_block'));
  symlinkSync(path.join(REPO_ROOT, 'packages', 'story-director'), path.join(tmpRoot, 'Story_director'));
  symlinkSync(path.join(REPO_ROOT, 'packages', 'npc-state-delta'), path.join(tmpRoot, 'npc_state_delta'));
  process.env.STORY_SUITE_ROOT = tmpRoot;

  const suiteUrl = pathToFileURL(path.join(REPO_ROOT, 'packages/story-block/tests/v2/break/helpers/suite.js')).href;
  const { loadSuite, suiteHost } = await import(suiteUrl);
  const loaded = await loadSuite();
  if (loaded.skip) {
    t.skip(loaded.skip);
    return;
  }

  const chat = {
    header: { user_name: 'Reader', character_name: 'Guide', chat_metadata: {} },
    messages: [
      { name: 'Guide', is_user: false, is_system: false, mes: 'The road begins at dawn.', swipe_id: 0, swipes: ['The road begins at dawn.'], swipe_info: [{ send_date: '', extra: {} }], extra: {} },
      { name: 'Reader', is_user: true, is_system: false, mes: 'I check my pack.', extra: {} },
      { name: 'Guide', is_user: false, is_system: false, mes: 'A lantern and a coil of rope rest inside.', swipe_id: 0, swipes: ['A lantern and a coil of rope rest inside.'], swipe_info: [{ send_date: '', extra: {} }], extra: {} },
    ],
  };

  const suite = { ...loaded, suiteHost };
  const rec1 = await recordChat({ suite, chat });
  const rec2 = await recordChat({ suite, chat });

  assert.equal(rec1.replyCount, 2);
  assert.equal(rec1.replies.length, 2);
  assert.ok(rec1.replies[0].stateHash);
  assert.ok(rec1.replies[1].stateHash);
  assert.ok('story_suite_static' in rec1.staticPrompts);
  assert.deepEqual(compareRecords(rec1, rec2), { equal: true, differences: [] });
});
