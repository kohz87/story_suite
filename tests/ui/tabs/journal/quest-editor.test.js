import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { createBackStack } from '../../../../ui/runtime/back-stack.js';
import { createFakePort } from '../../../../ui/port/fake-port.js';
import { buildJournal } from '../../../../ui/fixtures/journal.js';
import { openQuestEditor } from '../../../../ui/tabs/journal/quest-editor.js';

const boat = () => buildJournal().quests.find(q => q.id === 'boat');
const flush = () => new Promise(resolve => setImmediate(resolve));
const sent = port => port.recorded.map(r => [r.type, r.payload]);
const open = () => globalThis.document.body.querySelector('.sh-ov');
function setup() {
  installFakeDom();
  const port = createFakePort();
  const backStack = createBackStack();
  const refreshed = [];
  return { port, backStack, refreshed, ctx: { port, backStack, refresh: () => refreshed.push(1) } };
}

test('opens the quest form in a sheet and Escape closes it without sending anything', () => {
  const { ctx, port, backStack } = setup();
  openQuestEditor(ctx, boat());
  assert.equal(open().querySelector('.qsheet').getAttribute('aria-label'), 'Edit quest');
  assert.equal(open().querySelector('[role="dialog"]').getAttribute('aria-label'), 'Edit quest');
  assert.equal(backStack.hasLayer('sheet'), true);
  backStack.handleKeydown({ key: 'Escape', preventDefault() {} });
  assert.equal(open(), null);
  assert.deepEqual(sent(port), []);
});

test('Save sends quest.edit with only the changed fields, closes, and refreshes', async () => {
  const { ctx, port, refreshed } = setup();
  openQuestEditor(ctx, boat());
  open().querySelector('input').value = 'Found Hal';
  open().querySelector('.save').click();
  await flush();
  assert.deepEqual(sent(port), [['quest.edit', { id: 'boat', patch: { title: 'Found Hal' } }]]);
  assert.equal(open(), null);
  assert.equal(refreshed.length, 1);
});

test('Save with nothing changed sends nothing but still closes', async () => {
  const { ctx, port } = setup();
  openQuestEditor(ctx, boat());
  open().querySelector('.save').click();
  await flush();
  assert.deepEqual(sent(port), []);
  assert.equal(open(), null);
});

test('give up and delete send their commands; Cancel and × close', async () => {
  const { ctx, port } = setup();
  openQuestEditor(ctx, boat());
  open().querySelector('.giveup').click();
  await flush();
  openQuestEditor(ctx, boat());
  open().querySelector('.delete').click();
  await flush();
  assert.deepEqual(sent(port), [['quest.giveup', { id: 'boat' }], ['quest.delete', { id: 'boat' }]]);
  openQuestEditor(ctx, boat());
  open().querySelector('.cancel').click();
  openQuestEditor(ctx, boat());
  open().querySelector('.qclose').click();
  assert.equal(open(), null);
  assert.equal(port.recorded.length, 2);
});

test('with RPG off it says task, and ctx.command is used when there is no port', async () => {
  installFakeDom();
  const calls = [];
  openQuestEditor({ command: (t, p) => calls.push([t, p]) }, boat(), { rpg: false });
  assert.equal(open().querySelector('[role="dialog"]').getAttribute('aria-label'), 'Edit task');
  open().querySelector('.giveup').click();
  await flush();
  assert.deepEqual(calls, [['quest.giveup', { id: 'boat' }]]);
  openQuestEditor({}, boat()).close();
});
