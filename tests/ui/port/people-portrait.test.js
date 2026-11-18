// B4-5: the dossier's ⋯ › Portrait opens NPC State's portrait manager (it lived in the old dossier panel, which is gone).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createBackStack } from '../../../ui/runtime/back-stack.js';
import { createPrefs } from '../../../ui/runtime/prefs.js';
import { dossierFor } from '../../../ui/fixtures/dossier.js';
import { dossierPage } from '../../../ui/tabs/people/dossier/dossier.js';
import { portraitCommand } from '../../../ui/port/people-portrait.js';
import { pageHandles } from '../../../modules/people/runtime/handles.js';
import { createSbPort } from '../../../ui/port/sb-port.js';

const sdkOf = calls => ({ command: async (type, payload) => { calls.push([type, payload]); return { ok: true }; }, modules: () => [] });

test('the port answers npc.portrait itself: it opens NPC State\'s portrait manager for the named person, no engine command', async () => {
  const asked = [], calls = [];
  pageHandles.deltaApi = { openPortraitTools: name => { asked.push(name); return true; } };
  try {
    const port = createSbPort({ sdk: sdkOf(calls) });
    assert.equal(port.can('npc.portrait'), true, 'the dossier menu shows Portrait');
    assert.deepEqual(await port.command('npc.portrait', { personId: 'p1', name: 'Brann' }), { ok: true });
    assert.deepEqual(asked, ['Brann']);
    assert.deepEqual(calls, [], 'nothing went to the engine (nothing is recorded)');
  } finally { pageHandles.deltaApi = null; }
});

test('a Portrait that cannot open says why: no name, no NPC State, no dossier, a throw', () => {
  assert.equal(portraitCommand({}, { openPortraitTools: () => true }).ok, false);
  assert.match(portraitCommand({ name: 'Brann' }, null).message, /not running/);
  assert.match(portraitCommand({ name: 'Brann' }, { openPortraitTools: () => false }).message, /Brann has no NPC State dossier/);
  assert.match(portraitCommand({ name: 'Brann' }, { openPortraitTools: () => { throw new Error('no dialog'); } }).message, /no dialog/);
});

test('the dossier menu\'s Portrait sends the person\'s name', () => {
  installFakeDom();
  const sent = [];
  const port = { can: () => true, command: (type, payload) => { sent.push([type, payload]); return { ok: true }; } };
  const d = dossierFor('temiwa');
  const root = dossierPage(d, { port, prefs: createPrefs({ chatId: 'r' }), backStack: createBackStack(), go() {} });
  root.querySelector('[data-act="menu"]').click();
  root.querySelector('[role="menuitem"][data-act="portrait"]').click();
  assert.deepEqual(sent, [['npc.portrait', { personId: d.id, name: d.name }]]);
});
