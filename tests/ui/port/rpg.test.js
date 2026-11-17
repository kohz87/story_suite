import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../ui/contract/settings.js';
import { selectSettings } from '../../../ui/select/settings.js';
import { selectRpgRows } from '../../../ui/select/rpg-rows.js';
import { rpgCommand } from '../../../ui/port/rpg.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';
import { AUTO_CAP_SETTING, CHECKS_SETTING, JOIN_SETTING, LEVEL_CAP_SETTING, PRACTICE_SETTING, PRECHECK_SETTING } from '../../../modules/rpg/names.js';
import { DIFFICULTY_SETTING, STANDARD_SETTING } from '../../../modules/rpg/rules.js';
import { XP_RATE_SETTING } from '../../../modules/rpg/levels.js';

const valueOf = (rows, key) => rows.find(r => r.key === key).value;
const store = () => { const bucket = {}; return { bucket, writes: { settings: { set: (id, key, value) => { assert.equal(id, 'story-block'); bucket[key] = value; return value; } } } }; };
const set = (writes, key, value, values) => rpgCommand('settings.set', { key, value }, writes, values);

describe('RPG page rows', () => {
  it('show the defaults when nothing is stored', () => {
    const rows = selectRpgRows(undefined);
    assert.deepEqual(['Standard', 99, 100, 3, 'Ask', true, 3, true], ['rpg.difficulty', 'rpg.levelCap', 'rpg.xpRate', 'rpg.practicePerSkillUse', 'rpg.companions', 'rpg.setUpAFightFromMyAttack', 'rpg.autoExchanges', 'rpg.storyChecksUseYourStats'].map(k => valueOf(rows, k)));
  });
  it('read the stored values through the old page’s keys', () => {
    const rows = selectRpgRows({ [DIFFICULTY_SETTING]: 'harsh', [LEVEL_CAP_SETTING]: 20, [XP_RATE_SETTING]: 150, [PRACTICE_SETTING]: 5, [JOIN_SETTING]: 'auto', [PRECHECK_SETTING]: false, [AUTO_CAP_SETTING]: 9, [CHECKS_SETTING]: false });
    assert.deepEqual(['Harsh', 20, 150, 5, 'Automatically', false, 9, false], ['rpg.difficulty', 'rpg.levelCap', 'rpg.xpRate', 'rpg.practicePerSkillUse', 'rpg.companions', 'rpg.setUpAFightFromMyAttack', 'rpg.autoExchanges', 'rpg.storyChecksUseYourStats'].map(k => valueOf(rows, k)));
  });
  it('sit in the settings view-model as the RPG section, within the contract, and the page draws', () => {
    const vm = selectSettings({ host: {}, schema: {}, defaults: {}, features: [], rpg: { [JOIN_SETTING]: 'off' } });
    assert.deepEqual(checkShape(vm, SETTINGS_SHAPE), []);
    const section = vm.sections.find(s => s.id === 'rpg');
    assert.equal(valueOf(section.rows, 'rpg.companions'), 'Off');
    assert.equal(renderSettingsSection(section, { body: () => ['rows'] }).length, 1);
  });
});

describe('RPG page commands write the old page’s keys', () => {
  it('every row stores under its setting, with the old clamps', () => {
    const { bucket, writes } = store();
    set(writes, 'rpg.difficulty', 'Harsh'); set(writes, 'rpg.levelCap', 500); set(writes, 'rpg.xpRate', 137); set(writes, 'rpg.practicePerSkillUse', 0);
    set(writes, 'rpg.companions', 'Automatically'); set(writes, 'rpg.setUpAFightFromMyAttack', false); set(writes, 'rpg.autoExchanges', 9); set(writes, 'rpg.storyChecksUseYourStats', false);
    assert.deepEqual(bucket, { [DIFFICULTY_SETTING]: 'harsh', [LEVEL_CAP_SETTING]: 99, [XP_RATE_SETTING]: 125, [PRACTICE_SETTING]: 1, [JOIN_SETTING]: 'auto', [PRECHECK_SETTING]: false, [AUTO_CAP_SETTING]: 9, [CHECKS_SETTING]: false });
  });
  it('refuse a word or number the row does not take, and leave the store alone', () => {
    const { bucket, writes } = store();
    assert.equal(set(writes, 'rpg.companions', 'Sometimes').ok, false);
    assert.equal(set(writes, 'rpg.levelCap', 'abc').ok, false);
    assert.equal(set(writes, 'rpg.levelCap', '').ok, false);
    assert.deepEqual(bucket, {});
  });
  it('a first switch to Custom starts from the numbers in force, like the old page', () => {
    const { bucket, writes } = store();
    set(writes, 'rpg.difficulty', 'Custom', () => ({ [DIFFICULTY_SETTING]: 'harsh' }));
    assert.equal(bucket[DIFFICULTY_SETTING], 'custom');
    assert.equal(typeof bucket[STANDARD_SETTING], 'object');
    assert.ok(Object.keys(bucket[STANDARD_SETTING]).length > 5);
  });
  it('Reset stores the defaults; other commands are not this page’s', () => {
    const { bucket, writes } = store();
    assert.equal(rpgCommand('settings.action', { key: 'settings.reset', value: 'Reset RPG and fights to defaults' }, writes).ok, true);
    assert.equal(bucket[LEVEL_CAP_SETTING], 99);
    assert.equal(bucket[JOIN_SETTING], 'ask');
    assert.equal(rpgCommand('settings.action', { key: 'settings.reset', value: 'Reset Look to defaults' }, writes), null);
    assert.equal(rpgCommand('settings.set', { key: 'models.quick', value: 'x' }, writes), null);
  });
  it('the port routes the command and hands the bucket to the Custom start', async () => {
    const { bucket, writes } = store();
    const port = createSbPort({ sdk: {}, writes, rpgValues: () => ({ [DIFFICULTY_SETTING]: 'gentle' }) });
    assert.equal((await port.command('settings.set', { key: 'rpg.difficulty', value: 'Custom' })).ok, true);
    assert.equal(bucket[DIFFICULTY_SETTING], 'custom');
    assert.ok(bucket[STANDARD_SETTING]);
  });
});
