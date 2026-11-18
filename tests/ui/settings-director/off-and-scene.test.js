// Settings › Director on the real host, real selectors and the real mount: a group whose feature is off says which feature to turn on, and Scene spoilers is the chat's own switch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { storyDirectorModule } from '../../../modules/director/module.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { chatPrefs } from '../../../ui/port/st-chat.js';
import { PREFS_KEY } from '../../../ui/port/prefs-key.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { mountSuite } from '../../../ui/mount.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';

async function live(t, { off = [], meta = {} } = {}) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ modules: [storyDirectorModule] });
  t.after(() => host.close());
  const chat = { chatMetadata: meta, saveMetadata() {} };
  const ctx = () => chat;
  for (const id of off) host.features.set?.(id, false);
  const sdk = off.length ? { ...host.sdk, features: () => host.sdk.features().map(f => (off.includes(f.id) ? { ...f, on: false } : f)) } : host.sdk;
  const writes = { settings: { set: (id, key, value) => host.settings.set(id, key, value) } };
  const port = createSbPort({ sdk, writes, selectors: buildSelectors(ctx, sdk), prefs: { device: { get: () => ({}), set() {} }, chat: chatPrefs(ctx) } });
  return { host, port, chat };
}
const rows = port => port.view('settings').sections.find(s => s.id === 'director').rows;
const openDirector = (port, doc) => {
  const suite = mountSuite({ port, doc });
  suite.open('now');
  suite.settings();
  doc.body.querySelector('.si3[data-sec="director"]').click();
  return suite;
};

test('a group whose feature is off says "Turn on X to see these" with the hidden rows, and the rows are not drawn', async t => {
  const { port } = await live(t, { off: ['story-director.pulse'] });
  const list = rows(port);
  assert.equal(list.some(r => r.key === 'director.pulse'), false);
  const note = list.find(r => r.key === 'director.off.story-director.pulse');
  assert.equal(note.type, 'info');
  assert.equal(note.group, 'World pulse');
  assert.equal(note.label, 'Turn on World pulse to see these');
  assert.match(note.hint, /Pulse.*The pulse may invent events.*Show the roll under replies/);
  const doc = installFakeDom();
  const suite = openDirector(port, doc);
  assert.match(doc.body.textContent, /Turn on World pulse to see these/);
  assert.equal(doc.body.querySelector('[data-key="director.pulse"]'), null);
  suite.destroy();
});

test('with every feature on there is no such line', async t => {
  const { port } = await live(t);
  assert.equal(rows(port).some(r => r.type === 'info'), false);
});

test('Scene spoilers is a real working row: it reads this chat, the page switch writes the chat prefs and the same switch as Now, and it follows a chat change', async t => {
  const { port, chat } = await live(t);
  assert.equal(rows(port).find(r => r.key === 'director.sceneSpoilers').value, true, 'hidden until shown');
  const doc = installFakeDom();
  const suite = openDirector(port, doc);
  const sw = () => doc.body.querySelector('[data-key="director.sceneSpoilers"] .sw');
  assert.equal(sw().getAttribute('aria-checked'), 'true');
  sw().click();
  assert.equal(chat.chatMetadata[PREFS_KEY].scene, true, 'shown now: written to this chat');
  assert.equal(rows(port).find(r => r.key === 'director.sceneSpoilers').value, false);
  sw().click();
  assert.equal(chat.chatMetadata[PREFS_KEY].scene, false);
  suite.destroy();
  chat.chatMetadata = { [PREFS_KEY]: { scene: true } };
  assert.equal(rows(port).find(r => r.key === 'director.sceneSpoilers').value, false, 'another chat reads its own choice');
});

test('the mock rows with no setting behind them (Cast moves read / longest) are not on the page', async t => {
  const { port } = await live(t);
  assert.equal(rows(port).some(r => /^Cast moves/.test(r.label)), false);
});

test('the port alone answers the Scene spoilers row too (a host without the mounted view): it writes this chat', async t => {
  const { port, chat } = await live(t);
  assert.deepEqual(await port.command('settings.set', { key: 'director.sceneSpoilers', value: false }), { ok: true, value: false });
  assert.equal(chat.chatMetadata[PREFS_KEY].scene, true);
});
