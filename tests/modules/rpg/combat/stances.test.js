// The three stances of Combat Rules v1 (owner 19 Nov): Defence (soak), Speed (half mastery on evasion and tempo, no extra action) and Focus (INT or WIS,
// Mana; +5% per mastery step to the damage and healing of INT and WIS skills). One exchange per stance through the engine, with the numbers worked by hand,
// and the alias and stat tables held equal wherever they are kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playExchange } from '../../../../modules/rpg/combat/exchange.js';
import { V1 } from '../../../../modules/rpg/combat/numbers.js';
import { canOwn, skillCost, stanceOf } from '../../../../modules/rpg/combat/skills.js';
import { FOCUS_STATS, STANCE_ALIASES, STANCE_TYPES, stanceTypeOf, typeKey } from '../../../../core/runtime/skill-slots.js';
import { SKILL_TYPES_V1, SKILL_TYPE_ALIASES } from '../../../../packs/limits.js';
import { skillRoute } from '../../../../modules/data-modules/part/skills.js';
import { readSkill } from '../../../../modules/rpg/charfile-parts/read-entries.js';
import { RPG_STRINGS } from '../../../../modules/rpg/strings.js';
import { sheetSkills } from '../../../../modules/rpg/sheet-skills.js';
import { setRpgLib } from '../../../../modules/rpg/rpg-lazy.js';

const stats = { str: 8, vit: 6, agi: 10, dex: 8, int: 12, wis: 12, cha: 5 };
const DICE = { act: 12, foe: 6, check: 3, flee: 10 };
const hero = (skills, extra = {}) => ({ id: 'h', label: 'Hero', level: 10, stats, mastery: 4, hp: 30, maxHp: 30, mp: 20, maxMp: 20, sp: 20, maxSp: 20, skills, ...extra });
const foe = () => ({ id: 'f', label: 'Wolf', level: 6, tier: 'standard', hp: 60, maxHp: 60 });
const play = (h, choice, roll = kind => DICE[kind] ?? 10) => playExchange({ party: [h], foes: [foe()] }, { h: choice }, { roll, order: { party: ['h'], foes: ['f'], first: 'party' } });
const rows = (out, kind) => out.lines.filter(line => line[0] === kind);

test('Speed: half mastery (rounded up) on the evasion roll and on the tempo roll, and no extra action beyond the AGI cap', () => {
    const plain = play(hero([{ name: 'Cut', type: 'attack', stat: 'str' }]), { kind: 'attack' });
    const speed = play(hero([{ name: 'Cut', type: 'attack', stat: 'str' }, { name: 'Swift', type: 'speed', stat: 'agi' }]), { kind: 'attack' });
    assert.deepEqual(rows(speed, 'stance'), [['stance', 'Hero', ['speed']]]);
    // evasion: d20 3 + AGI 10÷3 + level 10÷4 = 8, + ceil(4÷2) = 10; tempo: d20 12 + AGI 10÷2 + 10÷4 = 19, + 2 = 21
    assert.deepEqual([rows(plain, 'foe-attack')[0][6], rows(speed, 'foe-attack')[0][6]], [8, 10]);
    assert.deepEqual([rows(plain, 'tempo')[0][4], rows(speed, 'tempo')[0][4]], [19, 21]);
    // AGI 10: the cap is one extra action, stance or not (the earlier Movement stance gave one more)
    assert.deepEqual([rows(plain, 'tempo').length, rows(speed, 'tempo').length], [1, 1]);
    assert.deepEqual([rows(plain, 'attack').length, rows(speed, 'attack').length], [2, 2]);
    assert.equal(speed.moves.find(move => move.bar === 'sp' && move.id === 'h' && move.from === 20).to, 19, 'Speed on AGI pays 1 Stamina');
});

