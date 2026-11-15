// The Standard stat formula's roll engine: the fight (turn order, opening action, who acts, fuzz),
// pack formula settings, skill resource costs, R3 pack/rotation rules, and B1 levelled foe group sizes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { foeHealthBlocks } from '../../../src/v2/lean-rpg/formula.js';
import { STAGES, positionalDice, prepare, rollPrepared, stageWord } from '../../../src/v2/lean-rpg/index.js';
import { STANDARD_FORMULA, STANDARD_PRESETS, packRulesOf, rulesFromSettings } from '../../../src/v2/lean-rpg/rules.js';
import { packAttacks, splitFoes } from '../../../src/v2/lean-rpg/board/members.js';
import { exchangePlan } from '../../../src/v2/lean-rpg/board/plan.js';
import { validatePack } from '../../../src/v2/packs/validate.js';
import { character, levelFoeBlock, setup, skillBlock } from './helpers.js';
import { dice, hit, party, planOf, prepareStandard, roll, rollStandard, sheetOf, skip, std } from './standard.helpers.js';

// ---- the fight: turn order, the opening action, who acts ---------------------------------------------------------------

// (Characters are numbered in sheet order, which is block order: Ren 0, Wessel 1; a foe group is 16 + its slot: the rats are 17.)
const two = { acts: [hit, { who: 'Ren', skill: 'Spark', target: 'Sluice Rats' }], foes: [{ slot: 1, target: 'Wessel' }] };

test('the turn order is d20 + class + AGI/2 (foes d20 + 2 × class), ties to the higher AGI then the party, and is recorded with every total', () => {
    const { result } = roll(planOf({ pace: 'careful', ...two }), { source: dice({ init0: [10], init1: [10], init17: [10] }) });
    assert.deepEqual(result.order.map(({ id, name, total, die, bonus, agi, party, fresh }) => ({ id, name, total, die, bonus, agi, party, fresh })), [
        { id: 'c:wessel', name: 'Wessel', total: 19, die: 10, bonus: 9, agi: 10, party: true, fresh: true },
        { id: 'c:ren', name: 'Ren', total: 18, die: 10, bonus: 8, agi: 8, party: true, fresh: true },
        { id: 'f:1', name: 'Sluice Rats', total: 14, die: 10, bonus: 4, agi: 0, party: false, fresh: true },
    ]);
    assert.match(result.text, /Turn order: Wessel, Ren, Sluice Rats\./);
    const tie = roll(planOf({ pace: 'careful', ...two }), { source: dice({ init0: [11], init1: [10], init17: [15] }) }).result.order.map(entry => entry.id);
    assert.deepEqual(tie, ['c:wessel', 'c:ren', 'f:1'], 'all three on 19: the higher AGI, then the party');
    const rats = roll(planOf({ pace: 'careful', ...two }), { source: dice({ init0: [1], init1: [1], init17: [20] }) }).result.order.map(entry => entry.id);
    assert.deepEqual(rats, ['f:1', 'c:wessel', 'c:ren']);
    // The rounds follow the order: the rats strike first when they win it.
    const first = roll(planOf({ pace: 'careful', ...two }), { source: dice({ init0: [1], init1: [1], init17: [20] }) }).result.rounds[0].lines.map(line => line.kind);
    assert.deepEqual(first, ['foe', 'act', 'act']);
});

