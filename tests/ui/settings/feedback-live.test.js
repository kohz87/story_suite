// A change's answer is read on the real Settings page: a refusal is shown under its row, a number the store held to its range is redrawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { storyDirectorModule } from '../../../modules/director/module.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';

async function open(t, page) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ modules: [storyDirectorModule] });
  t.after(() => host.close());
  const writes = { settings: { set: (id, key, value) => host.settings.set(id, key, value) }, features: { set: (id, on) => host.features.set(id, on) } };
  const port = createSbPort({ sdk: host.sdk, writes, selectors: buildSelectors(() => null, host.sdk) });
  const doc = installFakeDom();
  const ov = createSettingsOverlay({
    doc, settings: port.view('settings'), renderSection: renderSettingsSection,
    onChange: (key, value) => port.command('settings.set', { key, value }), onAction: () => {},
  });
  ov.open();
  ov.show(page);
  const row = key => ov.el.querySelector(`.srow[data-key="${key}"]`);
  const type = async (key, value) => {
    const input = row(key).querySelector('input');
    input.value = value;
    input.dispatchEvent(new globalThis.Event('change'));
    await new Promise(r => setTimeout(r, 0));
    return input;
  };
  return { host, port, row, type };
}

test('World: an invalid Months list shows the refusal under its row, and a good list clears it', async t => {
  const { row, type } = await open(t, 'world');
  await type('world.months', 'nonsense');
  const note = row('world.months').querySelector('.snote');
  assert.equal(note.hidden, false);
  assert.equal(note.textContent, 'That value cannot be saved.');
  await type('world.months', 'First: 20, Second: 30');
  assert.equal(note.hidden, true);
  assert.equal(note.textContent, '');
});

test('World: a number held to the engine range is redrawn in its box', async t => {
  const { host, row, type } = await open(t, 'world');
  const input = await type('world.longestTimeJump', '99999');
  const stored = host.sdk.settings('story-director')['tracker.maxJump'];
  assert.notEqual(stored, 99999);
  assert.equal(input.value, String(stored));
  assert.equal(row('world.longestTimeJump').querySelector('.snote').hidden, true);
});

test('RPG: Level cap 100 shows 99 and XP rate 101 shows 100 at once; an in-range number is left as typed', async t => {
  const { row, type } = await open(t, 'rpg');
  assert.equal((await type('rpg.levelCap', '100')).value, '99');
  assert.equal((await type('rpg.xpRate', '101')).value, '100');
  assert.equal((await type('rpg.xpRate', '150')).value, '150');
  assert.equal(row('rpg.xpRate').querySelector('.snote').hidden, true);
});
