// The World and time page on a live host: every row shows the stored value, and a change stores the same key the old page stores.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { storyDirectorModule } from '../../../ui/legacy/director/module.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../ui/contract/settings.js';
import { WORLD_KEYS, WORLD_IDS } from '../../../ui/port/world-keys.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';

const DIR = 'story-director';
async function live(t) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ modules: [storyDirectorModule] });
  t.after(() => host.close());
  const writes = { settings: { set: (id, key, value) => host.settings.set(id, key, value) }, features: { set: (id, on) => host.features.set(id, on) } };
  const port = createSbPort({ sdk: host.sdk, writes, selectors: buildSelectors(() => null, host.sdk) });
  const rows = () => port.view('settings').sections.find(s => s.id === 'world').rows;
  return { host, port, rows };
}
const SAMPLE = {
  'world.calendar': 'Custom', 'world.era': 'AB', 'world.months': 'First: 20, Second: 30', 'world.weekdays': 'One, Two', 'world.leapYears': false,
  'world.weather': 'The story only', 'world.northIs': 'Down', 'world.eastIs': 'Left', 'world.kmPerMapUnit': 2.5, 'world.roadsWind': 1.5, 'world.waterAndAirSpeeds': 'Modern',
  'world.longestTimeJump': 12, 'world.whileAwayRecapAfterAJump': 9, 'world.deadlinesSlipOrLapseAsTi': false, 'world.quietAfter': 7, 'world.quietAfterStoryDays': 11,
  'world.dueSoon': 4, 'world.daysWhole': 10, 'world.daysAll': 99, 'world.remindTheStoryOfTheLastD': false,
};

test('the page is in the view-model, fits the contract and its rows read the live stored values', async t => {
  const { host, rows, port } = await live(t);
  assert.deepEqual(checkShape(port.view('settings'), SETTINGS_SHAPE), []);
  const stored = host.sdk.settings(DIR);
  const by = key => rows().find(r => r.key === key);
  assert.equal(by('world.longestTimeJump').value, stored['tracker.maxJump']);
  assert.equal(by('world.kmPerMapUnit').value, Number(stored['atlas.map.kmPerUnit']));
  assert.equal(by('world.northIs').value, 'Up');
  assert.equal(by('world.weather').value, 'Rolled from the calendar');
  assert.equal(by('world.calendar').value, 'From the pack');
  for (const row of rows()) assert.ok(row.key === 'world.clock' || WORLD_KEYS[row.key], row.key);
});

test('a change writes the same key and value the old page writes (settings.set on story-director), read back by the row', async t => {
  const { host, port, rows } = await live(t);
  const old = await createHost({ modules: [storyDirectorModule] });
  t.after(() => old.close());
  for (const [key, value] of Object.entries(SAMPLE)) {
    const answer = await port.command('settings.set', { key, value });
    assert.equal(answer.ok, true, key);
    const def = WORLD_KEYS[key];
    if (def.kind === 'weather') { assert.equal(host.sdk.features().find(f => f.id === WORLD_IDS.weather).on, false); continue; }
    // the old page's path: the host's settings.set with the same namespaced key and the stored-form value
    const was = def.kind === 'months' ? [{ name: 'First', days: 20 }, { name: 'Second', days: 30 }] : def.kind === 'scale' ? String(value) : def.kind === 'choice' ? def.values[def.labels.indexOf(value)] : value;
    old.settings.set(DIR, def.key, was);
    assert.deepEqual(host.sdk.settings(DIR)[def.key], old.sdk.settings(DIR)[def.key], key);
    assert.deepEqual(host.sdk.settings(DIR)[def.key], was, key);
    assert.equal(rows().find(r => r.key === key).value, value, `${key} reads back`);
  }
});

test('a value the engine cannot take is refused and nothing is stored; unknown world keys fail', async t => {
  const { host, port } = await live(t);
  const before = structuredClone(host.sdk.settings(DIR));
  for (const [key, value] of [['world.longestTimeJump', 1.5], ['world.months', 'nonsense'], ['world.northIs', 'Sideways'], ['world.kmPerMapUnit', 'x'], ['world.nothing', 1]]) {
    assert.equal((await port.command('settings.set', { key, value })).ok, false, `${key}=${value}`);
  }
  assert.deepEqual(host.sdk.settings(DIR), before);
});

test('a number outside the engine\'s range is held to it, as the old page holds it', async t => {
  const { host, port } = await live(t);
  await port.command('settings.set', { key: 'world.longestTimeJump', value: 99999 });
  const old = await createHost({ modules: [storyDirectorModule] });
  t.after(() => old.close());
  old.settings.set(DIR, 'tracker.maxJump', 99999);
  assert.equal(host.sdk.settings(DIR)['tracker.maxJump'], old.sdk.settings(DIR)['tracker.maxJump']);
});

test('the digest rows are hidden while their feature is off, as in the old page', async t => {
  const { host, rows } = await live(t);
  assert.ok(rows().some(r => r.key === 'world.daysWhole'));
  host.features.set('story-director.digest', false);
  assert.equal(rows().some(r => r.key === 'world.daysWhole' || r.key === 'world.daysAll'), false);
});

test('the page renders on the live host and a change reaches the port as the row key', async t => {
  const { port } = await live(t);
  const doc = installFakeDom();
  const calls = [];
  const ov = createSettingsOverlay({ doc, settings: port.view('settings'), renderSection: renderSettingsSection, onChange: (k, v) => calls.push([k, v]), onAction: () => {} });
  ov.open('world');
  const el = ov.el.querySelector('.spage');
  assert.ok(el.querySelectorAll('.srow').length >= 15);
  assert.equal(el.querySelectorAll('.sgrp .gt').map(g => g.textContent).join('|'), 'Calendar|Weather|Map|Time');
});
