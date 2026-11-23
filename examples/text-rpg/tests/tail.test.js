import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../../../core/registry.js';
import { assemble } from '../../../core/prompt.js';
import { applyTry } from '../src/module-parts/kinds/try.js';
import { DIFFICULTIES } from '../src/rules/difficulty.js';
import { tailOf } from '../src/module-parts/tail.js';
import { textRpgModule } from '../src/module.js';
import { SID, astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';

const gearQuery = slots => (name, args) => (name === 'gear.view' && args.owner === 'party' ? { slots } : null);
const viewOf = (slice, { on = true, query = () => null, settings = {} } = {}) => ({
    feature: id => (id === 'text-rpg.on' ? on : false), state: { domains: { textRpg: slice } }, settings: () => settings,
    query: (name, args) => (name === 'textRpg.dice' ? slice.dice[SID] ?? null : query(name, args)),
});
const hero = (extra = {}) => astra({ stats: { str: 15, vit: 9, agi: 13, dex: 6, int: 8, wis: 5, cha: 5 }, ...extra });

test('the capability line: stat words (ordinary left out), ranks, pool words, uses left and nothing numeric but the level', () => {
    const me = hero();
    me.pools.sp.now = 28; // read down to the size the stats give (12)
    me.practice[me.skills[0].name.toLowerCase()] = 150;
    const { lines } = tailOf(viewOf(sliceOf([me], null)));
    assert.deepEqual(lines, ['Astra (Level 1) — STR very strong · AGI quick · Skills: Obscure (Adept): melts into shadow; Lore (Novice): old stories · Health: Unhurt · Mana: Fresh · Stamina: Fresh (6 Obscure left)']);
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
    down.down = true;
    const rorke = astra({ id: 'ac_rorke001', name: 'Rorke', pc: false, companion: { level: 9, strengths: ['very strong', 'a veteran swordswoman'] } });
    const gone = astra({ id: 'ac_gone0001', name: 'Gone', pc: false, fallen: { how: 'x' } });
    const { lines } = tailOf(viewOf(sliceOf([down, rorke, gone], null)));
    assert.equal(lines.length, 2);
    assert.match(lines[0], /Health: Down \(cannot act\)/);
    assert.equal(lines[1], 'Rorke (companion, level 9) — very strong, a veteran swordswoman');
});

test('the dice note follows the lines: the dice, the floor, the bonus table and the head to report', () => {
    const { lines } = tailOf(viewOf(sliceOf([astra()], { list: [11, 3, 20], floor: 3 })));
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^Dice for this reply, in order: 11, 3, 20\./);
    assert.match(lines[0], /Nothing this reply is easier than hard\./);
    assert.match(lines[0], /Difficulty: with no foes standing your word sets it; while foes stand the code sets it from the strongest \(or the group named with against:\) and your word is ignored;/);
    assert.match(lines[0], /Bonus: skill rank × 2 \(Novice \+0 … Legend \+12\); a stat \+0; a skill not on the sheet −3; −2 for each injury on its stat\. Astra: Obscure \+0, Lore \+0\./);
    assert.match(lines[0], /Report: \? try Who \| skill or stat \| difficulty/);
    assert.match(lines[0], /e\.g\. \? try Astra \| Obscure \| ordinary\./);
    assert.match(lines[1], /^Astra \(Level 1\)/, 'the members follow the note');
});

test('nothing while inactive or with no members', () => {
    assert.deepEqual(tailOf(viewOf(sliceOf([astra()]), { on: false })), { lines: [], optional: [] });
    assert.deepEqual(tailOf(viewOf(sliceOf([]))), { lines: [], optional: [] });
});

