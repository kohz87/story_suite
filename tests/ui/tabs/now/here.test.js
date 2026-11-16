import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { fixture } from '../../../../ui/fixtures/index.js';
import { hereCard } from '../../../../ui/tabs/now/here.js';
import { makeCtx } from './helpers.js';

test('Here lists people with mood, signed feelings, place and thought', () => {
  installFakeDom();
  const here = fixture().now.here;
  const card = hereCard(here, makeCtx());
  assert.equal(card.querySelector('.cnt').textContent, `${here.length} people`);
  const rows = card.querySelectorAll('.hp2');
  assert.equal(rows.length, here.length);
  assert.equal(rows[0].querySelector('.nl b').textContent, here[0].name);
  assert.match(rows[0].querySelector('.fl2').textContent, /T \+\d+/);
  assert.equal(rows[0].querySelectorAll('.ring-arc').length >= 1, true);
  assert.equal(rows[0].querySelector('.wh2').textContent, here[0].where);
});

test('wants and hiding stay hidden until the Scene spoiler is on, and the switch is stored per chat', () => {
  installFakeDom();
  const ctx = makeCtx();
  const here = fixture().now.here;
  const card = hereCard(here, ctx);
  card.querySelector('.more2').click();
  assert.match(card.querySelector('.sec2').textContent, /Hidden · switch on Scene spoilers/);
  assert.equal(card.textContent.includes(here[0].scene.wants), false);
  card.querySelector('[role="switch"]').click();
  assert.equal(ctx.prefs.getSpoiler('scene'), true);
  assert.equal(card.querySelector('.sec2').textContent.includes(here[0].scene.wants), true);
  card.querySelector('[role="switch"]').click();
  assert.equal(card.textContent.includes(here[0].scene.wants), false);
});

test('a saved spoiler level starts shown, and Less closes the detail', () => {
  installFakeDom();
  const ctx = makeCtx();
  ctx.prefs.setSpoiler('scene', true);
  const card = hereCard(fixture().now.here, ctx);
  assert.equal(card.querySelector('[role="switch"]').getAttribute('aria-checked'), 'true');
  const btn = card.querySelector('.more2');
  btn.click();
  assert.equal(card.querySelector('.more2').getAttribute('aria-expanded'), 'true');
  assert.match(card.querySelector('dl').textContent, /Doing/);
  card.querySelector('.more2').click();
  assert.equal(card.querySelector('dl'), null);
});

test('followed mark, no party badge, initial fallback, safe portraits and the dossier link', () => {
  installFakeDom();
  const ctx = makeCtx();
  const base = { personId: 'p', meters: { trust: 0, affection: 0, desire: 0, tension: 0 }, mood: 'calm', where: 'door', thought: null, doing: null, wearing: null, scene: null };
  const card = hereCard([
    { ...base, name: 'Oyla', portrait: null, followed: true, inParty: true },
    { ...base, personId: 'q', name: 'Zed', portrait: 'img/zed.webp', followed: false, inParty: false },
    { ...base, personId: 'r', name: 'Bad', portrait: 'x"),url(evil', followed: false, inParty: false },
  ], ctx);
  const rows = card.querySelectorAll('.hp2');
  assert.equal(rows[0].querySelector('.ph').textContent, 'O');
  assert.equal(rows[0].querySelectorAll('.star').length, 1);
  assert.equal(rows[0].querySelectorAll('.pty').length, 0, 'the party badge is on the Party tab only');
  assert.equal(rows[0].querySelectorAll('.ring-arc').length, 0);
  assert.equal(rows[0].querySelector('.th3'), null);
  assert.equal(rows[1].querySelector('.ph').textContent, '');
  assert.equal(rows[2].querySelector('.ph').textContent, 'B');
  assert.equal(card.querySelector('.cnt').textContent, '3 people');
  rows[1].querySelector('.dossier-link').click();
  assert.deepEqual(ctx.went, [['people', { personId: 'q' }]]);
  assert.equal(hereCard([{ ...base, name: 'Solo', followed: false, inParty: false }], ctx).querySelector('.cnt').textContent, '1 person');
});

test('no one present means no card', () => {
  installFakeDom();
  assert.equal(hereCard([], makeCtx()), null);
  assert.equal(hereCard(undefined, {}), null);
  assert.equal(hereCard(fixture('empty').now.here, {}), null);
});
