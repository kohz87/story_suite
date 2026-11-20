import test from 'node:test';
import assert from 'node:assert/strict';
import { dossierHero } from '../../../../../ui/tabs/people/dossier/hero.js';
import { installFakeDom } from '../../../helpers/dom.js';
import { feelingsHero } from '../../../../../ui/tabs/people/dossier/feelings.js';

const person = (portrait) => ({ name: 'Pella', life: 'alive', meters: { trust: 3, affection: 1, desire: 0, tension: 0 }, portrait });

test('a tap on a portrait fills the portrait column with it; a tap or Close takes it away; Profile › still opens the profile', () => {
  installFakeDom();
  const dov = document.createElement('section'); dov.className = 'dhero'; document.body.appendChild(dov);
  let profile = 0;
  const hero = feelingsHero(person('/user/images/pella.webp'), { onProfile: () => { profile += 1; } });
  dov.appendChild(hero);
  hero.querySelector('.bigph').click();
  const box = dov.querySelector('.dlbox');
  assert.ok(box, 'the full-size view');
  assert.equal(box.querySelector('img').getAttribute('src'), '/user/images/pella.webp');
  assert.equal(profile, 0, 'the portrait tap is not the profile');
  box.querySelector('.dlbox-x').click();
  assert.equal(dov.querySelector('.dlbox'), null, 'Close takes it away');
  hero.querySelector('.prof').click();
  assert.equal(profile, 1, 'Profile › opens the profile');
  assert.equal(dov.querySelector('.dlbox'), null, 'and shows no full-size view');
});

test('with no portrait the disc opens the profile, as before', () => {
  installFakeDom();
  let profile = 0;
  const hero = feelingsHero(person(null), { onProfile: () => { profile += 1; } });
  document.body.appendChild(hero);
  hero.querySelector('.bigph').click();
  assert.equal(profile, 1);
  assert.equal(document.querySelector('.dlbox'), null);
});

test('with Profile open the portrait column holds the portrait full size (tablet and desktop; CSS hides it on a phone); not without a picture or another part (owner, 20 Nov)', () => {
  const d = { name: 'Sister Temiwa', portrait: '/examples/packs/ersveil/portraits/temiwa.webp', life: 'alive', feelings: {} };
  const open = dossierHero(d, { profileOpen: true });
  assert.ok(open.classList.contains('pfopen'));
  assert.equal(open.querySelector('.dhfull img').getAttribute('src'), d.portrait);
  assert.equal(dossierHero(d, {}).querySelector('.dhfull'), null);
  assert.equal(dossierHero({ ...d, portrait: 'temiwa' }, { profileOpen: true }).querySelector('.dhfull'), null);
});
