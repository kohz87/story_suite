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
  it('is empty with no setup', () => {
    assert.deepEqual(pinnedFeed(() => null), []);
  });
});
