import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/dom.js';
import { tiesPage, pastPage, secretsPage } from '../../../../../ui/tabs/people/dossier/past-secrets.js';
import { tieInitial } from '../../../../../ui/tabs/people/dossier/tie-disc.js';
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
  assert.match(ties[0].textContent, /Torka.*friend.*childhood · Tem to her/);
  assert.equal(ties[0].querySelector('em').textContent, 'friend', 'the first word is the tag; the rest is the line');
  assert.equal(ties[0].querySelector('small').textContent, 'childhood · Tem to her');
  assert.match(tiesPage({ ties: [] }, ctx).textContent, /No ties known/);
  const swapped = [];
  tiesPage(dossier('temiwa'), { ...ctx, openPerson: id => swapped.push(id) }).querySelector('.tie').click();
  assert.deepEqual(swapped, ['torka'], 'inside a dossier the tie shows that person in place');
});

test('Past: each memory with its story date and reply when stamped (none when not); Day › opens the journal; + Add a memory sends a command', async () => {
  installFakeDom();
  const ctx = makeCtx();
  const [list, add] = pastPage(dossier('temiwa'), ctx);
  const rows = list.querySelectorAll('.ev');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].querySelector('.w').textContent, 'Goldwane 13reply #14');
  assert.equal(rows[0].querySelector('.w b').textContent, 'Goldwane 13');
  assert.equal(rows[2].querySelector('.w').textContent, '', 'an unstamped memory shows no date and no reply');
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

test('Secrets: each in its own box, opened text readable under its rule, locked ones show only the rule; the counts close the part', () => {
  installFakeDom();
  const parts = secretsPage(dossier('temiwa'));
  assert.match(parts.at(-1).textContent, /^1 opened · 2 still hidden\./);
  const rows = parts.filter(p => p.classList.contains('sec'));
  assert.equal(rows.length, 3);
  assert.equal(rows[0].querySelector('.h').textContent, '✓ Opened · Trust 15');
  assert.match(rows[0].textContent, /Grew up in the same orphanage/);
  assert.match(rows[0].textContent, /shared the Bluewatch orphanage/);
  assert.equal(rows[1].dataset.open, 'false');
  assert.match(rows[1].textContent, /Locked.*Opens at Trust 40/);
  assert.doesNotMatch(rows[1].textContent, /orphanage/);
});

test('a dead person keeps their opened secret readable', () => {
  installFakeDom();
  const [box] = secretsPage(dossier('marro'));
  assert.match(box.textContent, /Waved the bandits through for a share of the toll/);
  assert.match(box.textContent, /strongbox lists what the bandits paid him/);
  assert.equal(secretsPage({}).length, 1);
});

test('tieInitial takes the first letter of the last word, upper-cased', () => {
  assert.equal(tieInitial({ name: 'Old Sera Vane' }), 'V');
  assert.equal(tieInitial({ name: 'oyla' }), 'O');
  assert.equal(tieInitial({}), '?');
  installFakeDom();
  const page = tiesPage(dossier('temiwa'), {});
  assert.deepEqual(page.querySelectorAll('.tie .a').map(a => a.textContent), ['T', 'O', '']);
  assert.equal(page.querySelectorAll('.tie .a').at(-1).querySelectorAll('svg').length, 1, 'a nameless tie shows the person glyph');
});