test('a reader\'s line stays within 120 tokens and a companion\'s within 30', () => {
    const me = hero({ injuries: [{ name: 'cracked rib', hampers: ['str'], heals: 9, grave: 'minor' }], conditions: [{ name: 'poisoned', until: 'treated' }] });
    me.skills.push({ name: 'Ash Staff', about: 'a trained staff fighter', stat: 'str', type: 'attack', cost: null });
    me.practice['ash staff'] = 120;
    const rorke = astra({ id: 'ac_rorke001', name: 'Rorke', pc: false, companion: { level: 9, strengths: ['very strong', 'a veteran swordswoman'] } });
    const { lines } = tailOf(viewOf(sliceOf([me, rorke], null)));
    assert.ok(lines[0].length / 4 <= 120, `${lines[0].length / 4} tokens`);
    assert.ok(lines[1].length / 4 <= 30);
});

test('through the prompt assembler a party of three, each with gear, an injury and a condition, keeps the dice note whole at the module\'s own budget', () => {
    const slots = { feet: { name: 'Wolfhide Boots', rarity: 'rare', bonus: '+2 AGI', broken: false }, weapon: { name: 'Ash Staff of the Long Road', rarity: 'uncommon', bonus: '+1 STR', broken: false } };
    const party = ['ac_astra001', 'ac_rorke001', 'ac_edda0001'].map((id, at) => {
        const member = hero({ id, name: ['Astra', 'Rorke', 'Edda'][at], pc: at === 0, injuries: [{ name: 'cracked rib', hampers: ['str'], heals: 9, grave: 'minor' }], conditions: [{ name: 'poisoned', until: 'treated' }] });
        member.skills.push({ name: 'Ash Staff', about: 'a trained staff fighter who knows the long road', stat: 'str', type: 'attack', cost: null });
        return member;
    });
    const slice = sliceOf(party, { list: [11, 3, 20], floor: 2 });
    const query = (name, args) => (name === 'gear.view' ? { slots } : name === 'textRpg.dice' ? slice.dice[SID] : null);
    const view = viewOf(slice, { query });
    const module = textRpgModule(null);
    const { lines } = tailOf(view);
    const note = lines.find(text => text.startsWith('Dice for this reply'));
    assert.equal(lines.length, 4);
    const tailAt = budget => {
        const registry = createRegistry();
        const { feature, ...context } = module.context;
        registry.register({ ...module, context: { ...context, budget } });
        return assemble({ registry, view: Object.freeze({ ...view, query }) }).tailText;
    };
    const kept = tailAt(module.context.budget);
    assert.ok(kept.includes(note), 'the whole note');
    for (const name of ['Astra', 'Rorke', 'Edda']) assert.ok(kept.includes(`${name} (Level 1)`), `${name}'s line`);
    // The old budget would have cut lines from the end: with the note first, a cut takes members, never the note.
    const tight = tailAt(300);
    assert.ok(tight.includes(note), 'even at 300 tokens the note is whole');
    assert.equal(module.context.budget, 600);
});

test('the dice note lists the difficulty numbers the code uses for each tone, floor included', () => {
    for (const [tone, step] of [['standard', 0], ['gritty', 1], ['heroic', -1]]) {
        for (const floor of [0, 3]) {
            const slice = sliceOf([astra()], { list: [11, 3, 20], floor });
            const { lines } = tailOf(viewOf(slice, { settings: { tone } }));
            const numbers = Object.fromEntries([...lines[0].matchAll(/(trivial|easy|ordinary|very hard|near impossible|hard) (\d+)(?=[,.])/g)].map(([, word, dc]) => [word, Number(dc)]));
            for (const [at, { word }] of DIFFICULTIES.entries()) {
                // What a `? try` of this word does: the word raised to the floor, then the tone's step.
                const made = sliceOf([astra()], { list: [11, 3, 20], floor });
                const done = run(applyTry, fakeCtx(made, { settings: { tone } }), line('try', 'Astra', `Lore; ${word}`));
                const used = DIFFICULTIES[done.result.data.difficulty].dc;
                // The note says nothing is easier than the floor's word, so a lower word reads as that word's number.
                assert.equal(numbers[DIFFICULTIES[Math.max(at, floor)].word], used, `${tone}, floor ${floor}, ${word}`);
            }
        }
    }
});
