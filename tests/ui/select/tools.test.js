import test from 'node:test';
import assert from 'node:assert/strict';
import { selectProblems, selectSent, selectInspector } from '../../../ui/select/tools.js';
import { selectSettings } from '../../../ui/select/settings.js';

const size = { tail: 551, static: 900, own: [{ tokens: 40 }], total: 1491 };

test('a permanent dossier block is a Problems entry with the two ways to start again; a transient one is not', () => {
  const hard = selectProblems({ problems: [{ module: 'people', code: 'X', message: 'bad', index: 2 }], blocked: { blockedBy: { module: 'npc', code: 'SNAPSHOT_UNAVAILABLE' } }, nameOf: id => `N:${id}` });
  assert.equal(hard.items[0].reply, 3);
  assert.equal(hard.rebuild.name, 'N:npc');
  assert.deepEqual(hard.rebuild.choices.map(c => c.read), ['last-40', 'all']);
  assert.equal(selectProblems({ problems: [], blocked: { blockedBy: { module: 'npc', code: 'TIMEOUT' } } }).rebuild, null);
});

test('sent is null with no chat; with one it carries the notes bar, the fixed part, the text and a problems count', () => {
  assert.equal(selectSent(null, { items: [], rebuild: null }), null);
  const sent = selectSent({ size, budget: 1500, text: 'hello' }, { items: [{}], rebuild: { } });
  assert.deepEqual([sent.used, sent.cap, sent.total, sent.text], [551, 1500, 1491, 'hello']);
  assert.deepEqual(sent.budget.map(b => b.name), ['Notes this reply', 'Fixed part', 'Modules on their own']);
  assert.match(sent.tools[1].hint, /^2 problems/);
});

test('settings holds the budget rows in sent.limits (not twice) once a chat is read, and in the section when none is', () => {
  const answers = { host: { tailBudget: 1500, contextShare: 40, maxChangeLines: 150 }, schema: { tailBudget: { type: 'int', label: 'Notes' }, contextShare: { type: 'int', label: 'Share' }, maxChangeLines: { type: 'int', label: 'Lines' } }, defaults: {} };
  const tools = id => ({ sent: { size, budget: 1500, text: 't' }, problems: [], blocked: null, nameOf: id });
  const withChat = selectSettings({ ...answers, tools: tools() });
  assert.equal(withChat.sent.limits.length, 3);
  assert.equal(withChat.sections.find(s => s.id === 'tools').rows.length, 0);
  const none = selectSettings(answers);
  assert.equal(none.sent, null);
  assert.equal(none.sections.find(s => s.id === 'tools').rows.length, 3);
});

test('the Inspector view follows the newest reply, clamps a stale index and reads the reply asked for', () => {
  const asked = [];
  const handle = { replies: [{ index: 5, name: 'A', snippet: 's', rev: 3, head: true }, { index: 2, name: 'A', snippet: 'o', rev: 1, head: false }],
    reply: i => { asked.push(i); return { ok: true, name: 'A', rev: 3, head: i === 5, diff: { entries: [{ kind: 'add', path: '/x', after: 1 }, { kind: 'change', path: '/y', before: 1, after: 2 }], more: 0 }, ops: [1], receipts: [{ id: 'r', type: 't', module: 'm', summary: 'did' }], problems: [], state: { a: 1 } }; } };
  const newest = selectInspector(handle);
  assert.equal(newest.index, 5);
  assert.deepEqual(newest.reply.lines.map(l => [l.kind, l.after]), [['add', '1'], ['change', '2']]);
  assert.equal(selectInspector(handle, 99).index, 5, 'a reply that no longer keeps the story (swiped away, deleted) falls back to the newest');
  assert.equal(selectInspector(handle, 2).index, 2);
  assert.deepEqual(asked, [5, 5, 2]);
  assert.deepEqual(selectInspector({ replies: [], reply: () => assert.fail('no reply to read') }).reply, null);
  assert.equal(selectInspector({ replies: handle.replies, reply: () => ({ ok: false, message: 'no story' }) }).reply.message, 'no story');
});
