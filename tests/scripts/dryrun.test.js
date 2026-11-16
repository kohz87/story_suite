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
import { pageSuiteHost } from '../../scripts/dryrun/suite-host.mjs';

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
    errors: [],
    replies: [{ index: 0, stateHash: 'abc', changes: { source: 'receipts', value: [] }, queries: { values: {} }, reread: { ok: true } }],
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

  const manyA = { errors: [], replies: Array.from({ length: 25 }, (_, i) => ({ index: i, stateHash: `a${i}`, reread: { ok: true } })) };
  const manyB = { errors: [], replies: Array.from({ length: 25 }, (_, i) => ({ index: i, stateHash: `b${i}`, reread: { ok: true } })) };
  const capped = compareRecords(manyA, manyB);
  assert.equal(capped.equal, false);
  assert.equal(capped.differences.length, 20);
});

test('compareRecords never calls a failed step equal, even when both sides failed the same way', () => {
  const failed = {
    errors: [{ reply: 0, step: 'reread', detail: 'REFUSED' }],
    replies: [{ index: 0, stateHash: 'abc', reread: { ok: false, code: 'REFUSED' } }],
  };
  const same = compareRecords(failed, structuredClone(failed));
  assert.equal(same.equal, false);
  assert.ok(same.differences.some(d => d.field === 'old ERROR reread'));
  assert.ok(same.differences.some(d => d.field === 'new ERROR reread'));

  const noList = { replies: [] };
  assert.equal(compareRecords(noList, structuredClone(noList)).equal, false);

  const unlisted = { errors: [], replies: [{ index: 0, stateHash: 'abc', reread: { ok: false, code: 'THREW' } }] };
  assert.equal(compareRecords(unlisted, structuredClone(unlisted)).equal, false);
});

const refusal = (code, message) => ({ ok: false, code, result: { ok: false, code, message } });
const refused = (code, message, extra = {}) => ({ errors: [{ reply: 0, step: 'reread', detail: code }], replies: [{ index: 0, stateHash: 'abc', reread: refusal(code, message) }], ...extra });

test('compareRecords counts the same deliberate Re-read refusal on both sides as agreement', () => {
  const res = compareRecords(refused('CONFLICT', 'a later change depends'), refused('CONFLICT', 'a later change depends'));
  assert.equal(res.equal, true);
  assert.deepEqual(res.differences, []);
  assert.deepEqual(res.expectedRefusals, [{ reply: 0, code: 'CONFLICT' }]);
});

test('compareRecords keeps one-sided, different, thrown, empty-prompt and held-back cases as errors', () => {
  const ok = { errors: [], replies: [{ index: 0, stateHash: 'abc', reread: { ok: true } }] };
  assert.equal(compareRecords(refused('CONFLICT', 'm'), ok).equal, false);
  assert.equal(compareRecords(ok, refused('CONFLICT', 'm')).equal, false);
  assert.equal(compareRecords(refused('CONFLICT', 'm'), refused('CONFLICT', 'other')).equal, false);
  assert.equal(compareRecords(refused('CONFLICT', 'm'), refused('REFUSED', 'm')).equal, false);
  const threw = { errors: [{ reply: 0, step: 'reread', detail: 'THREW: x' }], replies: [{ index: 0, stateHash: 'abc', reread: { ok: false, code: 'THREW', result: null, error: 'x' } }] };
  assert.equal(compareRecords(threw, structuredClone(threw)).equal, false);
  const emptyStatic = refused('CONFLICT', 'm', { errors: [{ reply: 0, step: 'reread', detail: 'CONFLICT' }, { reply: 0, step: 'prompt', detail: 'empty static prompt' }] });
  const res = compareRecords(emptyStatic, structuredClone(emptyStatic));
  assert.equal(res.equal, false);
  assert.ok(res.differences.some(d => d.field === 'old ERROR prompt'));
  assert.ok(!res.differences.some(d => d.field.includes('reread')));
  const held = refused('CONFLICT', 'm', { errors: [{ reply: 0, step: 'prompt', detail: 'held back' }] });
  assert.equal(compareRecords(held, structuredClone(held)).equal, false);
});

