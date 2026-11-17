import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { mountSuite } from '../../../../ui/mount.js';
import { createFakePort } from '../../../../ui/port/fake-port.js';
import { sceneFixture } from '../../../../ui/fixtures/interaction.js';

test('the activity tab, named after the activity, appears when an interaction opens, opens on its own view, and goes when it is discarded', () => {
  const doc = installFakeDom();
  const port = createFakePort();
  const suite = mountSuite({ port, doc });
  suite.open();
  assert.equal(suite.tabHost.tabs().includes('scene'), false);
  const views = { ...Object.fromEntries(['card', 'now', 'chat'].map(tab => [tab, port.view(tab)])), scene: sceneFixture('open') };
  port.setVariant({});
  const answer = { ...views };
  port.view = tab => structuredClone(answer[tab] ?? null);
  port.emit('interaction', { ok: true });
  assert.equal(suite.tabHost.tabs().includes('scene'), true);
  assert.equal(suite.tabHost.el.querySelector('.su-tab[data-tab="scene"]').textContent, 'The ferry cross…');
  suite.open('scene');
  assert.ok(doc.body.querySelector('[data-tab="scene"][data-kind="probe/ferry"]'));
  delete answer.scene;
  port.emit('interaction', { ok: true, discarded: true });
  assert.equal(suite.tabHost.tabs().includes('scene'), false);
  suite.destroy();
});
