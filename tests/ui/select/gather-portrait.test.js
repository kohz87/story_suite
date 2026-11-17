// The card's picture when the chat has no party hero: the people row named like the persona, else the persona's avatar file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { optsOf } from '../../../ui/select/gather.js';

const readOf = people => (name) => (name === 'people.list' ? people : null);

test('no party hero: the persona\'s people row portrait is used', () => {
  const opts = optsOf(readOf([{ name: 'Mira', portrait: '/img/mira.png' }]), {}, () => ({ name1: 'Mira', user_avatar: 'u.png' }));
  assert.equal(opts.portrait, '/img/mira.png');
});

test('no party hero and no row: the persona avatar file, encoded; none at all stays null', () => {
  const opts = optsOf(readOf([]), {}, () => ({ name1: 'Mira', user_avatar: 'my face.png' }));
  assert.equal(opts.portrait, '/User%20Avatars/my%20face.png');
  assert.equal(optsOf(readOf([]), {}, () => ({ name1: 'Mira' })).portrait, null);
});

test('a party hero keeps naming the portrait; the persona fallback is not used', () => {
  const read = readOf([{ name: 'Astra', portrait: '/img/a.png' }, { name: 'Mira', portrait: '/img/m.png' }]);
  const opts = optsOf(read, { 'party.pc': { name: 'Astra' } }, () => ({ name1: 'Mira' }));
  assert.equal(opts.portrait, '/img/a.png');
});
