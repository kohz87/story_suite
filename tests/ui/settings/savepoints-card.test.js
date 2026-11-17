// The Save points card on Settings › Tools, live: the real save points over the testkit host (a SillyTavern-like branch), the real handle, selector, port action and page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { createSavePoints } from '../../../core/timeline/rewind.js';
import { CORE_FEATURE } from '../../../core/features.js';
import { createToolsHandle } from '../../../ui/port/tools-handle.js';
import { toolsCommand } from '../../../ui/port/tools.js';
import { selectSavePoints } from '../../../ui/select/tools.js';
import { mountSettings } from './sections/mount.js';

const tick = () => new Promise(r => setTimeout(r, 0));
const press = (el, label) => el.querySelectorAll('.btn2').find(b => b.textContent === label).click();
const clone = v => structuredClone(v);

async function played() {
  const host = await createHost();
  await host.send('Look around.', 'You find rope.\n<Changes>\n+ item Rope\n</Changes>');
  await host.send('Go on.', 'Two coins glint.\n<Changes>\n+ coin 2\n</Changes>');
  host.ctx.saveMetadata = async () => {};
  const made = [];
  const opened = [];
  const points = createSavePoints({
    ctx: host.ctx, store: host.store, live: () => host.ctx, now: () => Date.UTC(2026, 10, 18, 9, 5),
    createBranch: async index => { const name = `${host.ctx.chatId} - Branch #${made.length + 1}`; made.push(index); host.st.chats[name] = clone(host.ctx.chat.slice(0, index + 1)); return name; },
    open: async name => { opened.push(name); },
  });
  const tools = createToolsHandle({ runtime: host, ui: () => null, savePoints: () => points });
  const view = name => (name === 'savepoints' ? selectSavePoints(tools.savePoints()) : null);
  const page = mountSettings({}, { onView: view, onAction: (key, value) => toolsCommand(tools, 'settings.action', { key, value }) });
  return { host, tools, made, opened, page };
}

test('Save point asks for a name, makes the branch at the latest reply and lists it (name, message, date); the story is untouched', async () => {
  const { host, tools, made, page } = await played();
  const head = clone(host.head());
  let el = page.page('tools');
  assert.ok(el.textContent.includes('No save points in this chat yet.'));
  press(el, 'Save point');
  el = page.page('tools');
  const input = el.querySelector('input.txt2');
  assert.equal(input.getAttribute('placeholder'), 'Save point 1');
  input.value = 'Before the bridge';
  press(el, 'Save');
  await tick(); await tick();
  assert.deepEqual(made, [4]);
  el = page.page('tools');
  const row = el.querySelector('[data-savepoint]');
  assert.ok(row.textContent.includes('Before the bridge') && row.textContent.includes('Message 5'));
  assert.equal(tools.savePoints().points.length, 1);
  assert.deepEqual(clone(host.head()), head, 'no receipt, no rev');
  assert.ok(el.querySelectorAll('.srow').find(r => r.textContent.includes('Saved.')), 'the card says it saved');
});

test('Return here opens the branch; Forget takes it off the list and keeps the branch', async () => {
  const { host, tools, opened, page } = await played();
  const made = await tools.makeSavePoint('One');
  assert.equal(made.ok, true);
  let el = page.page('tools');
  press(el, 'Return here');
  await tick(); await tick();
  assert.deepEqual(opened, ['chat-1 - Branch #1'].map(n => n.replace('chat-1', host.ctx.chatId)));
  press(page.page('tools'), 'Forget');
  await tick(); await tick();
  assert.equal(tools.savePoints().points.length, 0);
  assert.ok(host.st.chats[opened[0]], 'the branch itself is kept');
  assert.ok(page.page('tools').textContent.includes('No save points in this chat yet.'));
});

test('with the feature off the card is gone and the list is not read; back on, it is there again', async () => {
  const { host, tools, page } = await played();
  await tools.makeSavePoint('One');
  assert.ok(page.page('tools').querySelector('[data-card="savepoints"]'));
  host.features.set(CORE_FEATURE.savepoints, false);
  assert.deepEqual(tools.savePoints(), { on: false, here: host.ctx.chatId, points: [] });
  assert.equal(page.page('tools').querySelector('[data-card="savepoints"]'), null);
  host.features.set(CORE_FEATURE.savepoints, true);
  assert.equal(page.page('tools').querySelectorAll('[data-savepoint]').length, 1);
});

test('a refusal is said on the card', async () => {
  const { tools } = await played();
  const refuse = { ...tools, makeSavePoint: async () => ({ ok: false, code: 'LIMITED', message: 'This chat has 50 save points, the most it keeps; forget one first.' }) };
  const page = mountSettings({}, { onView: name => (name === 'savepoints' ? selectSavePoints(tools.savePoints()) : null), onAction: (key, value) => toolsCommand(refuse, 'settings.action', { key, value }) });
  press(page.page('tools'), 'Save point');
  press(page.page('tools'), 'Save');
  await tick(); await tick();
  assert.ok(page.page('tools').textContent.includes('The save point could not be made: This chat has 50 save points'));
});
