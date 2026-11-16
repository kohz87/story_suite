import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/dom.js';
import { createBackStack } from '../../../../../ui/runtime/back-stack.js';
import { dossierPage, dossierPages } from '../../../../../ui/tabs/people/dossier/dossier.js';
import { dossier, makeCtx } from './helpers.js';

const ids = el => el.querySelectorAll('.dcard').map(c => c.dataset.page);
const esc = stack => stack.handleKeydown({ key: 'Escape', preventDefault() {} });
const build = (id, extra = {}) => {
  installFakeDom();
  const backStack = createBackStack();
  const ctx = makeCtx({ backStack, youName: 'Astra', onClose: () => { ctx.closed = (ctx.closed ?? 0) + 1; }, ...extra });
  return { el: dossierPage(dossier(id), ctx), ctx, backStack };
};

test('dossierPages: the living get seven pages, the dead five, and empty Ties, Secrets and Mood are left out', () => {
  assert.deepEqual(dossierPages(dossier('temiwa'), 'Astra').map(p => p.id), ['with', 'mood', 'now', 'ties', 'past', 'secrets', 'profile']);
  assert.equal(dossierPages(dossier('temiwa'), 'Astra')[0].title, 'With Astra');
  assert.deepEqual(dossierPages(dossier('marro')).map(p => p.id), ['death', 'past', 'secrets', 'profile']);
  assert.deepEqual(dossierPages(dossier('dren')).map(p => p.id), ['death', 'past', 'profile']);
  assert.deepEqual(dossierPages(dossier('rika')).map(p => p.id), ['with', 'mood', 'now', 'past', 'profile']);
  assert.equal(dossierPages(dossier('temiwa'))[0].title, 'With you');
});

test('a living dossier shows the hero and the cards in mock order, Past with its count', () => {
  const { el } = build('temiwa');
  assert.equal(el.querySelector('.dname').textContent, dossier('temiwa').name);
  assert.deepEqual(ids(el), ['with', 'mood', 'now', 'ties', 'past', 'secrets', 'profile']);
  assert.match(el.querySelector('[data-page="past"] .dl').textContent, /^Past · 3/);
  assert.equal(el.querySelector('[data-page="with"] .dl').textContent, 'With Astra · last change›');
  assert.equal(el.querySelectorAll('[data-page="past"] .dots i').length, 3);
  assert.equal(el.querySelectorAll('[data-page="past"] .dots b').length, 2);
  assert.deepEqual(el.querySelectorAll('[data-page="ties"] .a').map(a => a.textContent), ['T', 'O', '']);
  assert.match(el.querySelector('[data-page="secrets"]').textContent, /1\/3.*next: opens at Trust 40/);
  assert.equal(el.querySelectorAll('.ml').length, 4);
  assert.ok(el.querySelector('[data-act="map"]'));
  assert.match(el.textContent, /Human · female · 26/);
});

test('empty cards are hidden: Rika has no ties and no secrets, so neither card shows', () => {
  const { el } = build('rika');
  assert.deepEqual(ids(el), ['with', 'mood', 'now', 'past', 'profile']);
  assert.match(el.querySelector('[data-page="with"]').textContent, /Nothing yet/);
});

test('a deceased dossier opens with Death, has a badge, no ring, no map button, and keeps opened secrets', () => {
  const { el } = build('marro');
  assert.deepEqual(ids(el), ['death', 'past', 'secrets', 'profile']);
  assert.equal(el.querySelector('.deadb').textContent, 'Deceased');
  assert.equal(el.querySelector('svg.ring'), null);
  assert.equal(el.querySelector('[data-act="map"]'), null);
  assert.equal(el.querySelector('[data-act="follow"]'), null);
  assert.match(el.querySelector('[data-page="secrets"]').textContent, /1\/1.*all opened/);
});

test('a presumed death is badged, and unknown gender is flagged under the name', () => {
  const { el } = build('dren');
  const badge = el.querySelector('.deadb');
  assert.equal(badge.textContent, 'Presumed dead');
  assert.ok(badge.classList.contains('pres'));
  assert.match(el.querySelector('.idl .gflag').textContent, /gender unknown/);
});

test('opening a card shows its page with the pager and hides the hero on a phone through the paged class', () => {
  const { el } = build('temiwa');
  el.querySelector('[data-page="ties"]').click();
  assert.ok(el.querySelector('.dgrid').classList.contains('paged'));
  assert.equal(el.querySelector('.dpane .ptl b').textContent, 'Ties');
  assert.equal(el.querySelector('.dpane .ptl small').textContent, '4 of 7');
  assert.ok(el.querySelector('.dhero'));
  el.querySelector('[data-act="next"]').click();
  assert.equal(el.querySelector('.dpane .ptl b').textContent, 'Past');
  el.querySelector('[data-act="previous"]').click();
  el.querySelector('[data-act="previous"]').click();
  assert.equal(el.querySelector('.dpane .ptl b').textContent, 'Right now');
  el.querySelector('.pager .bk2').click();
  assert.equal(el.querySelector('.dpane'), null);
  assert.equal(el.querySelector('.dgrid').classList.contains('paged'), false);
});

test('the pager wraps from the last page to the first, and the portrait opens Profile', () => {
  const { el } = build('temiwa');
  el.querySelector('.bigph').click();
  assert.equal(el.querySelector('.dpane .ptl b').textContent, 'Profile');
  el.querySelector('[data-act="next"]').click();
  assert.equal(el.querySelector('.dpane .ptl b').textContent, 'With Astra');
});

