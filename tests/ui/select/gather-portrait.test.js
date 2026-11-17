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

test('real ST context has no user_avatar: the file is found by name in powerUserSettings.personas', () => {
  const c = { name1: 'Astra', powerUserSettings: { personas: { 'a b.png': 'Astra', 'z.png': 'Other' } } };
  assert.equal(optsOf(readOf([]), {}, () => c).portrait, '/User%20Avatars/a%20b.png');
});

test('two persona files share the name: chat lock or default decides, else none', () => {
  const personas = { 'a.png': 'Astra', 'b.png': 'Astra', 'c.png': 'Other' };
  const at = extra => optsOf(readOf([]), {}, () => ({ name1: 'Astra', powerUserSettings: { personas, ...extra.p }, chatMetadata: extra.m })).portrait;
  assert.equal(at({ p: {} }), null);
  assert.equal(at({ p: {}, m: { persona: 'b.png' } }), '/User%20Avatars/b.png');
  assert.equal(at({ p: { default_persona: 'a.png' } }), '/User%20Avatars/a.png');
});

test('a stale chat lock naming another persona is never used', () => {
  const c = { name1: 'Astra', powerUserSettings: { personas: { 'a.png': 'Astra', 'c.png': 'Other' } }, chatMetadata: { persona: 'c.png' } };
  assert.equal(optsOf(readOf([]), {}, () => c).portrait, '/User%20Avatars/a.png');
  const d = { name1: 'Astra', powerUserSettings: { personas: { 'c.png': 'Other' }, default_persona: 'c.png' }, chatMetadata: { persona: 'c.png' } };
  assert.equal(optsOf(readOf([]), {}, () => d).portrait, null);
});
