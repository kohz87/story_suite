import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPrefs } from '../../../ui/runtime/prefs.js';

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}

describe('createPrefs', () => {
  it('stores per-device fold state in storage and port.prefs', () => {
    const storage = createMemoryStorage();
    const portDevice = {};
    const port = {
      prefs: {
        getDevice: () => portDevice,
        setDevice: (k, v) => { portDevice[k] = v; },
      },
    };

    const prefs = createPrefs({ port, storage });
    assert.equal(prefs.getFold('drawer'), false);
    assert.equal(prefs.getFold('foes', true), true);

    assert.equal(prefs.setFold('drawer', true), true);
    assert.equal(prefs.getFold('drawer'), true);
    assert.equal(portDevice.drawer, true);
    assert.equal(prefs.toggleFold('drawer'), false);

    // Hydrates from storage on a new instance.
    const prefs2 = createPrefs({ storage });
    assert.equal(prefs2.getFold('drawer'), false);
    assert.throws(() => prefs.setFold('', true), TypeError);
  });

  it('keeps scene and plan spoilers isolated per chat', () => {
    const commands = [];
    const port = {
      command: (name, args) => {
        commands.push({ name, args });
        return Promise.resolve({ ok: true });
      },
    };

    const prefs = createPrefs({ port, chatId: 'chat-a' });
    assert.deepEqual(prefs.getSpoilers(), { scene: false, plan: false });
    assert.equal(prefs.getSpoiler('scene'), false);

    assert.equal(prefs.toggleSpoiler('scene'), true);
    assert.deepEqual(prefs.getSpoilers(), { scene: true, plan: false });
    assert.deepEqual(commands[0], {
      name: 'prefs.spoiler.set',
      args: { chatId: 'chat-a', level: 'scene', value: true },
    });

    // Switching chats must not leak chat-a spoilers.
    prefs.setChat('chat-b');
    assert.equal(prefs.getChat(), 'chat-b');
    assert.deepEqual(prefs.getSpoilers(), { scene: false, plan: false });

    prefs.setSpoiler('plan', true);
    assert.deepEqual(prefs.getSpoilers(), { scene: false, plan: true });

    // Switching back restores chat-a.
    prefs.setChat('chat-a');
    assert.deepEqual(prefs.getSpoilers(), { scene: true, plan: false });

    assert.throws(() => prefs.getSpoiler('other'), TypeError);
    assert.throws(() => prefs.setSpoiler('other', true), TypeError);
  });

  it('notifies subscribers on fold, spoiler, and chat changes', () => {
    const chatStore = { 'chat-1': { scene: true, plan: false } };
    const port = {
      prefs: {
        getChat: id => chatStore[id],
        setChat: (id, level, val) => {
          chatStore[id] = chatStore[id] ?? { scene: false, plan: false };
          chatStore[id][level] = val;
        },
      },
    };

    const prefs = createPrefs({ port, chatId: 'chat-1' });
    assert.deepEqual(prefs.getSpoilers(), { scene: true, plan: false });

    const events = [];
    const off = prefs.onChange(ev => events.push(ev));

    prefs.setFold('party', true);
    prefs.setSpoiler('plan', true);
    prefs.setChat('chat-2');

    off();
    prefs.setFold('party', false);

    assert.equal(events.length, 3);
    assert.deepEqual(events[0], { kind: 'fold', key: 'party', value: true });
    assert.deepEqual(events[1], { kind: 'spoiler', chatId: 'chat-1', level: 'plan', value: true });
    assert.deepEqual(events[2], { kind: 'chat', chatId: 'chat-2', spoilers: { scene: false, plan: false } });
    assert.equal(chatStore['chat-1'].plan, true);
  });
});