test('a fight keeps its order across replies: the carried order is used as it is, a late arrival rolls on entry, a different fight rolls anew', () => {
    const carried = [{ id: 'f:1', name: 'Sluice Rats', total: 30, die: 26, bonus: 4, agi: 0, party: false }, { id: 'c:wessel', name: 'Wessel', total: 5, agi: 10, party: true }];
    const { result } = roll(planOf({ pace: 'careful', ...two }), { carried, source: dice({ init0: [20] }) });
    assert.deepEqual(result.order.map(entry => [entry.id, entry.total, entry.fresh]), [['f:1', 30, false], ['c:ren', 28, true], ['c:wessel', 5, false]], 'Ren arrives late: 20 + 8');
    assert.deepEqual(result.quickStart, [], 'a quick start is for the start of a fight');
    assert.deepEqual(result.opening, []);
    // The same names under other slots, or another group in the slot, is another fight.
    const other = roll(planOf({ pace: 'careful', ...two }), { carried: [{ ...carried[0], name: 'Weir-drake' }, carried[1]], source: dice({ init17: [10] }) }).result;
    assert.ok(other.order.every(entry => entry.fresh));
    // Nobody who is beaten is in the order.
    const beaten = roll(planOf({ pace: 'careful', ...two }), { blocks: party({ foes: [['Sluice Rats', 6, 2, 0]] }) }).result;
    assert.deepEqual(beaten.order.map(entry => entry.id).sort(), ['c:ren', 'c:wessel']);
});

test('quick start: a character 10 ahead of a foe in the order acts once against it before round 1, at the start of the fight only', () => {
    const plan = planOf({ pace: 'careful', acts: [hit], foes: [{ slot: 1, target: 'Wessel' }] });
    const { result } = roll(plan, { source: dice({ init1: [20], init17: [1], open0: [15, 10] }) });
    assert.deepEqual(result.quickStart, [{ who: 'Wessel', against: 'Sluice Rats' }]);
    assert.equal(result.opening.length, 1);
    const [opening] = result.opening;
    assert.deepEqual([opening.opening, opening.pc.die, opening.foe.die, opening.outcome, opening.damage.to], [true, 15, 10, 'success', 3]);
    assert.match(result.text, /Wessel is quick enough to act first against Sluice Rats \(an opening action\)\.\nOpening: Wessel → Sluice Rats \(Iron Breath\): SUCCESS \(27 vs 20\), a hit/);
    // The opening hit and the round's hit both count: 5 → 4 → 3 (round 1: default dice 10 against 10).
    assert.deepEqual(result.hurts.find(item => item.id === 'f:1'), { id: 'f:1', kind: 'foe', name: 'Sluice Rats', module: 'pack.chat/foes', field: 'hurt1', from: 4, to: 2, size: 4 });
    // A 9-point lead is not enough (29 against 20).
    assert.deepEqual(roll(plan, { source: dice({ init1: [11], init17: [7] }) }).result.quickStart, []);
});

test('beaten before its turn does not act: a foe group at 0 and a character who is Down lose their turn that round, and the fight ends when a side is gone', () => {
    // Wessel goes first and finishes the rats (1 block left); the rats do not strike back.
    const win = roll(planOf({ pace: 'all', ...two }), { blocks: party({ foes: [['Sluice Rats', 6, 2, 1]] }), source: dice({ init0: [1], init1: [10], init17: [15] }) }).result;
    assert.deepEqual(win.rounds[0].lines.map(line => [line.kind, line.pc.who]), [['act', 'Wessel']], 'Wessel ties the rats on 19 and goes first (AGI)');
    assert.deepEqual(win.idle, [{ n: 1, id: 'f:1', who: 'Sluice Rats', kind: 'foe', why: 'beaten' }, { n: 1, id: 'c:ren', who: 'Ren', kind: 'char', why: 'no-target' }]);
    assert.equal(win.stop, 'over');
    assert.match(win.text, /Round 1: Sluice Rats does not act: beaten\./);
    assert.match(win.text, /Round 1 is the end of the fight/);
    // The rats go first and put Wessel (1 block) Down with a decisive hit; he does not act, Ren does.
    const down = roll(planOf({ pace: 'careful', ...two }), { blocks: party({ wessel: { health: 1 } }), source: dice({ init0: [1], init1: [1], init17: [20], foe0: [1, 15] }) }).result;
    assert.deepEqual(down.rounds[0].lines.map(line => line.kind === 'foe' ? 'foe' : line.pc.who), ['foe', 'Ren']);
    assert.deepEqual(down.idle.map(item => [item.who, item.kind, item.why]), [['Wessel', 'char', 'down']]);
    assert.deepEqual(down.hurts.find(item => item.kind === 'char'), { id: 'c:wessel', kind: 'char', name: 'Wessel', module: 'pack.chat/wessel', field: 'health', from: 1, to: 0, size: 6 });
    assert.match(down.text, /Round 1: Wessel does not act: Down\./);
});

