// People › Portraits on a live host (the owner's report, 18 Nov: Prompt, Leave out and Composition showed no box): every row is a control showing what
// portraits use now, a change is stored the way the old portrait panel saved it, survives a fresh Settings (reload) and redraws the rows it moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { BUILTIN_MODULES } from '../../../core/modules-list.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../ui/contract/settings.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { PORTRAIT_THEME_PRESETS } from '../../../modules/people/settings/runtime-settings-parts/portrait-preset-constants.js';

const NPC = 'npc-state-delta';
const settled = () => new Promise(resolve => setTimeout(resolve, 0));

async function live(t) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ core: true, modules: BUILTIN_MODULES });
  t.after(() => host.close());
  const port = createSbPort({ sdk: host.sdk, writes: { settings: host.settings, features: host.features }, selectors: buildSelectors(() => null, host.sdk) });
  installFakeDom();
  // `open()` draws Settings as the ⚙ does: a fresh view-model each time (a reload reads the stored values again)
  const open = () => {
    const doc = globalThis.document;
    const overlay = createSettingsOverlay({
      doc, host: doc.body, settings: port.view('settings'), renderSection: renderSettingsSection,
      onChange: (key, value) => port.command('settings.set', { key, value }), onAction: (key, value) => port.command('settings.action', { key, value }), onView: (name, args) => port.view(name, args),
    });
    overlay.open('people');
    const ctl = key => overlay.el.querySelector(`.srow[data-key="people.${key}"] .ctl`);
    const field = key => ctl(key).querySelector('textarea, input, select, .sw');
    const change = async (key, value) => { const el = field(key); el.value = value; el.dispatch('change'); await settled(); };
    const press = async (key, label) => { ctl(key).querySelectorAll('button').find(b => b.textContent === label).click(); await settled(); };
    // the fake page's <select> keeps no value of its own: the drawn choice is the option marked selected
    const chosen = key => ctl(key).querySelectorAll('option').find(o => o.selected === true || o.hasAttribute('selected'))?.textContent ?? null;
    return { overlay, ctl, field, change, press, chosen };
  };
  return { host, port, open, stored: () => host.sdk.settings(NPC) };
}

test('every Portraits row is a control: Prompt and Leave out several lines, Composition a line, Style preset and Prompt format lists', async t => {
  const { port, open } = await live(t);
  assert.deepEqual(checkShape(port.view('settings'), SETTINGS_SHAPE), []);
  const { field, ctl } = open();
  assert.equal(field('prompt').tagName.toLowerCase(), 'textarea');
  assert.equal(field('leaveOut').tagName.toLowerCase(), 'textarea');
  assert.equal(field('composition').tagName.toLowerCase(), 'input');
  assert.equal(field('stylePreset').tagName.toLowerCase(), 'select');
  assert.equal(field('promptFormat').tagName.toLowerCase(), 'select');
  // nothing stored yet: the built-in Fantasy Anime style's own text, as portraits use it
  assert.equal(field('prompt').value, PORTRAIT_THEME_PRESETS.fantasy_anime.positive);
  assert.equal(field('leaveOut').value, PORTRAIT_THEME_PRESETS.fantasy_anime.negative);
  assert.ok(field('composition').value.startsWith('solo character portrait'));
  assert.deepEqual(ctl('stylePreset').querySelectorAll('option').map(o => o.textContent), ['Fantasy Anime', 'Anime Key Visual', 'Painterly Fantasy', 'Dark Medieval', 'Semi-Realistic', 'Custom · Custom 1']);
  assert.deepEqual(ctl('promptFormat').querySelectorAll('option').map(o => o.textContent), ['Structured hybrid', 'Comma tags', 'Natural language']);
  for (const key of ['useTheCurrentMood', 'useTheCurrentPlace', 'alsoSaveToSillytavernSGa']) assert.ok(ctl(key).querySelector('.sw'), key);
});

