import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSettings } from '../../../ui/fixtures/settings.js';

const rowsOf = vm => vm.sections.flatMap(s => s.rows);

describe('buildSettings', () => {
  it('lists the 12 sections in the four groups, special pages marked', () => {
    const vm = buildSettings();
    assert.deepEqual(vm.sections.map(s => s.id), ['start', 'look', 'people', 'rpg', 'world', 'director', 'money', 'extras', 'models', 'packs', 'addons', 'tools']);
    assert.deepEqual([...new Set(vm.sections.map(s => s.group))], ['Play', 'Rules', 'Setup', 'Tools']);
    assert.deepEqual(vm.sections.filter(s => s.special).map(s => [s.id, s.special]), [['start', 'start'], ['models', 'models'], ['packs', 'packs'], ['tools', 'tools']]);
  });

  it('row keys are unique and every row carries its value and its default', () => {
    const rows = rowsOf(buildSettings());
    assert.equal(new Set(rows.map(r => r.key)).size, rows.length);
    for (const r of rows) assert.deepEqual(r.value, r.default, r.key);
  });

  it('keeps the pacing numbers: tier caps 1/2/3/6, daily 3/1/1/1, ceiling 15', () => {
    const rows = rowsOf(buildSettings());
    const byKey = Object.fromEntries(rows.map(r => [r.key, r]));
    assert.deepEqual(byKey['people.tierCaps'].value, { Ordinary: 1, Meaningful: 2, Major: 3, Extreme: 6 });
    assert.deepEqual(byKey['people.daily'].value, { Ordinary: 3, Meaningful: 1, Major: 1, Extreme: 1 });
    assert.equal(byKey['people.ceiling'].value, 15);
    assert.equal(byKey['world.daysWhole'].value, 14);
    assert.equal(byKey['world.daysAll'].value, 120);
  });

  it('chat-scoped spoiler rows carry the chat tag; the skin has no Solid option', () => {
    const rows = rowsOf(buildSettings());
    const byKey = Object.fromEntries(rows.map(r => [r.key, r]));
    assert.ok(byKey['director.sceneSpoilers'].tags.includes('chat'));
    assert.ok(byKey['director.planSpoilers'].tags.includes('chat'));
    assert.deepEqual(byKey['look.skin'].options, ['Glass dark', 'Glass light', 'Follow SillyTavern']);
  });

  it('modules: five modules in each set, RPG on by default, new chats start on', () => {
    const { modules } = buildSettings();
    assert.deepEqual(Object.keys(modules.chat), ['rpg', 'people', 'world', 'director', 'extras']);
    assert.deepEqual(Object.keys(modules.newChats), Object.keys(modules.chat));
    assert.equal(modules.chat.rpg.on, true);
    assert.equal(modules.scope, 'chat');
    assert.equal(modules.preset, 'full');
    assert.equal(modules.chat.people.subs.feelingsDriftEachStoryDay, false);
  });

  it('rpgOff: the RPG module is off for this chat only; sections stay', () => {
    const vm = buildSettings({ rpg: false });
    assert.equal(vm.modules.chat.rpg.on, false);
    assert.equal(vm.modules.newChats.rpg.on, true);
    assert.equal(vm.sections.length, 12);
  });

  it('three connections: Story read-only, Quick helpers and Background pick one', () => {
    const { connections } = buildSettings();
    assert.deepEqual(connections.map(c => [c.id, c.readOnly]), [['story', true], ['quick', false], ['background', false]]);
    assert.equal(connections[1].usedFor.length, 3);
    assert.equal(connections[2].usedFor.length, 4);
  });

  it('names no model or vendor, and calls return fresh copies', () => {
    const text = JSON.stringify(buildSettings());
    assert.doesNotMatch(text, /claude|gemini|gpt|deepseek|antigravity|opus|sonnet/i);
    const a = buildSettings();
    a.connections[1].usedFor.push('x');
    a.modules.chat.rpg.subs.fightBoard = false;
    const b = buildSettings();
    assert.equal(b.connections[1].usedFor.length, 3);
    assert.equal(b.modules.chat.rpg.subs.fightBoard, true);
  });
});
