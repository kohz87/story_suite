import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { buildStory } from '../../../../ui/fixtures/story.js';
import { createPrefs } from '../../../../ui/runtime/prefs.js';
import { secretsCard, ripplesCard } from '../../../../ui/tabs/story/ripples-secrets.js';
import { makeCtx } from './helpers.js';

test('secrets hidden: count only; shown: one list with state tags', () => {
  installFakeDom();
  const s = buildStory({ planShown: true });
  assert.match(secretsCard(buildStory().secrets, false).textContent, /3 are hidden/);
  const card = secretsCard(s.secrets, true, makeCtx());
  assert.equal(card.querySelectorAll('.it2').length, 3);
  assert.match(card.textContent, /Who pays the men in grey/);
  assert.equal(card.querySelector('.tagx').textContent, 'held');
});

test('a secret tied to a person links to that dossier; others have no link', () => {
  installFakeDom();
  const ctx = makeCtx();
  const card = secretsCard(buildStory({ planShown: true }).secrets, true, ctx);
  assert.equal(card.querySelectorAll('a').length, 1);
  assert.equal(card.querySelector('a').textContent, 'in Sister Temiwa’s dossier ›');
  card.querySelector('a').click();
  assert.deepEqual(ctx.calls.go, [['people', { personId: 'temiwa' }]]);
});

test('ripples show names, sway numbers and bars, hidden until the plan is shown', () => {
  installFakeDom();
  assert.match(ripplesCard(buildStory().ripples, false).textContent, /3 are hidden/);
  const card = ripplesCard(buildStory({ planShown: true }).ripples, true);
  const rows = card.querySelectorAll('.rip');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].querySelectorAll('span').map(s => s.textContent).join('|'), 'Council of Sails|40');
  assert.equal(rows[0].querySelector('b').style.getPropertyValue('width'), '40%');
  assert.match(card.textContent, /Hidden sway of named powers/);
});

test('empty groups give no card and sway is clamped to the bar', () => {
  installFakeDom();
  assert.equal(secretsCard({ count: 0, items: [] }, true), null);
  assert.equal(ripplesCard(undefined, true), null);
  const wild = { count: 2, items: [{ name: 'a', sway: 250 }, { name: 'b', sway: 'x' }] };
  const bars = ripplesCard(wild, true).querySelectorAll('.rip b').map(b => b.style.getPropertyValue('width'));
  assert.equal(bars[0], '100%');
  assert.equal(bars[1], '0%');
});
