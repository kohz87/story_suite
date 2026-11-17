import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleCommand } from '../../../ui/port/people-settings.js';
import { createSbPort } from '../../../ui/port/sb-port.js';

// The old panel's boxes (modules/people/settings/runtime-settings-bind.js), transcribed: whole number cut to min..max, a blank or bad box is the fallback.
const oldBox = (min, max, fallback) => v => Math.max(min, Math.min(max, Math.round(Number(v) || fallback)));

function host(bucket = {}) {
  const stored = { ...bucket };
  return { stored, writes: { settings: { set: (id, key, value) => { assert.equal(id, 'npc-state-delta'); stored[key] = value; return value; } } }, read: () => stored };
}
const set = (h, key, value) => peopleCommand('settings.set', { key: `people.${key}`, value }, h.writes, h.read);

test('number rows store the old box\'s value under the same key', () => {
  const rows = { refreshEvery: ['scanEvery', 1, 20, 2], refreshReadsBack: ['scanDepth', 2, 30, 6], peopleTheNarratorIsToldA: ['injectLimit', 1, 12, 3], peopleBlockBudget: ['injectBudgetTokens', 512, 6000, 4000], mostPeopleKeptActive: ['maxNpcs', 1, 100, 40], dormant: ['staleArchiveAfter', 10, 999, 30] };
  for (const [row, [key, min, max, fallback]] of Object.entries(rows)) {
    for (const input of [7, 0, 5000, -3, null, 'x', 12.6]) {
      const h = host({ staleDeleteAfter: 1000 });
      assert.equal(set(h, row, input).ok, true);
      assert.equal(h.stored[key], oldBox(min, max, fallback)(input), `${row} ${input}`);
    }
  }
});

test('Dormant after pushes Auto-delete after up when it reaches it, as the old box did', () => {
  const h = host({ staleDeleteAfter: 50 });
  set(h, 'dormant', 80);
  assert.deepEqual([h.stored.staleArchiveAfter, h.stored.staleDeleteAfter], [80, 81]);
  const g = host({ staleDeleteAfter: 200 });
  set(g, 'dormant', 80);
  assert.equal(g.stored.staleDeleteAfter, 200);
});

test('switches and choices store their values; the dossier choice stores the engine\'s word', () => {
  const h = host();
  set(h, 'shortOnePassInstruction', true); set(h, 'portraits', false);
  set(h, 'dossier', 'Manual only'); set(h, 'repeatedApproachesStreng', 'Strong');
  assert.deepEqual(h.stored, { narrationCaptureCompact: true, portraitGenerationEnabled: false, admissionMode: 'manual_only', gateStrength: 'strong' });
  assert.equal(set(h, 'dossier', 'Generous').ok, false);
});

test('schema rows go to the host setting as given (the sdk cuts them), starting values and caps keep their normalizers', () => {
  const h = host();
  set(h, 'ceiling', 20); set(h, 'stagesHoldWhileTensionIs', 60);
  assert.deepEqual(h.stored, { changeCap: 20, conflictAt: 60 });
  set(h, 'startingValues', { Trust: 500, Affection: -500, Desire: '', Tension: 3 });
  assert.deepEqual(h.stored.relationshipBaseline, { trust: 100, affection: -100, desire: 0, tension: 3 });
  set(h, 'tierCaps', { Ordinary: -2, Meaningful: 2, Major: 3, Extreme: 6 });
  assert.equal(h.stored.relationshipCaps.ordinary, 0);
});

test('Moments per story day: a blank is no limit, a number is kept', () => {
  const h = host();
  set(h, 'daily', { Ordinary: null, Meaningful: 2, Major: 1, Extreme: 1 });
  assert.equal(h.stored.relationshipAllowance.ordinary, null);
  assert.equal(h.stored.relationshipAllowance.meaningful, 2);
});

test('Custom fields store the cleaned names (Level is the host\'s, kept once)', () => {
  const h = host();
  set(h, 'customFields', 'Class, Faction, class');
  assert.deepEqual(h.stored.customFieldNames, ['Class', 'Faction']);
  set(h, 'customFields', '');
  assert.deepEqual(h.stored.customFieldNames, []);
});

test('the two map rows each keep the other half of the object', () => {
  const h = host({ relationshipMap: { enabled: true, defaultLens: 'trust' } });
  set(h, 'relationshipMap', false);
  assert.deepEqual(h.stored.relationshipMap, { enabled: false, defaultLens: 'trust' });
  set(h, 'defaultDistance', 'Tension');
  assert.deepEqual(h.stored.relationshipMap, { enabled: false, defaultLens: 'tension' });
});

test('a row that is only shown, or a bad key, is refused and stores nothing; other commands are not ours', () => {
  const h = host();
  for (const key of ['customMeters', 'prompt', 'nope']) assert.equal(set(h, key, 'x').ok, false);
  assert.deepEqual(h.stored, {});
  assert.equal(peopleCommand('settings.set', { key: 'models.quick', value: 1 }, h.writes, h.read), null);
  assert.equal(peopleCommand('settings.action', { key: 'settings.reset', value: 'Reset Look to defaults' }, h.writes, h.read), null);
});

test('a host that will not store answers not saved', () => {
  assert.equal(peopleCommand('settings.set', { key: 'people.ceiling', value: 1 }, { settings: { set: () => undefined } }, () => ({})).ok, false);
});

test('Reset People stores the default of every written row', () => {
  const h = host({ scanEvery: 9, relationshipMap: { enabled: false, defaultLens: 'tension' }, customFieldNames: ['A'] });
  assert.equal(peopleCommand('settings.action', { key: 'settings.reset', value: 'Reset People to defaults' }, h.writes, h.read).ok, true);
  assert.equal(h.stored.scanEvery, 5);
  assert.deepEqual(h.stored.relationshipMap, { enabled: true, defaultLens: 'warmth' });
  assert.deepEqual(h.stored.customFieldNames, []);
  assert.deepEqual(h.stored.relationshipCaps, { ordinary: 1, meaningful: 2, major: 3, extreme: 6 });
});

test('the port sends the page\'s change to the host store, and does not pass it on to the sdk', async () => {
  const h = host();
  const port = createSbPort({ sdk: { settings: () => h.stored, command: async () => { throw new Error('reached the sdk'); } }, writes: h.writes });
  assert.equal((await port.command('settings.set', { key: 'people.refreshEvery', value: 8 })).ok, true);
  assert.equal(h.stored.scanEvery, 8);
});

test('over the real settings store the values land in the NPC State bucket and the host schema cuts the meter rows', async () => {
  const { createSettings } = await import('../../../core/sdk/settings.js');
  const { SETTINGS_SCHEMA, SETTINGS_DEFAULTS } = await import('../../../modules/people/meters/npc-meters-schema.js');
  const tree = {};
  const settings = createSettings({ root: () => tree, registry: { module: id => (id === 'npc-state-delta' ? { settings: { defaults: SETTINGS_DEFAULTS, schema: SETTINGS_SCHEMA } } : null) } });
  const writes = { settings: { set: settings.set } };
  const read = () => settings('npc-state-delta');
  peopleCommand('settings.set', { key: 'people.ceiling', value: 9999 }, writes, read);
  peopleCommand('settings.set', { key: 'people.refreshEvery', value: 99 }, writes, read);
  assert.deepEqual(tree.storySuite.modules['npc-state-delta'], { changeCap: 200, scanEvery: 20 });
  assert.equal(read().changeCap, 200);
});