test('a foe group acts once a round whatever its count, and its Health is the group\'s: the bar belongs to the slot', () => {
    const { result } = roll(planOf({ pace: 'all', acts: [hit], foes: [{ slot: 1, target: 'Wessel' }] }), { blocks: party({ foes: [['Sluice Rats', 40, 2, 5]] }), source: dice({ act0: [1, 20], foe0: [20, 1] }) });
    for (const round of result.rounds) assert.equal(round.lines.filter(line => line.kind === 'foe').length, 1);
    assert.equal(result.rounds[0].lines.find(line => line.kind === 'act').foe.name, 'Sluice Rats');
});

test('the cue tells the narrator which bars code moved and where they stand in words; it never gives a block count', () => {
    const { result } = roll(planOf({ pace: 'careful', ...two }), { source: dice({ act0: [14, 9], foe0: [3, 18] }) });
    assert.match(result.text, /has already moved the bars they hit, heal or spend .*never set those yourself/);
    assert.match(result.text, /\nBars now: .*Wessel (Badly wounded|Wounded|Hurt|Scratched).*\./);
    assert.doesNotMatch(result.text, /block/i);
    assert.equal(stageWord(STAGES.health, 4, 6), 'Hurt');
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(blocks => stageWord(STAGES.health, blocks, 6)), ['Down', 'Badly wounded', 'Wounded', 'Hurt', 'Hurt', 'Scratched', 'Unhurt']);
    assert.deepEqual([0, 1, 4].map(blocks => stageWord(STAGES.health, blocks, 4)), ['Down', 'Badly wounded', 'Unhurt']);
});

test('a fuzz of fights: no bar leaves 0 to its size, a Down actor never acts, and the hurts are exactly what the told lines did', () => {
    const rules = std({ roundCap: 8 });
    for (let seed = 1; seed <= 150; seed += 1) {
        const hurtStart = [4, 2, 1][seed % 3], health = [6, 2, 1][seed % 3];
        const blocks = party({ wessel: { health }, foes: [['Sluice Rats', 6, 2, hurtStart], ['Weir-drake', 1, 4, 6]] });
        const plan = planOf({ pace: 'all', acts: [hit, { who: 'Ren', skill: 'Spark', area: seed % 2 === 0, target: 'Sluice Rats' }, { who: 'Ren', skill: 'Mend', support: true, difficulty: 'normal', target: 'Wessel' }],
            foes: [{ slot: 1, target: 'Wessel' }, { slot: 2, target: 'Ren', againstMagic: seed % 2 === 1 }] });
        const sheet = sheetOf(blocks), prepared = prepare(plan, sheet, rules);
        const result = rollPrepared(plan, prepared, positionalDice(seed * 7919), rules, {});
        const all = [...prepared.roster.characters, ...prepared.roster.foes, ...prepared.roster.resources];
        const bars = new Map(all.map(bar => [bar.id, bar.value]));
        const acted = new Set();
        for (const line of [...result.opening, ...result.checks, ...result.rounds.flatMap(round => round.lines)]) {
            const actor = line.kind === 'foe' ? `f:${line.foe.slot}` : `c:${line.pc.who.toLowerCase()}`;
            assert.ok(bars.get(actor) > 0, `seed ${seed}: ${actor} acted at 0`);
            acted.add(actor);
            for (const moved of [line.damage, line.cost]) {
                if (!moved) continue;
                assert.equal(moved.from, bars.get(moved.id), `seed ${seed}: the line starts from the bar`);
                assert.ok(moved.to >= 0 && moved.to <= moved.size);
                bars.set(moved.id, moved.to);
            }
        }
        for (const hurt of result.hurts) assert.equal(hurt.to, bars.get(hurt.id), `seed ${seed}: hurt ends where the lines end`);
        assert.equal(result.hurts.length, all.filter(bar => bar.value !== bars.get(bar.id)).length);
        const total = result.rounds.length;
        assert.ok(total <= rules.roundCap);
        assert.ok(['decisive', 'over', 'pace', 'cap', 'budget', 'none'].includes(result.stop));
        for (const round of result.rounds.slice(0, -1)) assert.equal(round.decisive, false, `seed ${seed}: only the last round may be decisive`);
    }
});

