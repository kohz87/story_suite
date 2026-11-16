import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { fixture } from '../../../../ui/fixtures/index.js';
import { initialOf, personCard, portraitDisc } from '../../../../ui/tabs/people/person-card.js';

const people = () => fixture().people;

test('a Here tile shows ring, name, mood, where, star and party marks, and opens the dossier', () => {
  installFakeDom();
  const torka = people().here.find(p => p.personId === 'torka');
  const opened = [];
  const tile = personCard(torka, { kind: 'here', onOpen: id => opened.push(id) });
  assert.equal(tile.querySelector('.nm2').textContent, 'Torka');
  assert.equal(tile.querySelector('.md2').textContent, 'restless');
  assert.equal(tile.querySelector('.wh').textContent, 'leaning on the counter');
  assert.ok(tile.querySelector('.star'));
  assert.ok(tile.querySelector('.pty'));
  assert.equal(tile.querySelectorAll('.ring-arc').length, 4);
  assert.equal(tile.querySelector('.sd'), null);
  tile.click();
  assert.deepEqual(opened, ['torka']);
});

test('an Elsewhere tile shows last place, last seen and what they said', () => {
  installFakeDom();
  const ilse = people().elsewhere.find(p => p.personId === 'ilse');
  const tile = personCard(ilse, { kind: 'elsewhere' });
  assert.equal(tile.querySelector('.wh').textContent, 'at the Gull · last seen Goldwane 12');
  assert.match(tile.querySelector('.sd').textContent, /I sail for Harrowgate/);
  assert.equal(tile.querySelector('.star') !== null, true);
  assert.equal(tile.querySelector('.pty'), null);
});

test('a deceased tile has no ring or mood, is greyed, and says when they died', () => {
  installFakeDom();
  const marro = people().deceased[0];
  const tile = personCard(marro, { kind: 'deceased' });
  assert.match(tile.className, /dead/);
  assert.equal(tile.querySelector('svg'), null);
  assert.equal(tile.querySelector('.md2'), null);
  assert.equal(tile.querySelector('.wh').textContent, 'Died Goldwane 12');
});

test('a dormant tile says not seen lately and shows no mood', () => {
  installFakeDom();
  const tile = personCard({ ...people().elsewhere[0], mood: 'alert' }, { kind: 'dormant' });
  assert.equal(tile.querySelector('.wh').textContent, 'not seen lately');
  assert.equal(tile.querySelector('.md2'), null);
});

test('initialOf drops titles; portraitDisc uses safe URLs only and falls back to the initial', () => {
  installFakeDom();
  assert.equal(initialOf({ name: 'Sister Temiwa' }), 'T');
  assert.equal(initialOf({ name: 'Old Marro' }), 'M');
  assert.equal(initialOf({}), '?');
  const safe = portraitDisc({ name: 'A', portrait: 'img/a.webp' });
  assert.match(safe.style.getPropertyValue('background-image'), /url\("img\/a\.webp"\)/);
  assert.equal(safe.textContent, '');
  const bad = portraitDisc({ name: 'Bea', portrait: 'x") ;evil(' });
  assert.equal(bad.style.getPropertyValue('background-image'), '');
  assert.equal(bad.textContent, 'B');
  const word = portraitDisc({ name: 'Cy', portrait: 'cy' });
  assert.equal(word.textContent, 'C');
  assert.equal(word.dataset.portrait, 'cy');
});
