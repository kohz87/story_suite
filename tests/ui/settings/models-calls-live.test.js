// The Models page's Calls group on a live runtime: "Most output per People call" is an editor that stores NPC State's scannerMaxOutputTokens, and Repair and Fallback each say when they run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../../core/runtime.js';
import { createFakeContext } from '../../../testkit/fake-st.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';

function mount() {
  const st = createFakeContext({ chat: [] });
  const runtime = createRuntime({ ctx: st.ctx });
  const port = createSbPort({ sdk: runtime.sdk, writes: runtime.writes, selectors: buildSelectors(() => st.ctx, runtime.sdk) });
  const doc = installFakeDom();
  const calls = [];
  const ov = createSettingsOverlay({ doc, settings: port.view('settings'), renderSection: renderSettingsSection, onChange: (k, v) => { calls.push([k, v]); port.command('settings.set', { key: k, value: v }); }, onAction() {} });
  ov.open();
  ov.show('models');
  return { st, port, ov, calls, bucket: () => st.ctx.extensionSettings.storySuite?.modules?.['npc-state-delta'] };
}
const edit = (ov, v) => { const input = ov.el.querySelector('.spage [data-key="calls.maxOutput"] input'); input.value = v; input.dispatchEvent(new globalThis.Event('change')); };

test('Most output per People call is a number box (0 = built-in); an entry is stored cut the way the engine cuts it', () => {
  const { ov, bucket, calls } = mount();
  const input = ov.el.querySelector('.spage [data-key="calls.maxOutput"] input');
  assert.equal(input.value, '0');
  edit(ov, '2000');
  assert.deepEqual(calls.at(-1), ['calls.maxOutput', 2000]);
  assert.equal(bucket().scannerMaxOutputTokens, 2000);
  edit(ov, '50');
  assert.equal(bucket().scannerMaxOutputTokens, 128, 'under the least is lifted to it');
  edit(ov, '99999');
  assert.equal(bucket().scannerMaxOutputTokens, 15000);
  edit(ov, '0');
  assert.equal(bucket().scannerMaxOutputTokens, 0, '0 keeps the built-in limits');
});

test('a stored limit shows in the box after a reload, and a blank or non-number is refused without storing', async () => {
  const { st, port } = mount();
  await port.command('settings.set', { key: 'calls.maxOutput', value: 3000 });
  const row = view => view.sections.find(s => s.id === 'models').rows.find(r => r.key === 'calls.maxOutput');
  assert.equal(row(port.view('settings')).value, 3000);
  for (const bad of ['', null, 'x', undefined]) assert.equal((await port.command('settings.set', { key: 'calls.maxOutput', value: bad })).ok, false, String(bad));
  assert.equal(st.ctx.extensionSettings.storySuite.modules['npc-state-delta'].scannerMaxOutputTokens, 3000);
});

test('Repair and Fallback each say when they run, and they say different things', () => {
  const { ov } = mount();
  const hint = key => ov.el.querySelector(`.spage [data-key="${key}"]`).textContent;
  assert.match(hint('calls.repair'), /only when a reply has no change block at all/);
  assert.match(hint('calls.repair'), /Quick connection/);
  assert.match(hint('calls.fallback'), /after each reply/);
  assert.match(hint('calls.fallback'), /Background connection/);
  assert.match(hint('calls.fallback'), /Never coin or items/);
});
