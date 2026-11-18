// Settings › Tools › Chat data on a live host: Export this chat's people goes through the real port to NPC State's own export (its public handle)
// and saves the bundle it makes; a chat change while it is made saves nothing; the two rows on deleted and edited replies say what the suite does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { BUILTIN_MODULES } from '../../../core/modules-list.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { pageHandles } from '../../../modules/people/runtime/handles.js';
import { decodeNpcStateBundle, encodeNpcStateBundle } from '../../../modules/people/bundle/bundle-codec.js';

const settled = async () => { for (let i = 0; i < 4; i += 1) await new Promise(resolve => setTimeout(resolve, 0)); };

// NPC State's public handle as the running module gives it: the open chat, a freshness read and the bundle export of that chat.
function fakeNpcState(chat) {
  const handle = {
    chat,
    uiStatus: () => ({ chatKey: handle.chat }),
    ensureFresh: async () => true,
    exportBytes: async ({ chatKey }) => {
      if (chatKey !== handle.chat) throw new Error('The active chat changed before export; nothing was exported.');
      const bytes = encodeNpcStateBundle({ npcs: [{ id: 'np_1', name: 'Torka' }], turn: 3 }, { appVersion: 'test', chatKey });
      handle.after?.();
      return bytes;
    },
  };
  return handle;
}

async function live(t, api) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ core: true, modules: BUILTIN_MODULES });
  t.after(() => host.close());
  const before = pageHandles.deltaApi;
  pageHandles.deltaApi = api;
  t.after(() => { pageHandles.deltaApi = before; });
  const saved = [];
  t.mock.method(URL, 'createObjectURL', blob => { saved.push(blob); return 'blob:test'; });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const port = createSbPort({ sdk: host.sdk, writes: { settings: host.settings, features: host.features }, selectors: buildSelectors(() => null, host.sdk) });
  installFakeDom();
  const doc = globalThis.document;
  const overlay = createSettingsOverlay({
    doc, host: doc.body, settings: port.view('settings'), renderSection: renderSettingsSection,
    onChange: (key, value) => port.command('settings.set', { key, value }), onAction: (key, value) => port.command('settings.action', { key, value }), onView: (name, args) => port.view(name, args),
  });
  overlay.open('tools');
  const row = key => overlay.el.querySelector(`.srow[data-key="${key}"]`);
  const exportNow = async () => { row('tools.people.export').querySelectorAll('button').find(b => b.textContent === 'Export').click(); await settled(); };
  return { overlay, row, exportNow, saved };
}

test('Export saves NPC State’s bundle of this chat’s people, and the bundle reads back as those people', async t => {
  const api = fakeNpcState('Ersveil - one');
  const { overlay, row, exportNow, saved } = await live(t, api);
  assert.ok(overlay.el.querySelector('[data-card="chat-data"]'), 'the Chat data card is drawn on the live Tools page');
  await exportNow();
  assert.equal(saved.length, 1, 'one file saved');
  const bytes = new Uint8Array(await saved[0].arrayBuffer());
  const decoded = decodeNpcStateBundle(bytes);
  assert.deepEqual(decoded.state.npcs.map(n => n.name), ['Torka']);
  assert.equal(decoded.metadata.sourceChatKey, 'Ersveil - one');
  assert.equal(row('tools.people.export').querySelector('small').textContent, 'Exported 1 person.');
});

test('a chat change while the export is made saves nothing and says so; with no chat or no NPC State it says why', async t => {
  const api = fakeNpcState('Ersveil - one');
  api.after = () => { api.chat = 'Ersveil - two'; };
  const first = await live(t, api);
  await first.exportNow();
  assert.equal(first.saved.length, 0);
  assert.match(first.row('tools.people.export').querySelector('small').textContent, /chat changed/);
  api.after = null;
  api.chat = 'no-chat';
  await first.exportNow();
  assert.equal(first.saved.length, 0);
  assert.match(first.row('tools.people.export').querySelector('small').textContent, /Open a chat first/);
});

test('without NPC State running the Export row says so instead of saving', async t => {
  const { row, exportNow, saved } = await live(t, null);
  await exportNow();
  assert.equal(saved.length, 0);
  assert.match(row('tools.people.export').querySelector('small').textContent, /NPC State is not running/);
});

test('the Chat data rows on deleted and edited replies are plain facts, with no switch to flip', async t => {
  const { row } = await live(t, null);
  for (const key of ['tools.chat.middleDelete', 'tools.chat.edited']) {
    assert.ok(row(key), key);
    assert.equal(row(key).querySelectorAll('button, input, .sw').length, 0, key);
  }
});
