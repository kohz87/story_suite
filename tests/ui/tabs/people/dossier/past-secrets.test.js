import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/dom.js';
import { tiesPage, pastPage, secretsPage, tieInitial } from '../../../../../ui/tabs/people/dossier/past-secrets.js';
import { dossier, makeCtx } from './helpers.js';

test('Ties: a tie with a person opens their dossier, one without is plain text', async () => {
  installFakeDom();
  const ctx = makeCtx();
  const page = tiesPage(dossier('temiwa'), ctx);
  const ties = page.querySelectorAll('.tie');
  assert.equal(ties.length, 3);
  assert.equal(ties[0].tagName, 'BUTTON');
  assert.equal(ties[1].tagName, 'DIV');
  ties[0].click();
  assert.deepEqual(ctx.calls.go, [['people', { personId: 'torka' }]]);
  assert.match(ties[0].textContent, /Torka.*friend · childhood/);
  assert.match(tiesPage({ ties: [] }, ctx).textContent, /No ties known/);
});

test('Past: Day › shows only when the memory has a day, opens the journal, and + Add a memory sends a command', async () => {
  installFakeDom();
  const ctx = makeCtx();
  const [list, add] = pastPage(dossier('temiwa'), ctx);
  assert.equal(list.querySelectorAll('.e').length, 3);
  assert.equal(list.querySelectorAll('.day').length, 2);
  list.querySelector('.day').click();
  assert.deepEqual(ctx.calls.go, [['journal', { day: 'Goldwane 13' }]]);
  add.click();
  await Promise.resolve();
  assert.deepEqual(ctx.sent(), [['npc.memory.add', { personId: 'temiwa' }]]);
});

test('Past with no memories says so and still offers to add one', () => {
  installFakeDom();
  const [list, add] = pastPage({ id: 'x', past: [] }, {});
  assert.match(list.textContent, /No memories yet/);
  assert.match(add.textContent, /Add a memory/);
  add.click();
});

test('Secrets: counts, opened text readable, locked ones show only the rule', () => {
  installFakeDom();
  const [intro, list] = secretsPage(dossier('temiwa'));
  assert.match(intro.textContent, /^1 opened · 2 still hidden\./);
  const rows = list.querySelectorAll('.sec');
  assert.equal(rows.length, 3);
  assert.match(rows[0].textContent, /Grew up in the same orphanage/);
  assert.match(rows[0].textContent, /shared the Bluewatch orphanage/);
  assert.equal(rows[1].dataset.open, 'false');
  assert.match(rows[1].textContent, /A secret.*Opens at Trust 40/);
  assert.doesNotMatch(rows[1].textContent, /orphanage/);
});

test('a dead person keeps their opened secret readable', () => {
  installFakeDom();
  const [, list] = secretsPage(dossier('marro'));
  assert.match(list.textContent, /Waved the bandits through for a share of the toll/);
  assert.match(list.textContent, /strongbox lists what the bandits paid him/);
  assert.equal(secretsPage({}).length, 1);
});

test('tieInitial drops a leading "the" and upper-cases', () => {
  assert.equal(tieInitial({ name: 'the Harbour Master' }), 'H');
  assert.equal(tieInitial({ name: 'oyla' }), 'O');
  assert.equal(tieInitial({}), '?');
  installFakeDom();
  const page = tiesPage(dossier('temiwa'), {});
  assert.deepEqual(page.querySelectorAll('.tie .a').map(a => a.textContent), ['T', 'O', 'H']);
});
