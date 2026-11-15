import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../packages/story-block/tests/ui-fake-dom.js';
import { mountSuite } from '../../../ui/mount.js';
import { createFakePort } from '../../../ui/port/fake-port.js';

const esc = suite => suite.backStack.handleKeydown({ key: 'Escape', preventDefault() {} });

test('opening a person from the People tab shows their dossier over the suite, and Escape takes it down', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc, initial: 'people' });
  suite.open('people');
  assert.equal(doc.body.querySelector('.dossier'), null);
  doc.body.querySelector('[data-person-id="torka"]').click();
  const dossier = doc.body.querySelector('.dossier');
  assert.ok(dossier);
  assert.equal(dossier.dataset.personId, 'torka');
  assert.equal(dossier.querySelector('[data-act="close"]').textContent, '‹ People');
  esc(suite);
  assert.equal(doc.body.querySelector('.dossier'), null);
  assert.equal(suite.tabHost.current(), 'people');
  suite.destroy();
});

test('opening a dossier from Now returns to Now, labelled with its origin', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc });
  suite.open('now');
  const link = doc.body.querySelector('.dossier-link');
  assert.ok(link, 'Now has a Dossier › link');
  link.click();
  const dossier = doc.body.querySelector('.dossier');
  assert.equal(dossier.querySelector('[data-act="close"]').textContent, '‹ Now');
  assert.equal(suite.tabHost.current(), 'people');
  dossier.querySelector('[data-act="close"]').click();
  assert.equal(doc.body.querySelector('.dossier'), null);
  assert.equal(suite.tabHost.current(), 'now');
  suite.destroy();
});

test('a second dossier replaces the first', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc, initial: 'people' });
  suite.open('people');
  doc.body.querySelector('[data-person-id="torka"]').click();
  doc.body.querySelector('[data-person-id="rika"]').click();
  const open = doc.body.querySelectorAll('.dossier');
  assert.equal(open.length, 1);
  assert.equal(open[0].dataset.personId, 'rika');
  assert.equal(suite.backStack.list().filter(e => e.id.startsWith('dossier-')).length, 1);
  suite.destroy();
});

test('a person with no dossier view-model, or a port with no dossier view, opens nothing', () => {
  const doc = installFakeDom();
  const full = createFakePort();
  const { dossier, ...rest } = full.view('card') ? { dossier: null, ...Object.fromEntries(['card', 'now', 'chat', 'people'].map(k => [k, full.view(k)])) } : {};
  const suite = mountSuite({ port: createFakePort({ views: rest }), doc, initial: 'people' });
  suite.open('people');
  doc.body.querySelector('[data-person-id="torka"]').click();
  assert.equal(doc.body.querySelector('.dossier'), null);
  suite.destroy();
  const unknown = mountSuite({ port: createFakePort(), doc, initial: 'people' });
  unknown.open('people');
  assert.equal(unknown.tabHost.current(), 'people');
  unknown.destroy();
});

test('Day › leaves the dossier and shows the Journal; the chat branch closes it too', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc, initial: 'people' });
  suite.open('people');
  doc.body.querySelector('[data-person-id="temiwa"]').click();
  doc.body.querySelector('.dossier [data-page="past"]').click();
  doc.body.querySelector('.dossier .day').click();
  assert.equal(doc.body.querySelector('.dossier'), null);
  assert.equal(suite.tabHost.current(), 'journal');
  assert.equal(suite.backStack.list().filter(e => e.id.startsWith('dossier-')).length, 0);
  suite.tabHost.select('people');
  doc.body.querySelector('[data-person-id="temiwa"]').click();
  doc.body.querySelector('.dossier [data-act="close"]').click();
  assert.equal(doc.body.querySelector('.dossier'), null);
  suite.destroy();
});

test('See on map from a dossier opened on Now lands on the People map focused on that person', () => {
  const doc = installFakeDom();
  const port = createFakePort();
  const suite = mountSuite({ port, doc });
  suite.open('now');
  doc.body.querySelector('.dossier-link').click();
  const id = doc.body.querySelector('.dossier').dataset.personId;
  doc.body.querySelector('.dossier [data-act="map"]').click();
  assert.equal(doc.body.querySelector('.dossier'), null);
  assert.equal(suite.tabHost.current(), 'people');
  assert.ok(doc.body.querySelector('.castmap'), 'the map view is showing');
  assert.match(doc.body.querySelector('.fchip').textContent, /Focus:/);
  assert.equal(doc.body.querySelector('.mcard').dataset.picked, id);
  suite.destroy();
});

test('See on map from the People tab itself redraws the tab on the map', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc, initial: 'people' });
  suite.open('people');
  doc.body.querySelector('[data-person-id="torka"]').click();
  doc.body.querySelector('.dossier [data-act="map"]').click();
  assert.equal(doc.body.querySelector('.dossier'), null);
  assert.ok(doc.body.querySelector('.castmap'));
  assert.equal(doc.body.querySelector('.mcard').dataset.picked, 'torka');
  suite.destroy();
});
