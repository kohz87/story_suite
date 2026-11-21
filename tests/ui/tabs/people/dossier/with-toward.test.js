import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/dom.js';
import { dossierCards, dossierPages } from '../../../../../ui/tabs/people/dossier/cards.js';
import { withPage } from '../../../../../ui/tabs/people/dossier/feelings.js';
import { selectDossier } from '../../../../../ui/select/dossier.js';

// Owner, 20 Nov: "With Astra no longer shows who or what am I to that NPC".
test('the dossier carries NPC State\'s relationship summary; the With card and page show it first', () => {
  installFakeDom();
  const vm = selectDossier({ dossier: { id: 'npc_temiwa', name: 'Sister Temiwa', relationshipSummary: 'Grateful to the Hulkrow lad who paid fairly; still shy of him.' } });
  assert.equal(vm.toward, 'Grateful to the Hulkrow lad who paid fairly; still shy of him.');
  const d = { ...vm, life: 'alive', changes: [{ meter: 'trust', delta: 2, why: 'paid fairly', reply: 9 }] };
  const pages = dossierPages(d, 'Astra');
  const card = dossierCards(d, pages, {}).querySelector('[data-page="with"]');
  assert.match(card.textContent, /With Astra/);
  assert.match(card.querySelector('.tw').textContent, /Grateful to the Hulkrow lad/);
  assert.match(card.textContent, /Trust \+2/);
  const page = withPage(d).filter(Boolean);
  assert.match(page[0].textContent, /Who you are to them.*Grateful/s);
});
