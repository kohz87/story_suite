// Settings › Packs and trackers: each tracker button opens its own Story › Trackers sheet (the mount, the page and the Story tab, no stubs between).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { mountSuite } from '../../../ui/mount.js';
import { createFakePort } from '../../../ui/port/fake-port.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

function openPacks() {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc });
  suite.open('now');
  suite.settings();
  doc.body.querySelector('.si3[data-sec="packs"]').click();
  const press = label => doc.body.querySelectorAll('.btn2').filter(b => b.textContent === label);
  return { doc, suite, press };
}

test('Edit fields on a tracker closes Settings and opens that tracker’s editor on Story › Trackers', async () => {
  const { doc, suite, press } = openPacks();
  assert.equal(press('Edit fields').length, 2);
  press('Edit fields')[1].click();
  await flush();
  assert.ok(doc.body.querySelector('.si3[data-sec="packs"]').closest('[hidden]'), 'Settings is closed');
  assert.ok(doc.body.querySelector('[data-view="trackers"]'));
  assert.match(doc.body.querySelector('.sh-ov')?.textContent ?? '', /Edit Ship/);
  suite.destroy();
});

test('Add from a template closes Settings and opens the template list; New tracker and Build it in the chat are gone', async () => {
  const { doc, suite, press } = openPacks();
  assert.equal(press('New tracker').length + press('Build it in the chat').length + press('From a template').length, 0);
  press('Add from a template')[0].click();
  await flush();
  assert.ok(doc.body.querySelector('.si3[data-sec="packs"]').closest('[hidden]'), 'Settings is closed');
  assert.ok(doc.body.querySelector('[data-view="trackers"]'));
  assert.ok(doc.body.querySelector('.sh-ov [data-template]'), 'the template sheet is open');
  suite.destroy();
});

test('the sheet opens once: a redraw of the Trackers view does not reopen it', async () => {
  const { doc, suite, press } = openPacks();
  press('Add from a template')[0].click();
  await flush();
  doc.body.querySelector('.sh-ov').remove();
  suite.open('story');
  await flush();
  assert.equal(Boolean(doc.body.querySelector('.sh-ov')), false);
  suite.destroy();
});
