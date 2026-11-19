import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
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

test('opening a dossier from People stays on People when closed, labelled with its origin', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc });
  suite.open('people');
  const link = doc.body.querySelector('[data-person-id="torka"]');
  assert.ok(link, 'People has the person');
  link.click();
  const dossier = doc.body.querySelector('.dossier');
  assert.equal(dossier.querySelector('[data-act="close"]').textContent, '‹ People');
  assert.equal(suite.tabHost.current(), 'people');
  dossier.querySelector('[data-act="close"]').click();
  assert.equal(doc.body.querySelector('.dossier'), null);
  assert.equal(suite.tabHost.current(), 'people');
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

test('Day › leaves the dossier and shows the Journal calendar on that day; the chat branch closes it too', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc, initial: 'people' });
  suite.open('people');
  doc.body.querySelector('[data-person-id="temiwa"]').click();
  doc.body.querySelector('.dossier [data-page="past"]').click();
  doc.body.querySelector('.dossier .day').click();
  assert.equal(doc.body.querySelector('.dossier'), null);
  assert.equal(suite.tabHost.current(), 'journal');
  assert.equal(doc.body.querySelector('.journal-body').dataset.view, 'cal', 'the calendar, not the quests');
  const sel = doc.body.querySelector('.journal-body .cd.sel');
  assert.match(sel?.getAttribute('aria-label') ?? '', /^Goldwane 13\b/, 'that memory\'s day is picked');
  assert.equal(suite.backStack.list().filter(e => e.id.startsWith('dossier-')).length, 0);
  suite.tabHost.select('people');
  doc.body.querySelector('[data-person-id="temiwa"]').click();
  doc.body.querySelector('.dossier [data-act="close"]').click();
  assert.equal(doc.body.querySelector('.dossier'), null);
  suite.destroy();
});

test('Day › from a dossier opened over the Journal (a quest giver) still opens the calendar on that day', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc, initial: 'journal' });
  suite.open('journal');
  const giver = doc.body.querySelectorAll('.journal-body .lk').find(b => b.textContent === 'Sister Temiwa');
  assert.ok(giver, 'Temiwa gives a quest');
  giver.click();
  const dossier = doc.body.querySelector('.dossier');
  assert.equal(dossier.querySelector('[data-act="close"]').textContent, '‹ Journal');
  dossier.querySelector('.dcard[data-page="past"]').click();
  const day = dossier.querySelector('.day').dataset.day;
  dossier.querySelector('.day').click();
  assert.equal(doc.body.querySelector('.dossier'), null);
  assert.equal(suite.tabHost.current(), 'journal');
  assert.equal(doc.body.querySelector('.journal-body').dataset.view, 'cal');
  assert.match(doc.body.querySelector('.journal-body .cd.sel')?.getAttribute('aria-label') ?? '', new RegExp(`^${day}\\b`));
  suite.destroy();
});

test('the dossier\'s Map tab is the People tab\'s relationship map with this person picked; Open dossier › shows the picked person in place', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc, initial: 'people' });
  suite.open('people');
  doc.body.querySelector('[data-person-id="temiwa"]').click();
  const dossier = doc.body.querySelector('.dossier');
  dossier.querySelector('[data-tab="map"]').click();
  assert.ok(dossier.querySelector('.castmap'), 'the relationship map');
  assert.equal(dossier.querySelector('.mcard'), null, 'no People-tab picked card: the dossier draws its own');
  assert.equal(dossier.querySelector('.rsel').dataset.picked, 'temiwa');
  assert.match(dossier.querySelector('.rbonds').textContent, /Bonds on the map.*friend of.*Torka/);
  dossier.querySelector('.cmw[data-person-id="torka"]').click();
  assert.equal(dossier.querySelector('.rsel').dataset.picked, 'torka');
  dossier.querySelector('.rsel [data-act="open"]').click();
  assert.equal(doc.body.querySelector('.dossier'), dossier, 'the same dossier, shown in place');
  assert.equal(dossier.dataset.personId, 'torka');
  assert.equal(dossier.querySelector('.dname').textContent, 'Torka');
  assert.equal(suite.tabHost.current(), 'people');
  esc(suite);
  assert.equal(doc.body.querySelector('.dossier'), null, 'one Escape still takes it down');
  suite.destroy();
});

test('the library strip lists everyone once with the open person marked; Following filters it; a tap shows that person in place', () => {
  const doc = installFakeDom();
  const port = createFakePort();
  const suite = mountSuite({ port, doc, initial: 'people' });
  suite.open('people');
  doc.body.querySelector('[data-person-id="temiwa"]').click();
  const dossier = doc.body.querySelector('.dossier');
  const strip = () => dossier.querySelector('.dlib');
  const ids = strip().querySelectorAll('[data-person-id]').map(b => b.dataset.personId);
  assert.equal(new Set(ids).size, ids.length, 'each person once (the view holds them by id and by name)');
  assert.deepEqual(strip().querySelectorAll('[aria-current="true"]').map(b => b.dataset.personId), ['temiwa']);
  strip().querySelector('[data-act="library"]').click();
  assert.ok(strip().classList.contains('open'));
  strip().querySelector('[data-filter="followed"]').click();
  assert.ok(strip().querySelectorAll('.lp').every(b => b.classList.contains('fol')), 'Following shows only the followed');
  strip().querySelector('[data-filter="all"]').click();
  strip().querySelector('.lp[data-person-id="rika"]').click();
  assert.equal(dossier.dataset.personId, 'rika');
  assert.ok(strip().classList.contains('open'), 'the strip stays open');
  suite.destroy();
});
