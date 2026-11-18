// B4-5: NPC State's "open this person's dossier" (a present card, the world's People list, its public openDossier) opens the view's
// own dossier directly, through suite.person(keys); the old dossier panel and its open-dossier page event are gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { mountSuite } from '../../../ui/mount.js';
import { createFakePort } from '../../../ui/port/fake-port.js';

test('suite.person opens the suite on People with that dossier, by store id or by lower-case name', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc });
  assert.equal(doc.body.querySelector('.dossier'), null);
  assert.equal(suite.person(['torka']), true);
  assert.equal(suite.tabHost.current(), 'people');
  assert.equal(doc.body.querySelector('.dossier').dataset.personId, 'torka');
  const name = createFakePort().view('dossier').rika.name.toLocaleLowerCase();
  assert.equal(suite.person(['npc_unknown_id', name]), true, 'an NPC State id the store does not use falls back to the name');
  const open = doc.body.querySelectorAll('.dossier');
  assert.equal(open.length, 1, 'the second replaces the first');
  assert.equal(open[0].dataset.personId, 'rika');
  suite.destroy();
});

test('suite.person opens nothing for someone with no dossier, and nothing once destroyed', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc });
  assert.equal(suite.person(['nobody', 'no one']), false);
  assert.equal(doc.body.querySelector('.dossier'), null);
  suite.destroy();
  assert.equal(suite.person(['torka']), false);
});