// ---- a pack may set the formula and its numbers -----------------------------------------------------------------------------

const packOf = rpg => ({ id: 'sealed', version: '1.0.0', name: 'Sealed', author: 'Test', description: 'A pack that sets the Standard formula\'s numbers.', requires: { storyBlock: '^2' }, content: { rpg } });

test('a pack\'s content.rpg may name the formula and its numbers; they are kept as one more record and read as the story\'s default', () => {
    const ok = validatePack(packOf({ formula: 'standard', numbers: { foeBase: 6, startStat: 6 }, skillSets: [{ name: 'Set', skills: [{ name: 'Spear', about: 'Holds a line.', stat: 'str' }] }] }));
    assert.equal(ok.ok, true, JSON.stringify(ok.errors));
    const records = ok.pack.content.rpg;
    assert.equal(records.length, 2, 'the skill set, then the formula record');
    assert.deepEqual(records.at(-1), { id: 'sealed/formula', slug: 'formula', pack: 'sealed', formula: 'standard', numbers: { foeBase: 6, startStat: 6 } });
    const pack = packRulesOf(records);
    assert.deepEqual(pack, { pack: 'sealed', formula: 'standard', numbers: { foeBase: 6, startStat: 6 } });
    assert.equal(packRulesOf(records.slice(0, 1)), null);
    assert.equal(packRulesOf(undefined), null);
    // Bad words are named and the pack is refused (Classic is among them: it was removed); a pack with only skill sets is exactly what it was.
    const bad = validatePack(packOf({ formula: 'modern', numbers: { foeBase: 'high', luck: 3 } }));
    assert.equal(bad.ok, false);
    assert.deepEqual(bad.errors.map(error => error.path).sort(), ['content.rpg.formula', 'content.rpg.numbers.foeBase', 'content.rpg.numbers.luck']);
    assert.equal(validatePack(packOf({ formula: 'classic' })).ok, false, 'Classic rules were removed');
    assert.equal(validatePack(packOf({ skillSets: [] })).pack.content.rpg.length, 0);
    // The reader's choice wins; a pack fills in what they have not chosen.
    assert.deepEqual(rulesFromSettings({}, pack), { ...STANDARD_FORMULA, foeBase: 6, startStat: 6, levelDivisor: 5 });
    assert.deepEqual(rulesFromSettings({ rpgDifficulty: 'harsh' }, pack), { ...STANDARD_PRESETS.harsh, levelDivisor: 5 }, 'a difficulty the reader picked is theirs');
    assert.deepEqual(rulesFromSettings({}, null), { ...STANDARD_FORMULA, levelDivisor: 5 });
});

// ---- a skill costs a block of its resource ----------------------------------------------------------------------------------

test('a skill used spends one block of its resource (Stamina or Mana), recorded on the line and on the roll\'s hurts; an action with no skill spends nothing', () => {
    // Wessel: AGI 10 → 5 Stamina blocks, 4 held; Ren: INT 16 → 6 Mana blocks (the stock fields held 4 stages at most: the sheet says 4).
    const { result } = roll(planOf({ pace: 'careful', acts: [hit, { who: 'Ren', skill: 'Spark', target: 'Sluice Rats' }] }), { blocks: party({ ren: { mana: 3 } }), source: dice({ init1: [10], init0: [1] }) });
    const [wessel, ren] = ['Wessel', 'Ren'].map(name => result.rounds[0].lines.find(line => line.pc.who === name));
    assert.deepEqual(wessel.cost, { id: 'c:wessel:stamina', kind: 'char', name: 'Wessel', blocks: 1, from: 4, to: 3, size: 5 });
    assert.deepEqual(ren.cost, { id: 'c:ren:mana', kind: 'char', name: 'Ren', blocks: 1, from: 3, to: 2, size: 6 });
    assert.deepEqual(result.hurts.filter(item => /stamina|mana/.test(item.field)).map(({ id, field, from, to }) => [id, field, from, to]), [['c:wessel:stamina', 'stamina', 4, 3], ['c:ren:mana', 'mana', 3, 2]]);
    assert.match(result.text, /Bars now: .*Wessel Stamina (Winded|Tired|Fresh).*Ren Mana /);
    assert.doesNotMatch(result.text, /block/i);
    const bare = roll(planOf({ pace: 'careful', acts: [{ who: 'Wessel', type: 'physical', target: 'Sluice Rats' }] })).result;
    assert.equal(bare.rounds[0].lines[0].cost, undefined);
    assert.deepEqual(bare.hurts.filter(item => /stamina|mana/.test(item.field)), []);
});

