import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './mount.js';

test('Money has its Coins card and Reset but no module block', () => {
  const { page, sec } = mountSettings();
  const el = page('money');
  assert.equal(el.querySelector('.mod'), null);
  assert.equal(el.querySelectorAll('.sgrp .srow').length, sec('money').rows.length);
  assert.equal(el.querySelector('.sgrp .gt').textContent, 'Coins');
});

test('Chat extras leads with its module block, then lists its rows', () => {
  const { page, sec } = mountSettings();
  const el = page('extras');
  assert.equal(el.querySelectorAll('.mod[data-mod="extras"] .msubs .srow').length, 4);
  // Inner chatter's group shows only while its switch is on (Director hide, owner 18 Nov); with it off the page has the module block alone.
  // (then the Tabs panel: four rows of its own)
  assert.equal(el.querySelectorAll('.sgrp .srow').length, sec('extras').rows.length + 4);
  assert.equal(el.querySelectorAll('[data-reply-tabs] .srow.stab').length, 4);
  if (sec('extras').rows.length) assert.ok(el.querySelector('.sgrp .gt'));
});

test('Money on a real host draws its six rows from the live values and names a coin line that does not read', async () => {
  const { installFakeDom } = await import('../../../helpers/ui-fake-dom.js');
  const { createRuntime } = await import('../../../../core/runtime.js');
  const { createFakeContext } = await import('../../../../testkit/fake-st.js');
  const { createSbPort } = await import('../../../../ui/port/sb-port.js');
  const { buildSelectors } = await import('../../../../ui/select/build.js');
  const { renderSettingsSection } = await import('../../../../ui/settings/sections/index.js');
  const { createSettingsOverlay } = await import('../../../../ui/settings/overlay.js');
  const st = createFakeContext({ chat: [] });
  const runtime = createRuntime({ ctx: st.ctx });
  runtime.settings.set('story-block', 'currency', 'mark');
  const port = createSbPort({ sdk: runtime.sdk, writes: runtime.writes, selectors: buildSelectors(() => st.ctx, runtime.sdk) });
  const doc = installFakeDom();
  const calls = [];
  const ov = createSettingsOverlay({ doc, settings: port.view('settings'), renderSection: renderSettingsSection, onChange: (k, v) => { calls.push([k, v]); return port.command('settings.set', { key: k, value: v }); }, onAction() {} });
  ov.open();
  ov.show('money');
  const page = ov.el.querySelector('.spage');
  assert.equal(page.querySelectorAll('.sgrp .srow').length, 6);
  assert.equal(page.querySelector('[data-key="money.moneyWord"] input').value, 'mark');
  const coins = page.querySelector('[data-key="money.coins"] input');
  const note = page.querySelector('[data-key="money.coins"] .snote');
  assert.equal(note.hidden, true);
  coins.value = 'silver: ten';
  coins.dispatchEvent(new globalThis.Event('change'));
  await new Promise(r => setTimeout(r, 0));
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /Coin 1/);
  coins.value = 'copper: 1, silver: 10';
  coins.dispatchEvent(new globalThis.Event('change'));
  await new Promise(r => setTimeout(r, 0));
  assert.equal(note.hidden, true);
  assert.deepEqual(calls.at(-1), ['money.coins', 'copper: 1, silver: 10']);
});
