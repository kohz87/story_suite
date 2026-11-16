import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { fixture } from '../../../../ui/fixtures/index.js';
import { TIES } from '../../../../ui/fixtures/dossier.js';
import { LENSES, castMap, lensValue, placePeople } from '../../../../ui/tabs/people/map.js';

function cast() {
  const vm = fixture().people;
  return [...vm.here.map(p => ({ ...p, here: true })), ...vm.elsewhere.map(p => ({ ...p, here: false }))];
}
const build = (extra = {}) => castMap({ people: cast(), ties: TIES.map(t => ({ ...t })), state: { lens: 'warmth' }, handlers: {}, ...extra });

test('lensValue: warmth is the mean of trust and affection, other lenses read one meter', () => {
  const p = { meters: { trust: 22, affection: 9, desire: 3, tension: -4 } };
  assert.equal(lensValue(p, 'warmth'), 16);
  assert.equal(lensValue(p, 'tension'), -4);
  assert.equal(lensValue(p, 'desire'), 3);
  assert.equal(lensValue({}, 'trust'), 0);
  assert.equal(LENSES.length, 5);
});

test('placePeople is deterministic, keeps everyone inside the map and puts warm people closer than cold ones', () => {
  const two = [
    { personId: 'a', meters: { trust: 80, affection: 80 } },
    { personId: 'b', meters: { trust: -80, affection: -80 } },
  ];
  const first = placePeople(two, 'warmth');
  assert.deepEqual(first, placePeople(two, 'warmth'));
  const dist = ([x, y]) => Math.hypot(x - 50, y - 50);
  assert.ok(dist(first.a) < dist(first.b));
  for (const [x, y] of Object.values(placePeople(cast(), 'tension'))) {
    assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 100);
  }
  assert.deepEqual(placePeople([], 'warmth'), {});
});

test('the map has one face per person, the centre, three rings, tie lines and the legend', () => {
  installFakeDom();
  const map = build();
  assert.equal(map.querySelectorAll('.cmw').length, cast().length);
  assert.equal(map.querySelectorAll('.ring2').length, 3);
  assert.equal(map.querySelectorAll('.tie-line').length, TIES.length);
  assert.ok(map.querySelector('.cm.you'));
  assert.match(map.querySelector('.fine').textContent, /dashed outer ring = cold · hostile/);
  assert.match(map.querySelector('.mleg').textContent, /rival/);
  assert.match(map.querySelector('.mcard').textContent, /Tap a face/);
  const temiwa = map.querySelector('[data-person-id="temiwa"]');
  assert.match(temiwa.getAttribute('aria-label'), /Sister Temiwa, warmth \+16, here/);
  assert.ok(map.querySelector('[data-person-id="rika"]').className.includes('away'));
});

test('lens buttons and faces call the handlers; the picked card names ties and offers Open and Focus', () => {
  installFakeDom();
  const calls = [];
  const went = [];
  const handlers = { lens: v => calls.push(['lens', v]), pick: v => calls.push(['pick', v]), focus: v => calls.push(['focus', v]) };
  let map = build({ handlers, ctx: { go: (t, a) => went.push([t, a]) } });
  map.querySelector('[data-value="trust"]').click();
  map.querySelector('[data-person-id="torka"]').click();
  assert.deepEqual(calls, [['lens', 'trust'], ['pick', 'torka']]);
  map = build({ handlers, ctx: { go: (t, a) => went.push([t, a]) }, state: { lens: 'warmth', sel: 'torka' } });
  const card = map.querySelector('.mcard');
  assert.equal(card.dataset.picked, 'torka');
  assert.match(card.textContent, /friend Temiwa/);
  assert.match(card.textContent, /rival Oyla/);
  card.querySelector('[data-act="focus"]').click();
  card.querySelector('[data-act="open"]').click();
  assert.deepEqual(calls.at(-1), ['focus', 'torka']);
  assert.deepEqual(went, [['people', { personId: 'torka' }]]);
});

test('focus keeps only that person\'s ties, dims the rest, shows a clear chip and hides the Focus button', () => {
  installFakeDom();
  const calls = [];
  const map = build({ state: { lens: 'tension', sel: 'torka', focus: 'torka' }, handlers: { focus: v => calls.push(v) } });
  const lines = map.querySelectorAll('.tie-line');
  assert.equal(lines.length, 3);
  assert.ok(lines.every(l => l.dataset.a === 'torka' || l.dataset.b === 'torka'));
  assert.equal(map.querySelector('[data-person-id="rika"]').dataset.dim, '1');
  assert.equal(map.querySelector('[data-person-id="brann"]').dataset.dim, '0');
  assert.equal(map.querySelector('[data-act="focus"]'), null);
  const chip = map.querySelector('.fchip');
  assert.match(chip.textContent, /Focus: Torka/);
  chip.click();
  assert.deepEqual(calls, [null]);
  assert.match(map.querySelector('.fine').textContent, /higher tension/);
});

test('an unknown lens falls back to warmth, an unknown focus is ignored, and an empty cast still draws', () => {
  installFakeDom();
  const map = castMap({ people: [], state: { lens: 'nope', focus: 'ghost' } });
  assert.equal(map.dataset.lens, 'warmth');
  assert.equal(map.querySelectorAll('.cmw').length, 0);
  assert.equal(map.querySelector('.fchip'), null);
});
