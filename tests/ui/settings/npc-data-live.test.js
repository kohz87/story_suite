// Settings › Tools › NPC State data: Back up, Restore and Diagnostics reach NPC State's own data dialogs through the real port (no engine command, nothing recorded).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { pageHandles } from '../../../modules/people/runtime/handles.js';
import { createPublicApiReadPart } from '../../../modules/people/runtime/runtime-entry-public-read.js';
import { mountSettings } from './sections/mount.js';

const tick = () => new Promise(r => setTimeout(r, 0));
const press = (el, label) => el.querySelectorAll('.btn2').find(b => b.textContent === label).click();
const sdkOf = calls => ({ command: async (type, payload) => { calls.push([type, payload]); return { ok: true }; }, modules: () => [], settings: () => ({}) });

test('the Tools page has an NPC State data group with the three rows, and each button opens its own dialog; no engine command', async () => {
  const opened = [], calls = [];
  pageHandles.deltaApi = { openDataTool: kind => { opened.push(kind); return true; } };
  try {
    const port = createSbPort({ sdk: sdkOf(calls) });
    const { page } = mountSettings({}, { onAction: (key, value) => port.command('settings.action', { key, value }) });
    let el = page('tools');
    const card = el.querySelector('[data-card="npc-data"]');
    assert.ok(card, 'the group is on the page');
    assert.equal(card.querySelector('.gt').textContent, 'NPC State data');
    assert.deepEqual(card.querySelectorAll('.srow').map(r => r.dataset.key), ['tools.npcdata.backup', 'tools.npcdata.restore', 'tools.npcdata.diagnostics']);
    press(card, 'Back up');
    press(card, 'Restore');
    press(card, 'Open');
    await tick();
    assert.deepEqual(opened, ['backup', 'restore', 'diagnostics']);
    assert.deepEqual(calls, [], 'nothing went to the engine, so nothing is recorded and replay never sees it');
    assert.equal(page('tools').querySelector('[data-note="npc-data"]'), null, 'no line when it worked');
  } finally { pageHandles.deltaApi = null; }
});

test('when NPC State cannot open the dialog the group says why, and the page reads nothing from it', async () => {
  pageHandles.deltaApi = null;
  const port = createSbPort({ sdk: sdkOf([]) });
  const { page } = mountSettings({}, { onAction: (key, value) => port.command('settings.action', { key, value }) });
  press(page('tools'), 'Back up');
  await tick();
  assert.match(page('tools').querySelector('[data-note="npc-data"]').textContent, /NPC State is not running/);
});

test('NPC State\'s public handle starts a data tool only for the three words, and answers false for any other', () => {
  const api = createPublicApiReadPart({});
  assert.equal(typeof api.openDataTool, 'function');
  assert.equal(api.openDataTool('nothing'), false);
  assert.equal(api.openDataTool(undefined), false);
});
