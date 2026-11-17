import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { applyFlags, parseFlagList } from '../../scripts/dryrun/flags.mjs';
import { compareCards } from '../../scripts/dryrun/compare-cards.mjs';
import { compareRecords } from '../../scripts/dryrun/compare-records.mjs';
import { recordChat } from '../../scripts/dryrun/record-chat.mjs';
import { pageSuiteHost } from '../../scripts/dryrun/suite-host.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = path.join(REPO_ROOT, 'scripts/dryrun/cli.mjs');

test('parseFlagList reads name=value pairs; true and false become booleans', () => {
  assert.deepEqual(parseFlagList('suite.isolatedApply=true, suite.other=false,x=text'), { 'suite.isolatedApply': true, 'suite.other': false, x: 'text' });
  assert.deepEqual(parseFlagList(undefined), {});
  assert.throws(() => parseFlagList('noequals'), /not name=value/);
  assert.throws(() => parseFlagList('=true'), /not name=value/);
});

test('applyFlags sets the flags on the host settings, keeps the others, and does nothing for none', () => {
  const host = { ctx: { extensionSettings: { storySuite: { flags: { keep: true } } } } };
  applyFlags(host, {});
  assert.deepEqual(host.ctx.extensionSettings.storySuite.flags, { keep: true });
  applyFlags(host, { 'suite.isolatedApply': true });
  assert.deepEqual(host.ctx.extensionSettings.storySuite.flags, { keep: true, 'suite.isolatedApply': true });
  const bare = { ctx: {} };
  applyFlags(bare, { a: true });
  assert.deepEqual(bare.ctx.extensionSettings.storySuite.flags, { a: true });
});

test('compareCards lists the replies whose card text differs, and says so when a record has no card text', () => {
  const rec = cards => ({ replies: cards.map((card, index) => ({ index, ...(card === undefined ? {} : { card }) })) });
  assert.deepEqual(compareCards(rec(['a', 'b', 'c']), rec(['a', 'B', 'c'])), { replies: [{ reply: 1, before: 'b', after: 'B' }], missing: false });
  assert.deepEqual(compareCards(rec(['a']), rec(['a'])), { replies: [], missing: false });
  assert.equal(compareCards(rec(['a']), rec([undefined])).missing, true);
  const longer = { replies: [{ index: 0, card: 'a' }, { index: 1, card: 'x' }] };
  assert.deepEqual(compareCards(rec(['a']), longer).replies, [{ reply: 1, before: null, after: 'x' }]);
});

test('compareRecords ignores the card text: records from code with and without the card still compare', () => {
  const base = { errors: [], replies: [{ index: 0, stateHash: 'abc', reread: { ok: true } }] };
  const withCard = structuredClone(base);
  withCard.replies[0].card = 'Moved to Bluewatch';
  assert.deepEqual(compareRecords(base, withCard), { equal: true, differences: [] });
});

let suiteLoad = null;
function loadedSuite() {
  suiteLoad ??= (async () => {
    const tmpRoot = tempDir('dryrun-flags-suite-');
    process.on('exit', () => rmSync(tmpRoot, { recursive: true, force: true }));
    const linked = await import('node:fs');
    for (const [link, dir] of [['Story_block', 'story-block'], ['Story_director', 'story-director'], ['npc_state_delta', 'npc-state-delta']]) {
      linked.symlinkSync(path.join(REPO_ROOT, 'packages', dir), path.join(tmpRoot, link));
    }
    process.env.STORY_SUITE_ROOT = tmpRoot;
    const { loadSuite, suiteHost } = await import(pathToFileURL(path.join(REPO_ROOT, 'tests/suite/break/helpers/suite.js')).href);
    const loaded = await loadSuite();
    return loaded.skip ? { skip: loaded.skip } : { suite: { ...loaded, suiteHost, pageHost: pageSuiteHost } };
  })();
  return suiteLoad;
}

async function playedChat({ suite }) {
  const host = await pageSuiteHost(suite, { seed: 3 });
  try {
    await host.send('We look around.', host.reply('Dust hangs in the lamplight.', ['~ place Bluewatch Village | kind: settlement', '+ item Bedroll | qty: 1']));
    await host.send('I ask for work.', host.reply('Orsolo nods.', ['+ item Knife | qty: 1']));
    return { header: { user_name: 'Reader', character_name: 'Guide', chat_metadata: structuredClone(host.ctx.chatMetadata) }, messages: structuredClone(host.ctx.chat) };
  } finally {
    host.close();
  }
}