test('an area attack, a heal and a defence with a skill each cost one block; a refused or idle action costs nothing', () => {
    const foes = [['Rats', 2, 1, 4], ['Drake', 1, 2, 4]];
    const area = roll(planOf({ pace: 'careful', acts: [{ who: 'Ren', skill: 'Spark', area: true, target: 'Rats' }] }), { blocks: party({ foes, ren: { mana: 4 } }) }).result;
    assert.equal(area.rounds[0].lines.length, 2);
    assert.deepEqual(area.rounds[0].lines.map(line => line.cost?.to), [3, undefined], 'one cost for the action, on its first line');
    const mend = roll(planOf({ pace: 'careful', acts: [{ who: 'Ren', skill: 'Mend', support: true, difficulty: 'normal', target: 'Wessel' }] }), { blocks: party({ wessel: { health: 3 }, ren: { mana: 4 } }) }).result;
    assert.equal(mend.rounds[0].lines[0].cost.id, 'c:ren:mana');
    const defence = roll(planOf({ pace: 'careful', foes: [{ slot: 1, target: 'Wessel', skill: 'Iron Breath' }], acts: [] }), { blocks: party({ wessel: { stamina: 3 } }) }).result;
    assert.equal(defence.rounds[0].lines[0].skill, 'Iron Breath');
    assert.deepEqual([defence.rounds[0].lines[0].cost.from, defence.rounds[0].lines[0].cost.to], [3, 2]);
    // Down before its turn: no action, no cost.
    const down = roll(planOf({ pace: 'careful', acts: [hit], foes: [{ slot: 1, target: 'Wessel' }] }), { blocks: party({ wessel: { health: 1 } }), source: dice({ init1: [1], init17: [20], foe0: [1, 15] }) }).result;
    assert.deepEqual(down.hurts.filter(item => item.field === 'stamina'), []);
    // A check with a skill counts too.
    const check = roll(planOf({ checks: [{ who: 'Ren', skill: 'Spark', type: 'check', fit: 'int', difficulty: 'easy' }] }), { blocks: party({ ren: { mana: 2 } }) }).result;
    assert.deepEqual([check.checks[0].cost.from, check.checks[0].cost.to], [2, 1]);
});

