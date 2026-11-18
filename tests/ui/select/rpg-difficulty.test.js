import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOM_FIELDS, difficultyDetail, difficultyLines, selectCustomRows } from '../../../ui/select/rpg-difficulty.js';
import { selectRpgRows } from '../../../ui/select/rpg-rows.js';
import { rpgCommand } from '../../../ui/port/rpg.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { DIFFICULTY_SETTING, STANDARD_PRESETS, STANDARD_RULE_KEYS, STANDARD_SETTING, rulesFromSettings } from '../../../modules/rpg/rules.js';
import { newDraft, statBounds } from '../../../modules/rpg/view/wizard-data.js';
import { foeStats } from '../../../modules/rpg/combat/foes.js';

const store = (start = {}) => {
  const bucket = { ...start };
  return { bucket, values: () => bucket, writes: { settings: { set: (id, key, value) => { assert.equal(id, 'story-block'); bucket[key] = value; return value; } } } };
};
const custom = (numbers = {}) => ({ [DIFFICULTY_SETTING]: 'custom', [STANDARD_SETTING]: { ...STANDARD_PRESETS.standard, ...numbers } });

describe('what each difficulty changes', () => {
  it('one line per choice from the presets, and the shared line from Combat Rules v1 and the checks table', () => {
    const { lines, same } = difficultyLines();
    assert.deepEqual(lines.map(l => l.word), ['gentle', 'standard', 'harsh', 'custom']);
    assert.deepEqual(lines.map(l => l.text), ['Foe’s base 2', 'Foe’s base 4 (the default)', 'Foe’s base 6', 'Your own creation numbers, below']);
    assert.match(same, /d20 \+ 6 \+ level\/3 \+ tier \(Mob −2 to Apex \+4\)/);
    assert.match(same, /easy 10, normal 15, hard 20, very hard 25/);
  });
  it('the presets differ only in the foe’s base, and a foe’s fight-board numbers take no difficulty (what the shared line claims)', () => {
    const differ = STANDARD_RULE_KEYS.filter(k => new Set(['gentle', 'standard', 'harsh'].map(d => STANDARD_PRESETS[d][k])).size > 1);
    assert.deepEqual(differ, ['foeBase']);
    assert.deepEqual(foeStats({ level: 9, tier: 'elite' }), foeStats({ level: 9, tier: 'elite', foeBase: 15 }));
  });
  it('the Difficulty row’s hint is the chosen one’s details', () => {
    const hint = values => selectRpgRows(values).find(r => r.key === 'rpg.difficulty').hint;
    assert.equal(hint({}), 'Foe’s base 4; new characters: stats start at 5, 10 points to spend, each stat 5 to 10');
    assert.equal(hint({ [DIFFICULTY_SETTING]: 'harsh' }), 'Foe’s base 6; new characters: stats start at 5, 10 points to spend, each stat 5 to 10');
    assert.equal(difficultyDetail(custom({ startStat: 3, createPoints: 20, createMin: 2, createMax: 14 })), 'Your numbers: stats start at 3, 20 points to spend, each stat 2 to 14');
  });
});

describe('Custom difficulty editors', () => {
  it('show only at Custom, right after Difficulty, with the stored numbers and the engine ranges', () => {
    assert.deepEqual(selectCustomRows({ [DIFFICULTY_SETTING]: 'gentle' }), []);
    const rows = selectRpgRows(custom({ createPoints: 18 }));
    assert.deepEqual(rows.slice(0, 5).map(r => r.key), ['rpg.difficulty', ...CUSTOM_FIELDS.map(f => `rpg.custom.${f.field}`)]);
    const points = rows.find(r => r.key === 'rpg.custom.createPoints');
    assert.deepEqual([points.type, points.value, points.default, points.hint], ['num', 18, 10, '0 to 30']);
  });
  it('store into the Custom set (rpgStandard), held to the range, keeping the other numbers', () => {
    const { bucket, values, writes } = store(custom({ foeBase: 9 }));
    assert.deepEqual(rpgCommand('settings.set', { key: 'rpg.custom.createPoints', value: 99 }, writes, values), { ok: true, value: 30, range: { min: 0, max: 30 } });
    assert.equal(bucket[STANDARD_SETTING].createPoints, 30);
    assert.equal(bucket[STANDARD_SETTING].foeBase, 9);
    assert.equal(rpgCommand('settings.set', { key: 'rpg.custom.startStat', value: 7.4 }, writes, values).value, 7);
  });
  it('refuse a number that breaks lowest ≤ start ≤ highest, and anything not a number, storing nothing', () => {
    const { bucket, values, writes } = store(custom());
    const before = structuredClone(bucket);
    const late = rpgCommand('settings.set', { key: 'rpg.custom.createMin', value: 8 }, writes, values);
    assert.equal(late.ok, false);
    assert.match(late.message, /lowest ≤ stats start at ≤ highest ≤ 20/);
    const lots = rpgCommand('settings.set', { key: 'rpg.custom.createMax', value: 'lots' }, writes, values);
    assert.equal(lots.ok, false);
    assert.match(lots.message, /^It takes a whole number, \d+-\d+\.$/);
    assert.equal(rpgCommand('settings.set', { key: 'rpg.custom.startStat', value: '' }, writes, values).ok, false);
    assert.deepEqual(bucket, before);
    assert.equal(rpgCommand('settings.set', { key: 'rpg.custom.foeBase', value: 3 }, writes, values), null);
  });
  it('what an editor stores is what a new character is made with (the key creation reads)', async () => {
    const { bucket, writes } = store({ [DIFFICULTY_SETTING]: 'standard' });
    const port = createSbPort({ sdk: {}, writes, rpgValues: () => bucket });
    assert.equal((await port.command('settings.set', { key: 'rpg.difficulty', value: 'Custom' })).ok, true);
    for (const [field, value] of [['createMin', 2], ['startStat', 3], ['createMax', 14], ['createPoints', 20]]) {
      assert.equal((await port.command('settings.set', { key: `rpg.custom.${field}`, value })).ok, true, field);
    }
    const draft = newDraft({ persona: 'Astra', rules: rulesFromSettings(bucket) });
    assert.equal(draft.stats.str, 3);
    assert.deepEqual([draft.creation.budget, ...statBounds(draft, 'str')], [20, 2, 14]);
  });
});
