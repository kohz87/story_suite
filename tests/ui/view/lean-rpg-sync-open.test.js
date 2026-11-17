// The old view answers the new view's `story-suite:open` page event by opening the New character window filled in (a person's Add to party → Edit first), and stops at destroy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeanRpgSync } from '../../../ui/legacy/ui-host/lean-rpg-sync.js';

function build() {
  const listeners = new Map();
  const doc = {
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type, fn) => { if (listeners.get(type) === fn) listeners.delete(type); },
  };
  const opened = [];
  const view = { wizard: { open: payload => { opened.push(payload); return {}; } }, destroy() {} };
  const mounts = { card: null, screen: null };
  const deps = { loadLeanRpg: async () => ({ mountLeanRpg: () => view }), doc, ctx: {}, store: {}, events: {}, screens: {}, hostWidgets: {}, registry: {}, runtime: {}, liveCtx: () => null, settings: () => ({}),
    sdk: {}, api: {}, rpgOn: () => true, getHeadState: () => null, getMounts: () => mounts, getOverlay: () => null, refresh() {}, openSettings() {} };
  const fire = detail => { const event = { detail }; listeners.get('story-suite:open')?.(event); return event.detail; };
  return { sync: createLeanRpgSync(deps), fire, opened, listeners };
}

test('the open event opens the wizard with the payload once the RPG screens are loaded; other screens and a missing wizard are not handled; destroy removes the listener', async () => {
  const { sync, fire, opened, listeners } = build();
  assert.equal(fire({ id: 'story-block/new-character', payload: { name: 'Mara' }, handled: false }).handled, false, 'not loaded yet: not handled');
  sync.syncLeanRpg();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(fire({ id: 'story-block/new-character', payload: { name: 'Mara', soul: 1, best: '' }, handled: false }).handled, true);
  assert.deepEqual(opened, [{ name: 'Mara', soul: 1, best: '' }]);
  assert.equal(fire({ id: 'other/screen', payload: {}, handled: false }).handled, false);
  sync.destroy();
  assert.equal(listeners.has('story-suite:open'), false);
});
