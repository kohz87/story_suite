import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { compareRecords } from '../../scripts/dryrun/compare-records.mjs';
import { historyErrors } from '../../scripts/dryrun/compare-history.mjs';
import { runHistoryOps } from '../../scripts/dryrun/history-ops.mjs';
import { pageSuiteHost } from '../../scripts/dryrun/suite-host.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let suiteLoad = null;
function loadedSuite() {
  suiteLoad ??= (async () => {
    const tmpRoot = tempDir('dryrun-history-');
    process.on('exit', () => rmSync(tmpRoot, { recursive: true, force: true }));
    symlinkSync(path.join(REPO_ROOT, 'packages', 'story-block'), path.join(tmpRoot, 'Story_block'));
    symlinkSync(path.join(REPO_ROOT, 'packages', 'story-director'), path.join(tmpRoot, 'Story_director'));
    symlinkSync(path.join(REPO_ROOT, 'packages', 'npc-state-delta'), path.join(tmpRoot, 'npc_state_delta'));
    process.env.STORY_SUITE_ROOT = tmpRoot;
    const { loadSuite, suiteHost } = await import(pathToFileURL(path.join(REPO_ROOT, 'tests/suite/break/helpers/suite.js')).href);
    const loaded = await loadSuite();
    return loaded.skip ? { skip: loaded.skip } : { suite: { ...loaded, suiteHost, pageHost: pageSuiteHost } };
  })();
  return suiteLoad;
}

async function playedChat({ suite }, replies = 5) {
  const host = await pageSuiteHost(suite, { seed: 3 });
  try {
    for (let i = 1; i <= replies; i++) await host.send(`Step ${i}.`, host.reply(`Scene ${i} unfolds.`, [`+ item Rope${i} | qty: 1`, `~ place Weir${i} | kind: wild`]));
    return { header: { user_name: 'Reader', character_name: 'Guide', chat_metadata: structuredClone(host.ctx.chatMetadata) }, messages: structuredClone(host.ctx.chat) };
  } finally {
    host.close();
  }
}

test('the history sequence is deterministic and records every operation', async t => {
  const got = await loadedSuite();
  if (got.skip) return t.skip(got.skip);
  const chat = await playedChat(got);
  const a = await runHistoryOps({ suite: got.suite, chat, chatId: 'synthetic-1' });
  const b = await runHistoryOps({ suite: got.suite, chat, chatId: 'synthetic-1' });
  assert.deepEqual(a, b);
  assert.deepEqual(a.ops.map(op => op.op), ['swipe', 'deleteMiddle', 'rewind', 'reload']);
  assert.deepEqual(historyErrors({ history: a }, 'new'), []);
  for (const op of a.ops) assert.ok(!op.skipped && op.headHash && op.reread, `${op.op} recorded`);
  const other = await runHistoryOps({ suite: got.suite, chat, chatId: 'synthetic-2' });
  assert.notEqual(a.seed, other.seed);
  assert.deepEqual(compareRecords({ errors: [], replies: [], history: a }, { errors: [], replies: [], history: b }), { equal: true, differences: [] });
});

test('a changed state after a middle delete is detected', async t => {
  const got = await loadedSuite();
  if (got.skip) return t.skip(got.skip);
  const chat = await playedChat(got);
  const history = await runHistoryOps({ suite: got.suite, chat, chatId: 'synthetic-1' });
  const [swipe, del] = history.ops;
  assert.notEqual(del.headHash, swipe.headHash, 'the delete moved the head state');
  assert.ok(del.messageCount < swipe.messageCount);
  const altered = structuredClone(history);
  altered.ops[1].headHash = 'f'.repeat(64);
  const verdict = compareRecords({ errors: [], replies: [], history }, { errors: [], replies: [], history: altered });
  assert.equal(verdict.equal, false);
  assert.ok(verdict.differences.some(d => d.field === 'history.ops[1].headHash'));
});

test('history failures are errors; identical deliberate refusals agree; one-sided ones do not', () => {
  const ok = { op: 'swipe', headHash: 'a', replyCount: 2, queries: {}, reread: { ok: true } };
  const refusal = { ok: false, code: 'CONFLICT', result: { ok: false, code: 'CONFLICT', message: 'later change depends' } };
  const mk = op => ({ errors: [], replies: [], history: { ops: [op] } });
  assert.equal(compareRecords(mk(ok), mk(ok)).equal, true);
  assert.equal(compareRecords(mk({ ...ok, reread: refusal }), mk({ ...ok, reread: refusal })).equal, true);
  assert.equal(compareRecords(mk({ ...ok, reread: refusal }), mk(ok)).equal, false);
  const threw = { op: 'swipe', error: 'boom' };
  assert.equal(compareRecords(mk(threw), mk(threw)).equal, false);
  const thrownRead = { ...ok, reread: { ok: false, code: 'THREW', result: null, error: 'x' } };
  assert.equal(compareRecords(mk(thrownRead), mk(thrownRead)).equal, false);
  assert.equal(compareRecords(mk({ ...ok, queries: null }), mk({ ...ok, queries: null })).equal, false);
  assert.equal(compareRecords({ errors: [], replies: [], history: { ops: [] } }, { errors: [], replies: [], history: { ops: [] } }).equal, false);
  assert.equal(compareRecords({ errors: [], replies: [] }, mk(ok)).equal, false, 'history on one side only');
});
