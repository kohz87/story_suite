import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/dom.js';
import { peopleDrawer } from '../../../ui/chat/people-drawer.js';
import { fixture } from '../../../ui/fixtures/index.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { CHAT_SHAPE } from '../../../ui/contract/chat.js';

const rows = () => fixture('default').chat.drawer;

test('returns null when nobody is present', () => {
  installFakeDom();
  assert.equal(peopleDrawer([]), null);
  assert.equal(peopleDrawer(null), null);
  assert.equal(peopleDrawer(fixture('empty').chat.drawer), null);
});

test('open drawer shows the header count and one page of cards', () => {
  installFakeDom();
  const list = rows();
  assert.deepEqual(checkShape(list, CHAT_SHAPE.drawer), []);
  const d = peopleDrawer(list, { perPage: 2 });
  assert.match(d.querySelector('.dhd').textContent, new RegExp(`Here · ${list.length}`));
  assert.equal(d.querySelectorAll('.pc2').length, Math.min(2, list.length));
  assert.equal(d.querySelectorAll('.mf').length, list.length);
  const first = d.querySelector('.pc2');
  assert.match(first.textContent, new RegExp(list[0].name));
  assert.equal(first.querySelectorAll('svg path').length > 0, true);
  assert.equal(d.querySelector('.dhd').getAttribute('aria-expanded'), 'true');
});

test('folded drawer has only the header and reports the toggle', () => {
  installFakeDom();
  const seen = [];
  const d = peopleDrawer(rows(), { folded: true, onToggle: v => seen.push(v) });
  assert.equal(d.querySelectorAll('.dbody2').length, 0);
  assert.equal(d.querySelector('.dhd').getAttribute('aria-expanded'), 'false');
  d.querySelector('.dhd').click();
  assert.deepEqual(seen, [false]);
  const open = peopleDrawer(rows(), { onToggle: v => seen.push(v) });
  open.querySelector('.dhd').click();
  assert.deepEqual(seen, [false, true]);
});

test('arrows page within bounds and dots follow the page', () => {
  installFakeDom();
  const list = [...rows(), ...rows()].slice(0, 5).map((p, i) => ({ ...p, personId: `p${i}`, name: `N${i}` }));
  const pages = [];
  const a = peopleDrawer(list, { perPage: 2, page: 0, onPage: p => pages.push(p) });
  const [prev, next] = a.querySelectorAll('.arr');
  assert.equal(prev.hasAttribute('disabled'), true);
  next.click();
  assert.deepEqual(pages, [1]);
  assert.equal(a.querySelectorAll('.dots2 i').length, 3);
  const last = peopleDrawer(list, { perPage: 2, page: 99 });
  assert.equal(last.dataset.page, '2');
  assert.equal(last.querySelectorAll('.pc2').length, 1);
  assert.equal(last.querySelectorAll('.arr')[1].hasAttribute('disabled'), true);
  assert.equal(last.querySelector('.dots2 i.on') !== null, true);
});

test('swipe on the row pages by direction and ignores short drags', () => {
  installFakeDom();
  const list = [...rows(), ...rows()].slice(0, 4).map((p, i) => ({ ...p, personId: `q${i}` }));
  const pages = [];
  const d = peopleDrawer(list, { perPage: 2, page: 1, onPage: p => pages.push(p) });
  const row = d.querySelector('.prow');
  row.dispatch('touchstart', { changedTouches: [{ clientX: 100 }] });
  row.dispatch('touchend', { changedTouches: [{ clientX: 130 }] });
  assert.deepEqual(pages, []);
  row.dispatch('touchstart', { changedTouches: [{ clientX: 100 }] });
  row.dispatch('touchend', { changedTouches: [{ clientX: 200 }] });
  assert.deepEqual(pages, [0]);
});

test('single page shows no dots; card opens the dossier by click and keyboard', () => {
  installFakeDom();
  const opened = [];
  const list = rows().slice(0, 1);
  const d = peopleDrawer(list, { perPage: 4, onOpenPerson: id => opened.push(id) });
  assert.equal(d.querySelectorAll('.dots2').length, 0);
  const c = d.querySelector('.pc2');
  c.click();
  c.dispatch('keydown', { key: 'Enter' });
  c.dispatch('keydown', { key: 'a' });
  assert.deepEqual(opened, [list[0].personId, list[0].personId]);
  assert.match(c.getAttribute('aria-label'), /Open dossier/);
});

test('portraits: safe urls become backgrounds, others fall back to the initial; where is cut to 40', () => {
  installFakeDom();
  const base = { personId: 'a', meters: { trust: 50, affection: 0, desire: 0, tension: 0 }, mood: 'calm', thought: null };
  const d = peopleDrawer([
    { ...base, name: 'Ann', portrait: 'img/ann.webp', where: 'x'.repeat(60) },
    { ...base, personId: 'b', name: 'Bo', portrait: 'a"); evil(' , where: '' },
  ], { perPage: 2 });
  const phs = d.querySelectorAll('.ph');
  assert.match(phs[0].style.getPropertyValue('background-image'), /img\/ann\.webp/);
  assert.equal(phs[1].style.getPropertyValue('background-image'), '');
  assert.equal(phs[1].textContent, 'B');
  assert.equal(d.querySelector('.wh3').textContent.length, 40);
  assert.equal(d.querySelectorAll('.th4').length, 0);
});