test('R3: a pack turn is capped by its current bar and uses only the attacks actually made', () => {
    const blocks = {
        wessel: { role: 'character', fields: character('Wessel', { health: 8, str: 20, agi: 20, vit: 20, stamina: 4 }) },
        'wessel-skills': { role: 'skills', fields: skillBlock('Wessel', [['Sweep', 3, 'str', 'stamina', 'sweep every foe']]) },
        ren: { role: 'character', fields: character('Ren', { health: 8 }) },
        'ren-skills': { role: 'skills', fields: skillBlock('Ren', [['Cut', 1, 'str', 'stamina', 'strike one foe']]) },
        foes: { role: 'foes', fields: levelFoeBlock([['Cellar-rat', 12, 1, 4]]) },
    };
    const base = sheetOf(blocks), sheet = { ...base, foes: splitFoes(base.foes) };
    const built = exchangePlan(sheet, [{ who: 'Wessel', kind: 'skill', skill: 'Sweep', area: true, group: 1 },
        { who: 'Ren', kind: 'skill', skill: 'Cut', target: 11 }], {}, 1, { members: true });
    assert.equal(built.error, undefined, built.error);
    assert.equal(built.plan.foes.length, 3, 'the plan starts from the full pack');
    const prepared = prepareStandard(built.plan, sheet, std(), { lv: true, fix: true, then: true });
    const source = (kind, at) => () => (kind === 'init' ? (at === 1 ? 20 : 1) : kind === 'act' ? (at === 0 ? 20 : 1) : 10);
    const rolled = rollStandard(built.plan, prepared, source, std(), { flow: 2, fix: true, then: true, board: true });
    const defences = rolled.rounds[0].lines.filter(line => line.kind === 'foe');
    const hit = rolled.rounds[0].lines.find(line => line.kind === 'act' && line.damage);
    assert.equal(hit?.damage.to, 4, 'the area hit thins the pack first');
    assert.equal(defences.length, packAttacks(12, 4, 8), 'when its turn comes the pack makes two, not three, attacks');
    assert.deepEqual(defences.map(line => line.pc.who), ['Ren', 'Wessel'], 'targets rotate over the attacks actually made');
});

test('R3: a killed first planned attacker hands the first target and its defence to the next executed attack', () => {
    const plain = {
        hero: { role: 'character', fields: character('Astra', { str: 20, agi: 20, vit: 20, health: 8 }) },
        ally: { role: 'character', fields: character('Ren', { agi: 10, health: 8 }) },
        foes: { role: 'foes', fields: levelFoeBlock([['Bat', 1, 1, 1], ['Wolf', 1, 1, 4]]) },
    };
    const order = sheetOf(plain).characters.map(item => item.who), first = order[0];
    const blocks = { ...plain, [`${first}-skills`]: { role: 'skills', fields: skillBlock(first, [['Dodge', 3, 'agi', 'stamina', 'evasion']]) } };
    const base = sheetOf(blocks), sheet = { ...base, foes: splitFoes(base.foes) };
    const actions = [{ who: order[0], kind: 'attack', target: 1 }, { who: order[1], kind: 'attack', target: 2 }];
    const built = exchangePlan(sheet, actions, {}, 1, { members: true });
    assert.equal(built.error, undefined, built.error);
    assert.notEqual(built.plan.rotation.targets[0].target, built.plan.foes[1].target, 'the second foe was not planned for the first target');
    const prepared = prepareStandard(built.plan, sheet, std(), { lv: true, fix: true, then: true });
    const source = (kind, at) => () => {
        if (kind === 'init') return at === 0 ? 20 : at === 1 ? 19 : at === 17 ? 1 : 2;
        if (kind === 'act') return at === 0 ? (source.act0.shift() ?? 1) : 1;
        return 10;
    };
    source.act0 = [20, 1];
    const rolled = rollStandard(built.plan, prepared, source, std(), { flow: 2, fix: true, then: true, board: true });
    assert.equal(rolled.hurts.find(hurt => hurt.id === 'f:1')?.to, 0, 'the first planned attacker is killed before its turn');
    const defences = rolled.rounds[0].lines.filter(line => line.kind === 'foe');
    assert.equal(defences.length, 1);
    assert.equal(defences[0].foe.name, 'Wolf');
    assert.equal(defences[0].pc.who, built.plan.rotation.targets[0].target, 'the surviving attack takes the first rotation slot');
    assert.equal(defences[0].skill, built.plan.rotation.targets[0].skill, 'and that target\'s own defence');
});

