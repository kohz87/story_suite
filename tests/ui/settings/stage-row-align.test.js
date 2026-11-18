// Settings › People › Per-feeling stages (owner, drop 2): the row's choice, number and text box sit on one line at one height (SillyTavern's
// own select rule adds a bottom margin that lifted the choice and its label), and the choice is labelled "Feeling", the page's one word.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createSettings } from '../../../core/sdk/settings.js';
import { SETTINGS_SCHEMA, SETTINGS_DEFAULTS } from '../../../modules/people/meters/npc-meters-schema.js';
import { selectSettings } from '../../../ui/select/settings.js';
import { peopleCommand } from '../../../ui/port/people-settings.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';

const css = readFileSync(new URL('../../../ui/css/settings.css', import.meta.url), 'utf8');
const ID = 'npc-state-delta';

test('the list editors\' choice and boxes have no margin and one height, whatever the host\'s select rule adds', () => {
  const rule = /\.sedit \.ef select,\.sedit \.ef input\{([^}]*)\}/.exec(css);
  assert.ok(rule, 'one rule covers the select and the inputs of a list editor row');
  assert.match(rule[1], /(^|;)margin:0(;|$)/);
  assert.match(rule[1], /(^|;)height:44px(;|$)/);
  assert.match(rule[1], /(^|;)box-sizing:border-box(;|$)/);
});

test('Per-feeling stages: the choice is labelled Feeling (label, aria-label, the row hint and the not-used note), never Meter', async () => {
  const doc = installFakeDom();
  const tree = { storySuite: { modules: { [ID]: { stages: [{ meter: 'trust', at: 40, name: 'Warm' }, { meter: 'trust', at: 40, name: 'Again' }] } } } };
  const settings = createSettings({ root: () => tree, registry: { module: id => (id === ID ? { settings: { defaults: SETTINGS_DEFAULTS, schema: SETTINGS_SCHEMA } } : null) } });
  const view = () => selectSettings({ features: [{ id: 'npc-state-delta.stages', moduleId: ID, moduleName: 'NPC State', label: 'Stages', on: true }], people: settings(ID) });
  const ov = createSettingsOverlay({
    doc, settings: view(), renderSection: renderSettingsSection, onView: name => (name === 'settings' ? view() : null),
    onChange: async (key, value) => peopleCommand('settings.set', { key, value }, { settings: { set: settings.set } }, () => settings(ID)), onAction: () => ({ ok: true }),
  });
  ov.open('people');
  const page = ov.el.querySelector('.spage');
  const row = page.querySelectorAll('.srow').find(r => r.dataset.key === 'people.perMeterStages');
  assert.match(row.textContent, /Named thresholds on one feeling/);
  row.querySelector('button').click();
  const box = page.querySelector('[data-edit="people.perMeterStages"]');
  const first = box.querySelector('.erow');
  assert.equal(first.querySelector('.ef span').textContent, 'Feeling');
  assert.equal(first.querySelector('select').getAttribute('aria-label'), 'Stage 1: Feeling');
  assert.match(box.querySelector('.eun')?.textContent ?? '', /pick a feeling in use/);
  assert.equal(/\bmeter\b/i.test(box.textContent + row.textContent), false);
});