test('Focus: INT and WIS skills hit and heal for (100 + 5 per mastery step)%, rounded down; STR skills and the normal attack are unchanged', () => {
    const bolt = { name: 'Bolt', type: 'attack', stat: 'int' }, cut = { name: 'Cut', type: 'attack', stat: 'str' }, mend = { name: 'Mend', type: 'heal', stat: 'wis' };
    const calm = { name: 'Calm', type: 'focus', stat: 'wis' };
    const damage = out => rows(out, 'attack').map(line => line[9]);
    // Bolt: INT 12÷2 + mastery 4 = 10; ×1.20 = 12. Cut: STR 8÷2 + 4 = 8, unchanged.
    assert.deepEqual(damage(play(hero([bolt]), { kind: 'attack' })), [10, 10]);
    assert.deepEqual(damage(play(hero([bolt, calm]), { kind: 'attack' })), [12, 12]);
    assert.deepEqual(damage(play(hero([cut, calm]), { kind: 'attack' })), [8, 8]);
    // the normal attack (INT 12÷2 = 6 for a magic hero) is never focused
    assert.deepEqual(damage(play(hero([bolt, calm]), { kind: 'normal' })), [6, 6]);
    // switched off: the plain amounts, nothing paid
    const off = play(hero([bolt, calm]), { kind: 'attack', stance: false });
    assert.deepEqual([damage(off), rows(off, 'stance')[0][2]], [[10, 10], []]);
    // heal: WIS 12÷3 + 4 = 8; ×1.20 = 9 (rounded down)
    const heal = h => rows(play(h, { kind: 'heal', target: 'h' }), 'heal')[0][3];
    assert.deepEqual([heal(hero([mend], { hp: 10 })), heal(hero([mend, calm], { hp: 10 }))], [8, 9]);
    // a heal on DEX (a Mending skill on DEX) is not a WIS skill: unchanged
    assert.equal(heal(hero([{ ...mend, stat: 'dex' }, calm], { hp: 10 })), 8);
    // Focus is paid from Mana: 1 MP for the stance at the exchange's start, then 1 MP for each Bolt
    const paid = play(hero([bolt, calm]), { kind: 'attack' }).moves.filter(move => move.id === 'h' && move.bar === 'mp');
    assert.equal(paid[0].amount, -1, 'the stance takes 1 Mana first');
});

test('Focus by mastery step: ×1.05 at mastery 1 up to ×1.35 at 7, rounded down; area after Focus; a hit still does at least one damage', () => {
    const big = { ...stats, int: 30 }, calm = { name: 'Calm', type: 'focus', stat: 'int' };
    const amount = (mastery, skills, choice = { kind: 'attack' }) => rows(play(hero(skills, { stats: big, mastery }), choice), 'attack')[0][9];
    const bolt = { name: 'Bolt', type: 'attack', stat: 'int' };
    // Bolt: INT 30÷2 + mastery m = 15 + m; Focus: floor((15 + m) × (100 + 5m) ÷ 100)
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(m => amount(m, [bolt, calm])), [16, 18, 20, 22, 25, 27, 29]);
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(m => amount(m, [bolt])), [16, 17, 18, 19, 20, 21, 22]);
    // area: Focus first, then 60%: mastery 4, INT 30: floor(floor(19 × 1.2) × 0.6) = floor(22 × 0.6) = 13 (plain: floor(19 × 0.6) = 11)
    const blast = { name: 'Blast', type: 'area', stat: 'int' };
    assert.equal(amount(4, [blast, calm], { kind: 'area' }), 13);
    assert.equal(amount(4, [blast], { kind: 'area' }), 11);
    // the smallest skill: INT 1, mastery 0 → 0 before Focus, 0 after; the hit still does 1
    const tiny = rows(play(hero([bolt, calm], { stats: { ...stats, int: 1 }, mastery: 0 }), { kind: 'attack' }), 'attack')[0];
    assert.equal(tiny[9], V1.damage.min);
});

test('Defence is unchanged: soak VIT + 5% per mastery step', () => {
    const shield = { name: 'Shield', type: 'defence', stat: 'vit' };
    const line = rows(play(hero([{ name: 'Cut', type: 'attack', stat: 'str' }, shield]), { kind: 'attack' }), 'foe-attack')[0];
    assert.deepEqual([line[7], line[8]], ['hit', 26], 'VIT 6 + 4 × 5 = 26%');
});

test('one stance skill per character still holds across the new types and their aliases', () => {
    assert.equal(canOwn([{ name: 'Guard', type: 'defence' }], { name: 'Dash', type: 'speed' }), false);
    assert.equal(canOwn([{ name: 'Dash', type: 'movement' }], { name: 'Calm', type: 'focus' }), false);
    assert.equal(canOwn([{ name: 'Calm', type: 'support' }], { name: 'Cut', type: 'attack' }), true);
    assert.equal(stanceOf([{ type: 'speed' }, { type: 'focus', stat: 'wis' }]), null, 'two stances: none runs');
});