test('Escape closes the menu first, then the open page, then the dossier', () => {
  const { el, ctx, backStack } = build('temiwa');
  el.querySelector('[data-page="past"]').click();
  el.querySelector('[data-act="menu"]').click();
  assert.ok(el.querySelector('.menu'));
  assert.deepEqual(backStack.list().map(e => e.layer), ['menu', 'page', 'page']);
  esc(backStack);
  assert.equal(el.querySelector('.menu'), null);
  assert.ok(el.querySelector('.dpane'));
  esc(backStack);
  assert.equal(el.querySelector('.dpane'), null);
  assert.equal(ctx.closed, undefined);
  esc(backStack);
  assert.equal(ctx.closed, 1);
  assert.equal(backStack.size(), 0);
});

test('the back button closes through the back-stack and calls onClose with its origin label', () => {
  const { el, ctx, backStack } = build('temiwa', { origin: '‹ Now' });
  assert.equal(el.querySelector('[data-act="close"]').textContent, '‹ Now');
  el.querySelector('[data-act="close"]').click();
  assert.equal(ctx.closed, 1);
  assert.equal(backStack.size(), 0);
  const second = build('torka');
  assert.equal(second.el.querySelector('[data-act="close"]').textContent, '‹ People');
  second.el.close();
  assert.equal(second.ctx.closed, 1);
});

test('Follow toggles with the star and sends people.follow with the person id; Edit sends npc.edit; See on map uses the hook', async () => {
  const seen = [];
  const { el, ctx } = build('rika', { seeOnMap: id => seen.push(id) });
  const follow = () => el.querySelector('[data-act="follow"]');
  assert.equal(follow().textContent, '☆ Follow');
  follow().click();
  assert.equal(follow().textContent, '★ Following');
  assert.equal(follow().getAttribute('aria-pressed'), 'true');
  follow().click();
  assert.equal(follow().textContent, '☆ Follow');
  el.querySelector('[data-act="edit"]').click();
  el.querySelector('[data-act="map"]').click();
  await Promise.resolve();
  assert.deepEqual(ctx.sent(), [['people.follow', { id: 'rika', on: true }], ['people.follow', { id: 'rika', on: false }], ['npc.edit', { personId: 'rika' }]]);
  assert.deepEqual(seen, ['rika']);
  const noHook = build('temiwa');
  assert.equal(noHook.el.querySelector('[data-act="follow"]').textContent, '★ Following');
  noHook.el.querySelector('[data-act="map"]').click();
  await Promise.resolve();
  assert.deepEqual(noHook.ctx.sent(), [['people.focus', { personId: 'temiwa' }]]);
});

test('a Follow the engine refuses puts the star back', async () => {
  installFakeDom();
  const port = { command: async () => ({ ok: false, code: 'REFUSED' }) };
  const el = dossierPage(dossier('rika'), makeCtx({ port, backStack: createBackStack(), youName: 'Astra' }));
  const follow = () => el.querySelector('[data-act="follow"]');
  follow().click();
  assert.equal(follow().textContent, '★ Following');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(follow().textContent, '☆ Follow');
  assert.equal(follow().getAttribute('aria-pressed'), 'false');
});

test('a living person with no mood has no Mood card or page', () => {
  installFakeDom();
  const d = dossier('rika');
  d.mood = null;
  assert.deepEqual(dossierPages(d).map(p => p.id), ['with', 'now', 'past', 'profile']);
  assert.deepEqual(ids(dossierPage(d, {})), ['with', 'now', 'past', 'profile']);
});

test('the ⋯ menu lists five actions, sends the chosen command and closes; Delete asks twice', async () => {
  const { el, ctx, backStack } = build('temiwa');
  const menu = () => el.querySelector('[data-act="menu"]');
  menu().click();
  assert.deepEqual(el.querySelectorAll('.menu button').map(b => b.dataset.act), ['refresh', 'portrait', 'inspect', 'merge', 'delete']);
  assert.equal(menu().getAttribute('aria-expanded'), 'true');
  el.querySelector('.menu [data-act="merge"]').click();
  assert.equal(el.querySelector('.menu'), null);
  menu().click();
  el.querySelector('.menu [data-act="delete"]').click();
  assert.match(el.querySelector('.menu [data-act="delete"]').textContent, /Tap again to delete/);
  assert.equal(ctx.sent().length, 1);
  el.querySelector('.menu [data-act="delete"]').click();
  await Promise.resolve();
  assert.deepEqual(ctx.sent().map(c => c[0]), ['npc.merge', 'npc.delete']);
  menu().click();
  menu().click();
  assert.equal(el.querySelector('.menu'), null);
  assert.equal(backStack.hasLayer('menu'), false);
});

test('without a back-stack or port the dossier still builds and closes', () => {
  installFakeDom();
  const el = dossierPage(dossier('temiwa'), {});
  el.querySelector('[data-act="follow"]').click();
  el.querySelector('[data-page="mood"]').click();
  el.close();
  assert.ok(dossierPage({ id: 'x', name: 'X', life: 'alive', meters: {}, now: null, ties: [], past: [], secrets: { opened: 0, total: 0, items: [] } }, {}));
});
