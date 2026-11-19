// Settings › Chat extras › Tabs (ui/settings/sections/reply-tabs.js) and the order it stores (ui/select/reply-tabs.js): the four tabs in order,
// ↑ ↓ and a drag move one, a switch hides one, the text read back is always whole, and the port stores it on Story Block for every chat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './mount.js';
import { readTabOrder, writeTabOrder, TAB_IDS } from '../../../../ui/select/reply-tabs.js';
import { moveTab } from '../../../../ui/settings/sections/reply-tabs.js';
import { createSbPort } from '../../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../../ui/select/build.js';
import { createHost } from '../../../../testkit/index.js';

const ids = list => list.map(row => `${row.on ? '' : '-'}${row.id}`).join(' ');

test('the order: unknown and repeated words dropped, missing tabs added at the end, anything else the default', () => {
  assert.deepEqual(TAB_IDS, ['changes', 'chatter', 'here', 'choices']);
  assert.equal(ids(readTabOrder(undefined)), 'changes chatter here choices');
  assert.equal(ids(readTabOrder('choices -here')), 'choices -here changes chatter');
  assert.equal(ids(readTabOrder('Here, here, nope -CHATTER')), 'here -chatter changes choices');
  assert.equal(writeTabOrder([{ id: 'here', on: false }, { id: 'x', on: true }]), '-here changes chatter choices');
  assert.equal(writeTabOrder(null), 'changes chatter here choices');
  assert.deepEqual(moveTab(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(moveTab(['a', 'b'], 0, 5), ['a', 'b'], 'off the end: unchanged');
});

test('the panel: four rows in the stored order; ↑ ↓, a drag and a switch each store the whole order', async () => {
  const stored = [];
  const { page } = mountSettings({ replyTabs: readTabOrder('here changes chatter choices') }, { onChange: (key, value) => { stored.push([key, value]); return { ok: true }; } });
  const el = page('extras');
  const rows = () => el.querySelectorAll('[data-reply-tabs] .stab').map(row => row.dataset.tab);
  assert.deepEqual(rows(), ['here', 'changes', 'chatter', 'choices']);
  assert.match(el.querySelector('[data-reply-tabs] .stab[data-tab="chatter"]').textContent, /needs Inner chatter on/u);
  const up = el.querySelectorAll('[data-reply-tabs] .stab')[0].querySelector('[aria-label="Move Here up"]');
  assert.equal(up.hasAttribute('disabled'), true, 'the first cannot go up');
  el.querySelector('[data-reply-tabs] [aria-label="Move Here down"]').click();
  await Promise.resolve();
  assert.deepEqual(rows(), ['changes', 'here', 'chatter', 'choices']);
  el.querySelector('[data-reply-tabs] .stab[data-tab="chatter"] .sw').click();
  await Promise.resolve();
  const list = el.querySelectorAll('[data-reply-tabs] .stab');
  list[3].dispatchEvent({ type: 'dragstart' });
  list[0].dispatchEvent({ type: 'drop' });
  await Promise.resolve();
  assert.deepEqual(rows(), ['choices', 'changes', 'here', 'chatter']);
  assert.deepEqual(stored, [['extras.tabs', 'changes here chatter choices'], ['extras.tabs', 'changes here -chatter choices'], ['extras.tabs', 'choices changes here -chatter']]);
});

test('stored through the port on Story Block (every chat), and the chat view\'s strip follows it', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost();
  t.after(() => host.close());
  const port = createSbPort({ sdk: host.sdk, writes: { settings: { set: (id, key, v) => host.settings.set(id, key, v) }, features: { set: (id, on) => host.features.set(id, on) } }, selectors: buildSelectors(() => host.ctx, host.sdk) });
  assert.equal((await port.command('settings.set', { key: 'extras.tabs', value: 'choices -here' })).ok, true);
  assert.equal(host.settings('story-block').replyTabs, 'choices -here');
  assert.equal(ids(port.view('chat').tabs), 'choices -here changes chatter');
  assert.equal(ids(port.view('settings').replyTabs), 'choices -here changes chatter');
});