test('the alias and stat tables agree wherever they are kept: numbers.js, the core slot lists, the pack words', () => {
    const stanceTypes = Object.entries(V1.skill.types).filter(([, entry]) => entry.kind === 'stance').map(([type]) => type);
    assert.deepEqual(stanceTypes, [...STANCE_TYPES]);
    const aliases = Object.fromEntries(['speed', 'focus'].flatMap(type => V1.skill.types[type].aliases.filter(word => word !== type).map(word => [word, type])));
    assert.deepEqual(aliases, { ...STANCE_ALIASES });
    assert.deepEqual(Object.fromEntries(Object.entries(SKILL_TYPE_ALIASES).filter(([word]) => word !== 'combat')), { ...STANCE_ALIASES });
    assert.deepEqual([...SKILL_TYPES_V1], Object.keys(V1.skill.types));
    assert.deepEqual([...FOCUS_STATS], [...V1.focus.stats]);
    assert.deepEqual([...FOCUS_STATS], [...V1.skill.magicStats]);
    for (const [word, type] of Object.entries(STANCE_ALIASES)) {
        assert.equal(skillCost({ type: word }).type, type, word);
        assert.equal(stanceTypeOf(word.toUpperCase()), type, word);
        assert.deepEqual(typeKey(word), { type }, word);
    }
    assert.deepEqual([typeKey('attack'), typeKey('combat'), typeKey('heal')], [{}, {}, { type: 'heal' }]);
});

test('a character file reads an earlier stance word as its new type', () => {
    const read = type => readSkill({ name: 'Rally', about: 'Keeps them steady.', stat: 'wis', rank: 1, type })?.type;
    assert.deepEqual(['evasion', 'movement', 'support', 'speed', 'focus', 'attack'].map(read), ['speed', 'speed', 'focus', 'speed', 'focus', undefined]);
});

test('the learn route adjusts a focus skill on another stat to INT or WIS (the higher of the two, WIS when unknown), with the note', t => {
    setRpgLib({ RPG_STRINGS }); t.after(() => setRpgLib(null));
    const fields = { who: 'Astra', type1: 'attack', skill1: '', stat1: 'str', sig: 0 };
    for (let n = 2; n <= 11; n += 1) Object.assign(fields, { [`skill${n}`]: '', [`type${n}`]: 'attack', [`stat${n}`]: 'str' });
    const say = (skill, stat) => RPG_STRINGS.join.focusStat.replace('{skill}', skill).replace('{stat}', stat);
    assert.deepEqual(skillRoute(fields, 'learn-1', { name: 'Calm', stat: 'cha', type: 'focus' }, 'why', 5), { kind: 'learn-1', slot: 1, name: 'Calm', adjust: { stat: 'wis', note: say('Calm', 'WIS') } });
    assert.deepEqual(skillRoute(fields, 'learn-1', { name: 'Calm', stat: 'cha', type: 'focus' }, 'why', 5, { focus: 'int' }).adjust, { stat: 'int', note: say('Calm', 'INT') });
    assert.deepEqual(skillRoute(fields, 'learn-1', { name: 'Calm', stat: 'wis', type: 'focus' }, 'why', 5, { focus: 'int' }), { kind: 'learn-1', slot: 1, name: 'Calm' });
    const held = { ...fields, skill1: 'Calm', type1: 'focus', stat1: 'wis' };
    assert.deepEqual(skillRoute(held, 'learn-2', { name: 'Calm', stat: 'str', type: 'focus' }, 'why', 5, { focus: 'int' }), { kind: 'learn-1', slot: 1, name: 'Calm', update: true, adjust: { stat: 'int', note: say('Calm', 'INT') } });
});

test('the Party sheet rows name the stance (Defence, Speed, Focus); a Focus row draws Mana', () => {
    const rows = sheetSkills([{ name: 'Guard', type: 'defence', stat: 'vit' }, { name: 'Swift', type: 'movement', stat: 'agi' }, { name: 'Calm', type: 'focus', stat: 'wis' }, { name: 'Cut', type: 'attack', stat: 'str' }], 1);
    assert.deepEqual(rows.map(row => [row.kind, row.stance, row.resource]), [['stance', 'Defence', 'stamina'], ['stance', 'Speed', 'stamina'], ['stance', 'Focus', 'mana'], ['attack', undefined, 'stamina']]);
});

test('an exchange choice naming the stance by an earlier word (evasion) holds the owned Speed stance', () => {
    const out = play(hero([{ name: 'Cut', type: 'attack', stat: 'str' }, { name: 'Swift', type: 'speed', stat: 'agi' }]), { kind: 'attack', stance: 'evasion' });
    assert.deepEqual(rows(out, 'stance'), [['stance', 'Hero', ['speed']]]);
});