test('editing Prompt moves the style to the chosen custom preset, is stored there and in the flat keys, and reads back after a reload', async t => {
  const { open, stored } = await live(t);
  const first = open();
  await first.change('prompt', 'ink wash portrait, muted palette');
  let s = stored();
  assert.equal(s.portraitThemePreset, 'custom');
  assert.equal(s.portraitStylePositive, 'ink wash portrait, muted palette');
  assert.equal(s.portraitCustomPresets.find(p => p.id === s.portraitCustomPresetId).positive, 'ink wash portrait, muted palette');
  // the page redrew the row that moved with it
  assert.equal(first.chosen('stylePreset'), 'Custom · Custom 1');
  await first.change('leaveOut', 'text, watermark');
  await first.change('composition', 'full body, wide shot');
  await first.change('promptFormat', 'Natural language');
  s = stored();
  const preset = s.portraitCustomPresets.find(p => p.id === s.portraitCustomPresetId);
  assert.deepEqual([preset.negative, preset.composition, preset.promptFormat], ['text, watermark', 'full body, wide shot', 'natural']);
  assert.deepEqual([s.portraitStyleNegative, s.portraitComposition, s.portraitPromptFormat], ['text, watermark', 'full body, wide shot', 'natural']);
  first.overlay.destroy();
  const again = open();
  assert.equal(again.field('prompt').value, 'ink wash portrait, muted palette');
  assert.equal(again.field('leaveOut').value, 'text, watermark');
  assert.equal(again.field('composition').value, 'full body, wide shot');
  assert.equal(again.chosen('promptFormat'), 'Natural language');
  assert.equal(again.chosen('stylePreset'), 'Custom · Custom 1');
});

test('Style preset: a built-in style brings its own text and keeps the custom preset; the custom one brings its text back', async t => {
  const { open, stored } = await live(t);
  const page = open();
  await page.change('prompt', 'my own style');
  await page.change('stylePreset', 'Painterly Fantasy');
  assert.equal(stored().portraitThemePreset, 'painterly_fantasy');
  assert.equal(stored().portraitStylePositive, PORTRAIT_THEME_PRESETS.painterly_fantasy.positive);
  assert.equal(page.field('prompt').value, PORTRAIT_THEME_PRESETS.painterly_fantasy.positive);
  await page.change('composition', 'head and shoulders'); // a built-in style keeps its own composition
  assert.equal(stored().portraitThemePreset, 'painterly_fantasy');
  assert.equal(stored().portraitComposition, 'head and shoulders');
  await page.change('stylePreset', 'Custom · Custom 1');
  assert.equal(stored().portraitThemePreset, 'custom');
  assert.equal(page.field('prompt').value, 'my own style');
});

test('the presets row saves the current style as a new preset and deletes the chosen one; the switches store', async t => {
  const { open, stored } = await live(t);
  const page = open();
  assert.match(page.overlay.el.querySelector('.srow[data-key="people.savedPortraitPresets"] small').textContent, /^1 of 24 saved/);
  await page.press('savedPortraitPresets', 'Delete this preset');
  assert.equal(stored().portraitCustomPresets, undefined, 'the last preset is never deleted, and a built-in style deletes nothing');
  await page.press('savedPortraitPresets', 'Save as a new preset');
  assert.equal(stored().portraitCustomPresets.length, 2);
  assert.equal(page.chosen('stylePreset'), 'Custom · Custom 2');
  assert.equal(page.field('prompt').value, PORTRAIT_THEME_PRESETS.fantasy_anime.positive);
  assert.match(page.overlay.el.querySelector('.srow[data-key="people.savedPortraitPresets"] small').textContent, /^2 of 24 saved/);
  await page.press('savedPortraitPresets', 'Delete this preset');
  assert.deepEqual(stored().portraitCustomPresets.map(p => p.name), ['Custom 1']);
  assert.equal(page.chosen('stylePreset'), 'Custom · Custom 1');
  page.field('useTheCurrentPlace').click();
  await settled();
  assert.equal(stored().portraitCustomPresets[0].useLocation, true);
  page.field('alsoSaveToSillytavernSGa').click();
  await settled();
  assert.equal(stored().portraitSaveToGallery, true);
});
