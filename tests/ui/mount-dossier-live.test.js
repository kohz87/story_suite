// B8: a dossier left open over the tabs is drawn again when the story changes (a reply, an Edit save), with its page kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/ui-fake-dom.js';
import { mountSuite } from '../../ui/mount.js';
import { createFakePort } from '../../ui/port/fake-port.js';
import { fixture } from '../../ui/fixtures/index.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

test('an open dossier shows the new trust after a port change, and stays open', async () => {
  const doc = installFakeDom();
  const port = createFakePort({ views: fixture('default') });
  const dossiers = structuredClone(port.view('dossier'));
  const id = Object.keys(dossiers).find(key => dossiers[key].life === 'alive');
  const read = port.view.bind(port);
  port.view = (name, args) => (name === 'dossier' ? dossiers : read(name, args));
  const suite = mountSuite({ port, doc });
  suite.open('people');
  await flush();
  doc.body.querySelector(`[data-person-id="${id}"]`).click();
  const open = () => doc.body.querySelector('.dossier');
  assert.ok(open(), 'the dossier is open');
  const trust = () => open().querySelector('.ml[data-meter="trust"]').textContent;
  dossiers[id] = { ...dossiers[id], meters: { ...dossiers[id].meters, trust: 77 } };
  port.emit('head', {});
  await flush();
  assert.match(trust(), /\+77/);
  assert.ok(open(), 'still open');
  suite.destroy();
});
