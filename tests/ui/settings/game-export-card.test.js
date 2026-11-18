import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './sections/mount.js';
import { toolsCommand } from '../../../ui/port/tools.js';
import { createToolsHandle } from '../../../ui/port/tools-handle.js';
import { createCardSettings } from '../../../packs/card-settings.js';

const press = (el, label) => el.querySelectorAll('.btn2').find(b => b.textContent === label).click();
const tick = () => new Promise(r => setTimeout(r, 0));
const onView = name => (name === 'problems' ? { items: [], rebuild: null } : null);

test('the Game pack card asks the engine and says why when nothing can be exported', async () => {
  const sent = [];
  const { page } = mountSettings({}, { onView, onAction: (k, v) => { sent.push([k, v]); return { ok: false, message: 'Nothing differs from the built-in game.' }; } });
  assert.ok(page('tools').querySelector('[data-card="game-export"]'));
  press(page('tools'), 'Export as a game pack');
  await tick(); await tick();
  assert.deepEqual(sent, [['tools.gamepack.export', { name: 'My settings' }]]);
  assert.ok(page('tools').textContent.includes('Nothing differs from the built-in game.'));
});

test('tools.gamepack.export builds the pack from the live registry each time (a changed setting changes the pack)', async () => {
  let scale = '2';
  const cardSettings = createCardSettings();
  cardSettings.register({ owner: 'story-block-x', label: 'X', sections: { economy: { read: () => (scale ? { scale: Number(scale) } : undefined), apply: async () => true } } });
  const tools = createToolsHandle({ runtime: { cardSettings }, ui: () => null });
  const first = await toolsCommand(tools, 'settings.action', { key: 'tools.gamepack.export', value: { name: 'Mine' } });
  assert.equal(first.ok, true);
  assert.equal(first.pack.content.economy.scale, 2);
  scale = '';
  assert.equal((await toolsCommand(tools, 'settings.action', { key: 'tools.gamepack.export', value: { name: 'Mine' } })).ok, false);
  assert.equal((await toolsCommand(createToolsHandle({ runtime: {}, ui: () => null }), 'settings.action', { key: 'tools.gamepack.export' })).ok, false);
});
