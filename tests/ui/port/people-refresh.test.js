// F8W-10: the dossier's ⋯ › Refresh runs NPC State's Refresh for that person and shows what came of it (it sent nothing the person could see before).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createBackStack } from '../../../ui/runtime/back-stack.js';
import { createPrefs } from '../../../ui/runtime/prefs.js';
import { dossierFor } from '../../../ui/fixtures/dossier.js';
import { dossierPage } from '../../../ui/tabs/people/dossier/dossier.js';
import { refreshCommand } from '../../../ui/port/people-refresh.js';
import { pageHandles } from '../../../modules/people/runtime/handles.js';
import { createSbPort } from '../../../ui/port/sb-port.js';

const sdkOf = calls => ({ command: async (type, payload) => { calls.push([type, payload]); return { ok: true }; }, modules: () => [{ commands: ['npc.refresh'] }] });

test('the port runs NPC State\'s Refresh for the named person and not the stage-only engine command', async () => {
  const asked = [], calls = [];
  pageHandles.deltaApi = { refreshFromChat: async name => { asked.push(name); return true; } };
  try {
    const answer = await createSbPort({ sdk: sdkOf(calls) }).command('npc.refresh', { name: 'Brann' });
    assert.deepEqual(asked, ['Brann']);
    assert.deepEqual(calls, [], 'the engine command was not sent');
    assert.equal(answer.ok, true);
    assert.match(answer.message, /Brann/);
  } finally { pageHandles.deltaApi = null; }
});

test('a Refresh that cannot run says why: busy, no NPC State, a throw, no name', async () => {
  assert.deepEqual(await refreshCommand({ name: 'Brann' }, { refreshFromChat: async () => false }), { ok: false, code: 'FAILED', message: 'Could not re-read the story for Brann now (a scan is running, or there is no recent story text).' });
  assert.equal((await refreshCommand({ name: 'Brann' }, null)).ok, false);
  assert.match((await refreshCommand({ name: 'Brann' }, { refreshFromChat: async () => { throw new Error('offline'); } })).message, /offline/);
  assert.equal((await refreshCommand({}, { refreshFromChat: async () => true })).ok, false);
});

test('the dossier menu\'s Refresh sends the name and writes the answer under the top bar', async () => {
  installFakeDom();
  const sent = [];
  let answer;
  const port = { can: () => true, command: (type, payload) => { sent.push([type, payload]); return new Promise(resolve => { answer = resolve; }); } };
  const root = dossierPage(dossierFor('temiwa'), { port, prefs: createPrefs({ chatId: 'r' }), backStack: createBackStack(), go() {} });
  root.querySelector('[data-act="menu"]').click();
  root.querySelector('[role="menuitem"][data-act="refresh"]').click();
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], 'npc.refresh');
  assert.equal(sent[0][1].name, dossierFor('temiwa').name);
  assert.match(root.querySelector('[role="status"]').textContent, /Re-reading the recent story/);
  answer({ ok: true, message: 'Re-read the recent story for Temiwa.' });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(root.querySelector('[role="status"]').textContent, 'Re-read the recent story for Temiwa.');
});