test('recordChat records each reply card as text, deterministically; flags reach the host and the record only when given', async t => {
  const got = await loadedSuite();
  if (got.skip) return t.skip(got.skip);
  const chat = await playedChat(got);
  const seen = [];
  const suite = { ...got.suite, pageHost: async (...args) => { const host = await pageSuiteHost(...args); seen.push(host); return host; } };
  const off = await recordChat({ suite, chat });
  const again = await recordChat({ suite, chat });
  assert.deepEqual(off.errors, []);
  assert.ok(off.replies.every(reply => typeof reply.card === 'string'), 'every reply has card text');
  assert.ok(off.replies.some(reply => reply.card.length > 0), 'a reply with changes has a card');
  assert.equal(JSON.stringify(off), JSON.stringify(again), 'the flag-off record is stable');
  assert.ok(!('flags' in off), 'no flags key without --flags');
  assert.equal(JSON.stringify(await recordChat({ suite, chat, flags: {} })), JSON.stringify(off), 'an empty flag set changes nothing');

  const flags = { 'suite.isolatedApply': true };
  const on = await recordChat({ suite, chat, flags });
  assert.deepEqual(on.flags, flags);
  assert.equal(seen.at(-1).ctx.extensionSettings.storySuite.flags['suite.isolatedApply'], true, 'the flag was set on the host');
  assert.equal(seen[0].ctx.extensionSettings.storySuite.flags?.['suite.isolatedApply'], undefined, 'the flag-off host has none');
  assert.deepEqual(compareCards(off, on), { replies: [], missing: false }, 'no card differs while nothing fails');

  const changed = structuredClone(on);
  changed.replies[1].card = `${changed.replies[1].card} X`;
  assert.deepEqual(compareCards(off, changed).replies.map(item => item.reply), [changed.replies[1].index]);
});

test('record --flags and compare --cards work from the command line', t => {
  const dir = tempDir('dryrun-flags-cli-');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const chats = path.join(dir, 'chats');
  mkdirSync(chats);
  const lines = [{ user_name: 'Reader', character_name: 'Guide', chat_metadata: {} }, { name: 'Guide', is_user: false, is_system: false, mes: 'Welcome.' },
    { name: 'Reader', is_user: true, is_system: false, mes: 'Hello.' }, { name: 'Guide', is_user: false, is_system: false, mes: 'Good to see you.' }];
  writeFileSync(path.join(chats, 'synthetic.jsonl'), lines.map(item => JSON.stringify(item)).join('\n') + '\n');
  const run = args => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', cwd: os.tmpdir() });
  const rec = (out, extra) => run(['record', '--code', REPO_ROOT, '--chats', chats, '--out', out, ...extra]);
  const off = path.join(dir, 'off');
  const on = path.join(dir, 'on');
  assert.match(rec(off, []).stdout, /synthetic\.jsonl: \d+ replies/);
  const made = rec(on, ['--flags', 'suite.isolatedApply=true']);
  assert.match(made.stdout, /synthetic\.jsonl: \d+ replies/, made.stderr);
  assert.deepEqual(JSON.parse(readFileSync(path.join(on, 'synthetic.jsonl.json'), 'utf8')).flags, { 'suite.isolatedApply': true });
  assert.ok(!('flags' in JSON.parse(readFileSync(path.join(off, 'synthetic.jsonl.json'), 'utf8'))));
  const same = run(['compare', '--cards', off, on]);
  assert.equal(same.status, 0, same.stdout + same.stderr);
  assert.match(same.stdout, /0 replies with a changed card/);

  const file = path.join(on, 'synthetic.jsonl.json');
  const edited = JSON.parse(readFileSync(file, 'utf8'));
  edited.replies[0].card = 'Module could not finish this reply';
  writeFileSync(file, JSON.stringify(edited));
  const diff = run(['compare', '--cards', off, on]);
  assert.match(diff.stdout, /1 replies with a changed card/);
  assert.match(diff.stdout, /after:  Module could not finish this reply/);

  const bad = rec(path.join(dir, 'bad'), ['--flags', 'oops']);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /not name=value/);
});
