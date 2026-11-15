import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/dom.js';
import { deathPage, deathCard } from '../../../../../ui/tabs/people/dossier/death.js';
import { dossier, makeCtx } from './helpers.js';

test('Death page: how, when, where, certainty, the reference line, and Mark alive sends npc.markAlive', async () => {
  installFakeDom();
  const ctx = makeCtx();
  const d = dossier('marro');
  const parts = deathPage(d, ctx);
  assert.deepEqual(parts[0].querySelectorAll('dt').map(n => n.textContent), ['How', 'When', 'Where', 'Certainty']);
  assert.equal(parts[0].querySelectorAll('dd')[3].textContent, 'Confirmed');
  assert.match(parts[0].querySelectorAll('dd')[1].textContent, /\(the reply that recorded it\)$/);
  assert.match(parts[0].querySelectorAll('dd')[2].textContent, /\(where they were\)$/);
  assert.equal(parts[2].querySelector('.remline').textContent, d.death.referenceLine);
  assert.match(parts[2].querySelector('.secl').textContent, /When the story mentions Old Marro/);
  parts[1].querySelector('[data-act="mark-alive"]').click();
  await Promise.resolve();
  assert.deepEqual(ctx.sent(), [['npc.markAlive', { personId: 'marro' }]]);
});

test('a presumed death reads "Presumed" and the card shows the question mark', () => {
  installFakeDom();
  const d = dossier('dren');
  assert.equal(deathPage(d, {})[0].querySelectorAll('dd')[3].textContent, 'Presumed');
  const card = deathCard(d);
  assert.match(card[2].textContent, /^\? Presumed/);
  assert.equal(deathCard(dossier('marro'))[2].textContent.startsWith('✓'), true);
});

test('no death record: the card is null and the page says so', () => {
  installFakeDom();
  assert.equal(deathCard(dossier('temiwa')), null);
  assert.match(deathPage(dossier('temiwa'), {}).textContent, /No death is recorded/);
});