// The suite helper reads its checkout roots once, when first imported: one shared load, the temp folder removed at exit.
let suiteLoad = null;
function loadedSuite() {
  suiteLoad ??= (async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'dryrun-suite-'));
    process.on('exit', () => rmSync(tmpRoot, { recursive: true, force: true }));
    symlinkSync(path.join(REPO_ROOT, 'packages', 'story-block'), path.join(tmpRoot, 'Story_block'));
    symlinkSync(path.join(REPO_ROOT, 'packages', 'story-director'), path.join(tmpRoot, 'Story_director'));
    symlinkSync(path.join(REPO_ROOT, 'packages', 'npc-state-delta'), path.join(tmpRoot, 'npc_state_delta'));
    process.env.STORY_SUITE_ROOT = tmpRoot;
    const suiteUrl = pathToFileURL(path.join(REPO_ROOT, 'tests/suite/break/helpers/suite.js')).href;
    const { loadSuite, suiteHost } = await import(suiteUrl);
    const loaded = await loadSuite();
    return loaded.skip ? { skip: loaded.skip } : { suite: { ...loaded, suiteHost, pageHost: pageSuiteHost } };
  })();
  return suiteLoad;
}

// A chat played on a real host, so its replies carry stored receipts, a person, an item and a place to ask about.
async function playedChat({ suite }) {
  const host = await pageSuiteHost(suite, { seed: 3 });
  try {
    await host.send('We look around.', host.reply('Dust hangs in the lamplight of the office.', ['~ place Bluewatch Village | kind: settlement', '+ item Bedroll | qty: 1', '+ present Sister Temiwa']));
    await host.send('I ask for work.', host.reply('Temiwa nods and slides a ledger across.', ['~ npc Temiwa | trust: +3 | via: help', '+ item Knife | qty: 1']));
    return { header: { user_name: 'Reader', character_name: 'Guide', chat_metadata: structuredClone(host.ctx.chatMetadata) }, messages: structuredClone(host.ctx.chat) };
  } finally {
    host.close();
  }
}

test('recordChat proves what it claims: prompts built, Re-reads ok, receipts seen, id queries asked, deterministic', async t => {
  const got = await loadedSuite();
  if (got.skip) return t.skip(got.skip);
  const chat = await playedChat(got);
  const rec1 = await recordChat({ suite: got.suite, chat });
  const rec2 = await recordChat({ suite: got.suite, chat });

  assert.ok(rec1.replyCount >= 2, 'two or more replies recorded');
  assert.deepEqual(rec1.errors, []);
  for (const reply of rec1.replies) {
    assert.ok(reply.stateHash);
    assert.equal(reply.reread.ok, true, `Re-read of reply ${reply.index} succeeded`);
    assert.ok(reply.reread.headHashAfter && reply.reread.replyHashAfter);
    assert.ok(Object.values(reply.prompt.static).join('').length > 0, 'static prompt text is not empty');
    assert.ok(reply.prompt.parts.length > 0 || Object.keys(reply.prompt.tail).length > 0, 'the next-reply tail was recorded');
  }
  assert.ok(rec1.replies.some(reply => reply.changes.value?.length > 0), 'receipts present on a reply');
  const asked = Object.keys(rec1.queryCoverage.exercised);
  assert.ok(asked.includes('npc.dossier') || rec1.queryCoverage.skipped['npc.dossier'], 'npc.dossier asked or skipped with a reason');
  assert.ok(asked.includes('inventory.find'), 'inventory.find asked with an item name');
  assert.ok(asked.includes('inventory.condition'), 'inventory.condition asked with a stack id');
  assert.ok(rec1.replies.some(reply => Object.keys(reply.queries.targeted).length > 0), 'targeted query values recorded');
  assert.deepEqual(compareRecords(rec1, rec2), { equal: true, differences: [] });

  const altered = structuredClone(rec2);
  altered.replies[0].prompt.static.story_suite_static = 'changed';
  assert.equal(compareRecords(rec1, altered).equal, false, 'a changed static prompt is detected');
});

test('a forced Re-read refusal agrees when both sides refuse alike, but a throw makes the comparison fail', async t => {
  const got = await loadedSuite();
  if (got.skip) return t.skip(got.skip);
  const chat = await playedChat(got);
  for (const breakIt of [
    async () => ({ ok: false, code: 'REFUSED', message: 'forced' }),
    async () => { throw new Error('forced throw'); },
  ]) {
    const suite = { ...got.suite, pageHost: async (...args) => { const host = await pageSuiteHost(...args); host.turn.reread = breakIt; return host; } };
    const a = await recordChat({ suite, chat });
    const b = await recordChat({ suite, chat });
    assert.ok(a.errors.some(item => item.step === 'reread'), 'the failed Re-read is an error in the record');
    assert.ok(a.replies.every(reply => reply.reread.ok === false));
    const verdict = compareRecords(a, b);
    if (a.replies.every(reply => reply.reread.code === 'REFUSED')) {
      assert.equal(verdict.equal, true);
      assert.equal(verdict.expectedRefusals.length, a.replies.length);
    } else {
      assert.equal(verdict.equal, false);
      assert.ok(verdict.differences.some(d => d.field.includes('ERROR reread')));
    }
  }
});