test('R3: mixed groups keep rotating after a pack thins to fewer attacks', () => {
    const blocks = {
        wessel: { role: 'character', fields: character('Wessel', { health: 8, str: 20, agi: 20, vit: 20, stamina: 4 }) },
        'wessel-skills': { role: 'skills', fields: skillBlock('Wessel', [['Sweep', 3, 'str', 'stamina', 'sweep every foe']]) },
        ren: { role: 'character', fields: character('Ren', { health: 8, agi: 10, vit: 20 }) },
        foes: { role: 'foes', fields: levelFoeBlock([['Rat', 12, 1, 4], ['Bat', 1, 1, 4]]) },
    };
    const base = sheetOf(blocks), sheet = { ...base, foes: splitFoes(base.foes) };
    const actions = [{ who: 'Wessel', kind: 'skill', skill: 'Sweep', area: true, group: 1 }, { who: 'Ren', kind: 'attack', target: 2 }];
    const built = exchangePlan(sheet, actions, {}, 1, { members: true });
    const prepared = prepareStandard(built.plan, sheet, std(), { lv: true, fix: true, then: true });
    const wesselAt = base.characters.findIndex(item => item.who === 'Wessel'), renAt = base.characters.findIndex(item => item.who === 'Ren');
    const source = (kind, at) => () => {
        if (kind === 'init') return at === wesselAt ? 20 : at === renAt ? 19 : 1;
        if (kind === 'act') return at === 0 ? (source.act0.shift() ?? 1) : 1;
        return 10;
    };
    source.act0 = [20, 1];
    const rolled = rollStandard(built.plan, prepared, source, std(), { flow: 2, fix: true, then: true, board: true });
    const defences = rolled.rounds[0].lines.filter(line => line.kind === 'foe');
    assert.deepEqual(defences.map(line => line.foe.slot), [11, 11, 2]);
    assert.deepEqual(defences.map(line => line.pc.who), [
        built.plan.rotation.targets[0].target, built.plan.rotation.targets[1].target, built.plan.rotation.targets[0].target,
    ], 'the bat takes the next slot after the pack\'s two executed attacks');
});

test('R3: an old plan keeps its exact shape and gains no new-board rotation', () => {
    const sheet = sheetOf({
        hero: { role: 'character', fields: character('Astra') },
        foes: { role: 'foes', fields: levelFoeBlock([['Bat', 1, 1, 4]]) },
    });
    const built = exchangePlan(sheet, [{ who: 'Astra', kind: 'attack', target: 1 }]);
    assert.deepEqual(built.plan, {
        formula: 'standard', pace: 'careful',
        acts: [{ who: 'Astra', target: 'foe1', type: 'physical' }],
        foes: [{ slot: 1, target: 'Astra' }], checks: [],
    });
});

test('R3: automatic defence is paid on the first attack that reaches the member and covers the rest', () => {
    const blocks = {
        wessel: { role: 'character', fields: character('Wessel', { health: 8, agi: 20, stamina: 4 }) },
        'wessel-skills': { role: 'skills', fields: skillBlock('Wessel', [['Dodge', 3, 'agi', 'stamina', 'evasion']]) },
        foes: { role: 'foes', fields: levelFoeBlock([['Boar', 3, 1, 4]]) },
    };
    const base = sheetOf(blocks), sheet = { ...base, foes: splitFoes(base.foes) };
    const plan = planOf({ foes: [0, 1, 2].map(() => ({ slot: 11, target: 'Wessel', skill: 'Dodge', once: true })) });
    const prepared = prepareStandard(plan, sheet, std(), { lv: true, fix: true, then: true });
    const rolled = rollStandard(plan, prepared, dice({ init0: [20], init17: [1] }), std(), { flow: 2, fix: true, then: true, board: true });
    const defences = rolled.rounds[0].lines.filter(line => line.kind === 'foe');
    assert.deepEqual(defences.map(line => line.skill), ['Dodge', 'Dodge', 'Dodge']);
    assert.deepEqual(defences.map(line => (line.cost ? [line.cost.from, line.cost.to] : null)), [[4, 3], null, null]);
    assert.deepEqual(rolled.hurts.filter(hurt => hurt.field === 'stamina').map(hurt => [hurt.from, hurt.to]), [[4, 3]]);
});

