import test from 'node:test';
import assert from 'node:assert/strict';
import { tailOf } from '../src/module-parts/tail.js';
import { textRpgModule } from '../src/module.js';
import { SID, astra, sliceOf } from './helpers/fake-ctx.js';

const gearQuery = slots => (name, args) => (name === 'gear.view' && args.owner === 'party' ? { slots } : null);
const viewOf = (slice, { on = true, query = () => null } = {}) => ({
    feature: id => (id === 'text-rpg.on' ? on : false), state: { domains: { textRpg: slice } },
    query: (name, args) => (name === 'textRpg.dice' ? slice.dice[SID] ?? null : query(name, args)),
});
const hero = (extra = {}) => astra({ stats: { str: 15, vit: 9, agi: 13, dex: 6, int: 8, wis: 5, cha: 5 }, ...extra });

test('the capability line: stat words (ordinary left out), ranks, pool words, uses left and nothing numeric but the level', () => {
    const me = hero();
    me.pools.sp.max = 28;
    me.pools.sp.now = 28;
    me.skills[0].practice = 250;
    const { lines } = tailOf(viewOf(sliceOf([me], null)));
    assert.deepEqual(lines, ['Astra (Level 1) — STR very strong · AGI quick · Skills: Obscure (Adept): melts into shadow; Lore (Novice): old stories · Health: Unhurt · Mana: Fresh · Stamina: Fresh (14 Obscure left)']);
});

test('gear lifts the word from the total (AGI 13 + rare boots +2 is fast), capped by rarity; worn names, injuries and conditions follow', () => {
    const me = hero({ injuries: [{ name: 'cracked rib', hampers: ['str'], heals: 9, grave: 'minor' }], conditions: [{ name: 'poisoned', until: 'treated' }] });
    const slots = { feet: { name: 'Wolfhide Boots', rarity: 'rare', bonus: '+2 AGI', broken: false }, 'off-hand': { name: 'Cracked Shield', rarity: 'common', bonus: '+3 STR', broken: true }, weapon: { name: 'Ash Staff', rarity: 'common', bonus: '', broken: false } };
    const [line] = tailOf(viewOf(sliceOf([me], null), { query: gearQuery(slots) })).lines;
    assert.match(line, /STR very strong · AGI fast ·/);
    assert.match(line, /Wearing: Wolfhide Boots; Ash Staff · Injuries: cracked rib · Conditions: poisoned$/);
    const common = { feet: { name: 'Boots', rarity: 'common', bonus: '+3 AGI', broken: false } };
    assert.match(tailOf(viewOf(sliceOf([hero()], null), { query: gearQuery(common) })).lines[0], /AGI quick/, 'common caps at +1: 14 is still quick');
});

test('Down says so, a companion has a short line, the fallen are left out', () => {
    const down = hero();
    down.pools.hp.now = 0;
    const rorke = astra({ id: 'ac_rorke001', name: 'Rorke', pc: false, companion: { level: 9, strengths: ['very strong', 'a veteran swordswoman'] } });
    const gone = astra({ id: 'ac_gone0001', name: 'Gone', pc: false, fallen: { how: 'x' } });
    const { lines } = tailOf(viewOf(sliceOf([down, rorke, gone], null)));
    assert.equal(lines.length, 2);
    assert.match(lines[0], /Health: Down \(cannot act\)/);
    assert.equal(lines[1], 'Rorke (companion, level 9) — very strong, a veteran swordswoman');
});

test('the dice note follows the lines: the dice, the floor, the bonus table and the head to report', () => {
    const { lines } = tailOf(viewOf(sliceOf([astra()], { list: [11, 3, 20], floor: 2 })));
    assert.equal(lines.length, 2);
    assert.match(lines[1], /^Dice for this reply, in order: 11, 3, 20\./);
    assert.match(lines[1], /Nothing this reply is easier than hard\./);
    assert.match(lines[1], /Bonus by stat or skill: Astra: STR\+1 VIT\+1 AGI\+1 DEX\+1 INT\+1 WIS\+1 CHA\+1; Obscure\+1, Lore\+1\./);
    assert.match(lines[1], /Report each: \? try Who \| skill or stat \| difficulty/);
    assert.match(lines[1], /for example \? try Astra \| Obscure \| normal\./);
});

test('nothing while inactive or with no members', () => {
    assert.deepEqual(tailOf(viewOf(sliceOf([astra()]), { on: false })), { lines: [], optional: [] });
    assert.deepEqual(tailOf(viewOf(sliceOf([]))), { lines: [], optional: [] });
});

test('the line fits the budget: about 300 tokens for a full party, the reader\'s line within 120', () => {
    const me = hero({ injuries: [{ name: 'cracked rib', hampers: ['str'], heals: 9, grave: 'minor' }], conditions: [{ name: 'poisoned', until: 'treated' }] });
    me.skills.push({ name: 'Ash Staff', about: 'a trained staff fighter', stat: 'str', type: 'attack', cost: null, practice: 120 });
    const rorke = astra({ id: 'ac_rorke001', name: 'Rorke', pc: false, companion: { level: 9, strengths: ['very strong', 'a veteran swordswoman'] } });
    const { lines } = tailOf(viewOf(sliceOf([me, rorke], null)));
    assert.ok(lines[0].length / 4 <= 120, `${lines[0].length / 4} tokens`);
    assert.ok(lines[1].length / 4 <= 30);
    assert.equal(textRpgModule(null).context.budget, 300);
});
