// SFW2: World tab fixes: Edit opens an editor that sends chronicle.edit / atlas.edit (W2), the Rumours filter follows the label (W22),
// no stray comma in "heard" (W21), the place sheet says visited / routes (W27).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { worldFor } from '../../../../ui/fixtures/world.js';
import { newsCard, heardLine } from '../../../../ui/tabs/world/news.js';
import { placeSheet } from '../../../../ui/tabs/world/place-sheet.js';
import { editPayload } from '../../../../ui/tabs/world/editor.js';
import { worldTab } from '../../../../ui/tabs/world/world.js';

test('W2: editPayload sends only changed fields with the right id key; nothing when unchanged or blank', () => {
  assert.deepEqual(editPayload('news', 'ev_1', { name: 'New', summary: 'same', state: '' }, { name: 'Old', summary: 'same' }), { id: 'ev_1', name: 'New' });
  assert.deepEqual(editPayload('place', 'p1', { name: 'Auvoth', kind: 'town' }, { name: 'Auvoth', kind: 'city' }), { place: 'p1', kind: 'town' });
  assert.equal(editPayload('faction', 'f1', { name: '  ' }, { name: 'A' }), null);
  assert.equal(editPayload('nope', 'x', { name: 'a' }, {}), null);
});

test('W2: the World tab hands the item to ctx.edit with its current fields (it did nothing without a handler)', () => {
  installFakeDom();
  const w = worldFor();
  const seen = [];
  const tab = worldTab(w, { edit: t => seen.push(t), go() {}, view: 'news' });
  tab.querySelector('.ev .ed').click();
  assert.equal(seen[0].kind, 'news');
  assert.equal(seen[0].id, w.news[0].id);
  assert.equal(seen[0].current.name, w.news[0].title);
});

test('W22: the Rumours filter counts and lists the items labelled rumour', () => {
  installFakeDom();
  const w = worldFor();
  const news = w.news.map((n, i) => ({ ...n, state: 'ongoing', heard: i < 2 ? [{ where: 'in X', when: 'today', from: 'rumour', how: 'rumour' }] : n.heard }));
  const state = { filter: 'rumour' };
  const card = newsCard(news, state, { placeName: () => null, factionName: () => null, edit() {}, setView() {}, gotoPlace() {} });
  assert.equal(card.querySelectorAll('.ev').length, 2);
  assert.equal(card.querySelector('[data-nf="rumour"] small').textContent, '2');
});

test('W21: an empty place or date leaves no stray comma', () => {
  assert.equal(heardLine([{ where: '', when: 'CY 611, October 1', from: null }]), 'heard CY 611, October 1 · you were there');
  assert.equal(heardLine([{ where: 'in Bluewatch', when: '', from: null }]), 'heard in Bluewatch · you were there');
});

test('W27: the place sheet says here / visited and lists the routes', () => {
  installFakeDom();
  const w = worldFor();
  const p = w.places.find(x => x.id === 'auvoth');
  const sheet = placeSheet({ ...p, visited: true, here: false }, w, { rpg: true }, () => {});
  const keys = sheet.querySelectorAll('dt').map(d => d.textContent);
  assert.ok(keys.includes('Status'));
  assert.equal(sheet.querySelectorAll('dd')[keys.indexOf('Status')].textContent, 'Visited');
  const linked = w.routes.some(r => r.a === 'auvoth' || r.b === 'auvoth');
  assert.equal(keys.includes('Routes to'), linked);
});