test('the resource runs out in the fight: the last block is spent, then the action is rolled without the skill and the line says so; nothing goes below 0', () => {
    const blocks = party({ wessel: { stamina: 1 } });
    const { result, prepared } = roll(planOf({ pace: 'all', acts: [hit] }), { blocks, source: dice({ init1: [10], init17: [10] }) });
    assert.deepEqual(prepared.refused, [], 'it was not empty at the start');
    const lines = result.rounds.flatMap(round => round.lines);
    assert.ok(lines.length >= 2, 'a calm fight of several rounds');
    assert.deepEqual([lines[0].skill, lines[0].cost.to, lines[0].without], ['Iron Breath', 0, undefined]);
    assert.deepEqual([lines[1].skill, lines[1].pc.rank, lines[1].pc.stat, lines[1].without, lines[1].cost], [null, 0, 'str', 'Iron Breath', undefined]);
    assert.equal(lines[1].pc.total - lines[1].pc.die, 6 + 4, 'the pair and Soul Class only: no rank');
    assert.match(result.text, /Round 2: Wessel → Sluice Rats \(Iron Breath unavailable: resource spent\)/);
    assert.equal(result.hurts.find(item => item.field === 'stamina').to, 0);
    // Already empty at the start: refused as before, rolled without it, and nothing to spend.
    const empty = roll(planOf({ pace: 'careful', acts: [hit] }), { blocks: party({ wessel: { stamina: 0 } }) });
    assert.equal(empty.prepared.refused.length, 1);
    assert.equal(empty.result.rounds[0].lines[0].cost, undefined);
});

test('the cost goes through the turn: it is written to the sheet, and a Re-read, a swipe, a rebuild and a reload agree', { skip }, async () => {
    const { host } = await setup({ blocks: party({ wessel: { stamina: 4 } }), answers: ['pace: careful\nact Wessel | skill: Iron Breath | type: physical | target: Sluice Rats'] });
    const fieldsOf = () => host.head().domains.dataModules.instances['pack.chat/wessel'].chat.fields;
    const result = () => host.ctx.chat[2].extra.storySuite.receipts.find(receipt => receipt.type === 'rpg.resolve').data.v2.result;
    // (an opening action and each round's action each spend one: the sheet holds 4 less what the told lines spent)
    const spentBy = () => [...result().opening, ...result().rounds.flatMap(round => round.lines)].filter(line => line.cost).length;
    await host.send('I strike.', 'The rats scatter.');
    assert.ok(spentBy() >= 1);
    assert.equal(fieldsOf().stamina, 4 - spentBy());
    assert.equal(result().hurts.find(item => item.field === 'stamina').to, fieldsOf().stamina);
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(JSON.stringify(host.head()), live);
    assert.equal((await host.turn.reread(2)).ok, true);
    assert.equal(JSON.stringify(host.head()), live, 'a Re-read keeps it');
    for (let n = 0; n < 3; n += 1) { await host.swipe(`Again ${n}.`); assert.equal(fieldsOf().stamina, 4 - spentBy(), 'a swipe starts from the sheet before the reply, and spends only what its own roll spent'); }
    await host.st.deleteMessage(2);
    assert.equal(fieldsOf().stamina, 4, 'a delete gives the blocks back');
    host.close();
});

test('B1: a levelled foe group has 4 + floor(level / 30) blocks (levels 25 to 29 are 4, not the class\'s 5); a group of the earlier rules keeps its class\'s size', () => {
    const sizeOfFoe = (foes, key) => {
        const blocks = party({ foes });
        if (key === 'level') blocks.foes.fields = levelFoeBlock(foes);
        const rules = std();
        const prepared = prepare(planOf({ acts: [{ who: 'Wessel', skill: null, type: 'physical', target: 'Ogre' }], foes: [] }), sheetOf(blocks), rules, { maxOf: () => 8, lv: key === 'level' });
        return prepared.witness.roster.foes.map(bar => bar.size);
    };
    assert.deepEqual([25, 28, 29, 30, 59, 60].map(level => sizeOfFoe([['Ogre', 1, level, 8]], 'level')[0]), [4, 4, 4, 5, 5, 6]);
    assert.equal(sizeOfFoe([['Ogre', 1, 3, 8]], 'class')[0], foeHealthBlocks(3), 'class III of the earlier rules: 5');
});
