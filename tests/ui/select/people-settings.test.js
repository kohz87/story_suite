import test from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../ui/contract/settings.js';
import { selectSettings } from '../../../ui/select/settings.js';
import { peopleRows } from '../../../ui/select/people-settings/index.js';
import { buildSettings } from '../../../ui/fixtures/settings.js';
import { mountSettings } from '../settings/sections/mount.js';

const mock = buildSettings().sections.find(s => s.id === 'people').rows;
const live = peopleRows({});
const byKey = rows => Object.fromEntries(rows.map(r => [r.key, r]));

test('the live People rows keep the mock\'s groups, order, labels, hints, units and tags', () => {
  assert.deepEqual(live.map(r => [r.group, r.key, r.label]), mock.map(r => [r.group, r.key, r.label]));
  const m = byKey(mock);
  const moved = new Set(['people.dossier', 'people.customFields', 'people.savedPortraitPresets']);   // deviations, see the report
  for (const r of live) {
    if (moved.has(r.key)) continue;
    assert.deepEqual([r.hint, r.unit, r.tags, r.wide], [m[r.key].hint, m[r.key].unit, m[r.key].tags, m[r.key].wide], r.key);
  }
});

test('at the stored defaults every written row shows the mock\'s value', () => {
  const m = byKey(mock);
  for (const r of live.filter(x => x.type !== 'info' && !['people.dossier', 'people.customFields'].includes(x.key))) {
    assert.deepEqual(r.value, m[r.key].value, r.key);
    assert.equal(r.type, m[r.key].type, r.key);
  }
});

test('a row reads the stored value of its NPC State setting', () => {
  const bucket = {
    relationshipBaseline: { trust: 5, affection: 0, desire: 0, tension: 0 }, relationshipAllowance: { ordinary: null, meaningful: 2, major: 1, extreme: 1 },
    changeCap: 20, gateStrength: 'strong', admissionMode: 'manual_only', staleArchiveAfter: 45, customFieldNames: ['Level', 'Class'],
    scanEvery: 7, scanDepth: 9, narrationCaptureCompact: true, injectLimit: 5, injectBudgetTokens: 3000, maxNpcs: 25, portraitGenerationEnabled: false,
    relationshipMap: { enabled: false, defaultLens: 'tension' },
  };
  const r = byKey(peopleRows(bucket));
  assert.equal(r['people.startingValues'].value.Trust, 5);
  assert.equal(r['people.daily'].value.Ordinary, null);
  const flat = ['ceiling', 'repeatedApproachesStreng', 'dossier', 'dormant', 'customFields', 'refreshEvery', 'refreshReadsBack', 'shortOnePassInstruction', 'peopleTheNarratorIsToldA', 'peopleBlockBudget', 'mostPeopleKeptActive', 'portraits', 'relationshipMap', 'defaultDistance'];
  assert.deepEqual(flat.map(k => r[`people.${k}`].value), [20, 'Strong', 'Manual only', 45, 'Level, Class', 7, 9, true, 5, 3000, 25, false, false, 'Tension']);
});

test('selectSettings adds the People section, it matches the contract and its module card opens on it', () => {
  const vm = selectSettings({ features: [{ id: 'people.stages', moduleId: 'npc-state-delta', moduleName: 'People', label: 'Stages', on: true }], people: { scanEvery: 9 } });
  assert.deepEqual(checkShape(vm, SETTINGS_SHAPE), []);
  assert.equal(vm.sections.find(s => s.id === 'people').rows.find(r => r.key === 'people.refreshEvery').value, 9);
  assert.equal(vm.modules.defs[0].section, 'people');
  assert.equal(selectSettings({ features: [] }).sections.find(s => s.id === 'people').rows.find(r => r.key === 'people.refreshEvery').value, 5);
});

test('the People page draws every row without errors', () => {
  const { page, settings, calls } = mountSettings({ sections: selectSettings({ features: [], people: {} }).sections });
  const el = page('people');
  assert.equal(el.querySelectorAll('.sgrp .srow').length, settings.sections.find(s => s.id === 'people').rows.length);
  assert.equal(calls.length, 0);
});
