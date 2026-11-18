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

// `first({ host, port })`: run before the page opens (a row that shows only under another setting, or a page that shows only while its module is on).
async function open(t, page, first = () => {}) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ modules: [storyDirectorModule] });
  t.after(() => host.close());
  const writes = { settings: { set: (id, key, value) => host.settings.set(id, key, value) }, features: { set: (id, on) => host.features.set(id, on) } };
  const port = createSbPort({ sdk: host.sdk, writes, selectors: buildSelectors(() => null, host.sdk) });
  await first({ host, port });
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
  const { row, type } = await open(t, 'world', ({ port }) => port.command('settings.set', { key: 'world.calendar', value: 'Custom' }));
  await type('world.months', 'nonsense');
  const note = row('world.months').querySelector('.snote');
  assert.equal(note.hidden, false);
  assert.equal(note.textContent, '“nonsense” does not read as a month. Write each month as “Name: days”, split by commas, with whole days of 1 or more (for example “Frostmoon: 30, Thaw: 28”).');
  await type('world.months', 'First: 20, Second: zero');
  assert.match(note.textContent, /^“Second: zero” does not read as a month\./);
  await type('world.months', 'First: 20, Second: 30');
  assert.equal(note.hidden, true);
  assert.equal(note.textContent, '');
});

test('World: a number held to the engine range is redrawn in its box and says it was held', async t => {
  const { host, row, type } = await open(t, 'world');
  const input = await type('world.longestTimeJump', '99999');
  const stored = host.sdk.settings('story-director')['tracker.maxJump'];
  assert.notEqual(stored, 99999);
  assert.equal(input.value, String(stored));
  const note = row('world.longestTimeJump').querySelector('.snote');
  assert.equal(note.hidden, false);
  assert.equal(note.textContent, `Longest time jump was held to the range it allows; kept ${stored}.`);
  await type('world.longestTimeJump', String(stored - 1));
  assert.equal(note.hidden, true, 'a number kept as typed clears the note');
});

test('RPG: Level cap 100 shows 99 and XP rate 101 shows 100 at once, each saying its range; an in-range number is left as typed', async t => {
  const { row, type } = await open(t, 'rpg', ({ host }) => host.features.set('story-block.rpg', true));
  const note = key => row(key).querySelector('.snote');
  assert.equal((await type('rpg.levelCap', '100')).value, '99');
  assert.equal(note('rpg.levelCap').hidden, false);
  assert.equal(note('rpg.levelCap').textContent, 'Level cap is 1-99; kept 99.');
  assert.equal((await type('rpg.levelCap', '0')).value, '1');
  assert.equal(note('rpg.levelCap').textContent, 'Level cap is 1-99; kept 1.');
  assert.equal((await type('rpg.xpRate', '101')).value, '100');
  assert.equal(note('rpg.xpRate').textContent, 'XP rate is 50-300 in steps of 25; kept 100.');
  assert.equal((await type('rpg.xpRate', '150')).value, '150');
  assert.equal(note('rpg.xpRate').hidden, true);
});

test('RPG: an empty Level cap is refused with the reason under the row, not a bare "cannot be saved"', async t => {
  const { row, type } = await open(t, 'rpg', ({ host }) => host.features.set('story-block.rpg', true));
  await type('rpg.levelCap', '');
  const note = row('rpg.levelCap').querySelector('.snote');
  assert.equal(note.hidden, false);
  assert.equal(note.textContent, 'It takes a whole number, 1-99.');
});

test('the ports say why: a word a choice does not have, and a Look number held to its schema range', async t => {
  const { port } = await open(t, 'rpg', ({ host }) => host.features.set('story-block.rpg', true));
  const odd = await port.command('settings.set', { key: 'rpg.difficulty', value: 'Brutal' });
  assert.equal(odd.ok, false);
  assert.equal(odd.message, 'Choose one of: Gentle, Standard, Harsh, Custom.');
  const tempo = await port.command('settings.set', { key: 'world.tempo', value: 9 });
  assert.deepEqual([tempo.ok, tempo.message], [false, 'Tempo is a number from 0.25 to 4.']);
  const when = await port.command('settings.set', { key: 'director.when', value: 'Sometimes' });
  assert.deepEqual([when.ok, when.message], [false, 'Choose one of: When I ask, Automatically.']);
  const lines = await port.command('settings.set', { key: 'host.maxChangeLines', value: 5 });
  assert.deepEqual(lines, { ok: true, value: 10, range: { min: 10, max: 1000 } });
});
