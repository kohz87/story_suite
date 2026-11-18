// SOAK2PEOPLE fixes in the dossier: it follows the story while open (B8), a held change is not the last change (B14), role, tastes and knowledge are on the Profile page (B10).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/dom.js';
import { createBackStack } from '../../../../../ui/runtime/back-stack.js';
import { dossierPage } from '../../../../../ui/tabs/people/dossier/dossier.js';
import { profilePage } from '../../../../../ui/tabs/people/dossier/profile.js';
import { selectDossier } from '../../../../../ui/select/dossier.js';
import { dossier, makeCtx } from './helpers.js';

const text = node => (Array.isArray(node) ? node : [node]).map(n => n.textContent).join(' ');

test('B8: an open dossier draws the fresh record on update, keeping the open page', () => {
  installFakeDom();
  const d = { ...dossier('temiwa'), meters: { trust: 0, affection: 0, desire: 0, tension: 0 } };
  const root = dossierPage(d, makeCtx({ backStack: createBackStack() }));
  assert.match(root.querySelector('.ml[data-meter="trust"]').textContent, /^0TRUST/);
  root.update({ ...d, meters: { ...d.meters, trust: 25 } });
  assert.match(root.querySelector('.ml[data-meter="trust"]').textContent, /\+25/);
  root.update({ ...d, meters: { ...d.meters, trust: 25 }, life: 'deceased', death: { how: 'fell', certainty: 'confirmed' } });
  assert.ok(root.querySelector('.deadb'));
});

test('B14: the last-change card skips a change the allowance held back', () => {
  installFakeDom();
  const d = { ...dossier('temiwa'), changes: [
    { date: 'Oct 4', meter: 'trust', delta: 1, why: 'asked gently', heldBack: true },
    { date: 'Oct 3', meter: 'trust', delta: 6, why: 'carried the body', heldBack: false },
  ] };
  const card = dossierPage(d, makeCtx({ backStack: createBackStack() })).querySelector('[data-page="with"]');
  assert.match(card.textContent, /Trust \+6/);
  assert.doesNotMatch(card.textContent, /\+1 /);
});

test('B10: the Profile page shows the role, tastes and what they know', () => {
  installFakeDom();
  const d = { ...dossier('temiwa'), profile: { role: 'the guild clerk', tastes: [['Likes', 'smoked eel']], knows: ['hunts the singing orc'] } };
  const out = text(profilePage(d));
  for (const word of ['Role', 'the guild clerk', 'Likes', 'smoked eel', 'Knows', 'hunts the singing orc']) assert.ok(out.includes(word), word);
});

test('B10: selectDossier carries the role and the visible notes only', () => {
  const view = selectDossier({ dossier: { id: 'np_1', name: 'Torka', role: 'the hunter', lifeState: 'alive' },
    cast: { notes: { tastes: [{ sign: '+', item: 'smoked eel' }, { sign: '-', item: 'rain' }], knows: [{ hidden: true, text: 'secret' }, { hidden: false, text: 'the ford is low' }] } } });
  assert.equal(view.profile.role, 'the hunter');
  assert.deepEqual(view.profile.tastes, [['Likes', 'smoked eel'], ['Dislikes', 'rain']]);
  assert.deepEqual(view.profile.knows, ['the ford is low']);
});
