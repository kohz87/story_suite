import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pinnedFeed } from '../../../ui/select/pinned.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { selectNow } from '../../../ui/select/now.js';

const SETUP = [
  { module: 'rep', pinned: true, definition: { name: 'Reputation', scope: 'chat', show: { card: true }, state: { bluewatch: { label: 'Bluewatch' } } } },
  { module: 'off', pinned: true, definition: { name: 'Hidden', scope: 'chat', show: { card: false }, state: {} } },
  { module: 'gone', pinned: false, definition: { name: 'Unpinned', scope: 'chat', show: { card: true }, state: {} } },
];
const read = (name, args) => (name === 'dataModules.setup' ? SETUP : name === 'dataModules.view' ? { chat: { bluewatch: 25 } } : args && null);

describe('pinnedFeed', () => {
  it('gives only the pinned blocks switched on for Now, with their field labels', () => {
    assert.deepEqual(pinnedFeed(read), [{ id: 'rep', name: 'Reputation', view: { chat: { Bluewatch: 25 } } }]);
  });
  it('reaches the Now view-model as a pinned card', () => {
    assert.deepEqual(selectNow({}, { pinned: pinnedFeed(read) }).pinned, [{ trackerId: 'rep', name: 'Reputation', fields: [{ label: 'Bluewatch', value: '25' }] }]);
  });
  it('is on the Now tab through the selector map (a block with Show on Now appears)', () => {
    const now = buildSelectors(() => null, null).now(read);
    assert.deepEqual(now.pinned.map(card => card.name), ['Reputation']);
  });
  it('leaves out the fields a block keeps for its own rules (SOAK2UI 17)', () => {
    const state = { hp: { label: 'HP' }, rise: { label: 'Rise', prompt: false, edit: false }, cap: { label: 'Level cap', prompt: false }, 'hp-max': { label: 'HP largest', prompt: false, edit: false }, down: { label: 'Down', prompt: false } };
    const setup = [{ module: 'c', pinned: true, definition: { name: 'Astra', scope: 'chat', show: { card: true }, state } }];
    const feed = pinnedFeed(name => (name === 'dataModules.setup' ? setup : { chat: { hp: 9, rise: 0, cap: 99, 'hp-max': 20, down: false } }));
    assert.deepEqual(feed[0].view.chat, { HP: 9 });
  });
  it('keeps a field the story is told but the reader may not edit (a skill rank)', () => {
    const state = { rank1: { label: 'Rank 1', edit: false }, practice1: { label: 'Practice 1', edit: false }, rise: { label: 'Rise', prompt: false, edit: false } };
    const setup = [{ module: 's', pinned: true, definition: { name: 'Skills', scope: 'chat', show: { card: true }, state } }];
    const feed = pinnedFeed(name => (name === 'dataModules.setup' ? setup : { chat: { rank1: 2, practice1: 5, rise: 0 } }));
    assert.deepEqual(feed[0].view.chat, { 'Rank 1': 2, 'Practice 1': 5 });
  });
  it('is empty with no setup', () => {
    assert.deepEqual(pinnedFeed(() => null), []);
  });
});
