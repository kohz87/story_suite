import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE, SETTINGS_ROW_TYPES } from '../../../ui/contract/settings.js';
import { buildSettings } from '../../../ui/fixtures/settings.js';

describe('SETTINGS_SHAPE', () => {
  it('accepts the default and RPG-off fixtures', () => {
    assert.deepEqual(checkShape(buildSettings(), SETTINGS_SHAPE), []);
    assert.deepEqual(checkShape(buildSettings({ rpg: false }), SETTINGS_SHAPE), []);
  });

  it('lists the nine row types the overlay can render', () => {
    assert.deepEqual([...SETTINGS_ROW_TYPES].sort(), ['btn', 'chips', 'info', 'multi', 'num', 'seg', 'sel', 'sw', 'txt']);
  });

  it('rejects an unknown row type, section group and connection id', () => {
    const vm = buildSettings();
    vm.sections[1].rows[0].type = 'slider';
    vm.sections[0].group = 'Misc';
    vm.connections[0].id = 'fourth';
    const errors = checkShape(vm, SETTINGS_SHAPE);
    assert.equal(errors.length, 3);
  });

  it('accepts array, object and null values, and rejects a nested object value', () => {
    const vm = buildSettings();
    const chips = vm.sections.flatMap(s => s.rows).find(r => r.type === 'chips');
    const multi = vm.sections.flatMap(s => s.rows).find(r => r.type === 'multi');
    assert.ok(Array.isArray(chips.value));
    assert.equal(typeof multi.value, 'object');
    assert.deepEqual(checkShape(vm, SETTINGS_SHAPE), []);
    multi.value = { Ordinary: { deep: 1 } };
    assert.ok(checkShape(vm, SETTINGS_SHAPE).length >= 1);
  });

  it('requires a module set for this chat and for new chats', () => {
    const vm = buildSettings();
    delete vm.modules.newChats;
    vm.modules.chat.rpg.on = 'yes';
    assert.equal(checkShape(vm, SETTINGS_SHAPE).length, 2);
  });
});
