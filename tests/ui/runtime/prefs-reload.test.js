// F30: Scene spoilers stay on after a reload or a chat switch: the saved choice is read from the chat's metadata each time.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPrefs } from '../../../ui/runtime/prefs.js';

describe('chat spoilers follow the saved chat', () => {
  it('reads the choice again once the chat metadata has loaded (reload)', () => {
    let saved = {};
    let loaded = false;
    const port = { prefs: { getChat: () => (loaded ? { ...saved } : {}), setChat: (_id, level, value) => { saved = { ...saved, [level]: value }; return true; } } };
    const prefs = createPrefs({ port });
    assert.equal(prefs.getSpoiler('scene'), false);
    saved = { scene: true };
    loaded = true;
    assert.equal(prefs.getSpoiler('scene'), true);
  });

  it('shows the new chat\'s choice after a switch, the view keeping one id', () => {
    let meta = { scene: true };
    const port = { prefs: { getChat: () => ({ ...meta }), setChat: (_id, level, value) => { meta = { ...meta, [level]: value }; return true; } } };
    const prefs = createPrefs({ port });
    assert.equal(prefs.getSpoiler('scene'), true);
    meta = {};
    prefs.setChat('other');
    assert.equal(prefs.getSpoiler('scene'), false);
    prefs.setSpoiler('scene', true);
    assert.equal(meta.scene, true);
  });

  it('keeps a choice the chat could not save for this page', () => {
    const port = { prefs: { getChat: () => ({}), setChat: () => false } };
    const prefs = createPrefs({ port });
    prefs.setSpoiler('scene', true);
    assert.equal(prefs.getSpoiler('scene'), true);
  });
});
