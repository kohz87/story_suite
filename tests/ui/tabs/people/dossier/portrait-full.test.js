import test from 'node:test';
import assert from 'node:assert/strict';
import { dossierHero } from '../../../../../ui/tabs/people/dossier/hero.js';
import { installFakeDom } from '../../../helpers/dom.js';
import { feelingsHero } from '../../../../../ui/tabs/people/dossier/feelings.js';

const person = (portrait) => ({ name: 'Pella', life: 'alive', meters: { trust: 3, affection: 1, desire: 0, tension: 0 }, portrait });

test('a tap on the portrait opens the Profile, as Profile › does (owner, 20 Nov: the Profile shows it full size in the portrait column)', () => {
  installFakeDom();
  let profile = 0;
  const hero = feelingsHero(person('/user/images/pella.webp'), { onProfile: () => { profile += 1; } });
  document.body.appendChild(hero);
  hero.querySelector('.bigph').click();
  assert.equal(profile, 1, 'the portrait opens the profile');
  hero.querySelector('.prof').click();
  assert.equal(profile, 2, 'Profile › opens the profile');
  assert.equal(document.querySelector('.dlbox'), null, 'no separate viewer');
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
