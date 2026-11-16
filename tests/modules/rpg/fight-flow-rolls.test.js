// Stage 49: a reply's exchanges run until something happens (resolve.js FLOW_VERSION):
//   - rolls: a decisive result no longer ends the reply; the rolls stop on won, lost, heavy, the cap, the budget or the careful pace;
//   - past rolls: a payload with no `flow` stops exactly as it did (Re-read keeps the record).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOW_VERSION, LIMITS, STANDARD_FORMULA } from '../../../src/v2/lean-rpg/index.js';
import { character, foeBlock, rollReceipt, setup, skillBlock } from './helpers.js';
import { ANSWER, blocksStd, dice, hit, party, planOf, reloads, resultOf, roll, same, skip, std } from './fight-flow.helpers.js';

// ---- the rolls, direct --------------------------------------------------------------------------------------------------

test('Standard: a decisive hit no longer ends the reply; the rolls go on until the foes are Down (won)', () => {
    // Round 1: a natural 20 takes 2 of the 4 blocks; rounds 2 and 3 take one each.
    const result = roll(planOf({ acts: [hit] }), { source: dice({ act0: [20, 10] }) });
    assert.deepEqual(result.rounds.map(round => round.decisive), [true, false, false]);
    assert.equal(result.stop, 'won');
    assert.deepEqual(result.hurts.filter(item => item.field === 'hurt1').map(({ from, to }) => [from, to]), [[4, 0]]);
    assert.match(result.text, /Round 3 ends the rolls: every foe is Down: the fight is won\./);
    assert.match(result.text, /Code gives the party its XP for it: write no XP line for this fight/);
    // The roll made before the flow stops at that decisive round, as it did.
    const earlier = roll(planOf({ acts: [hit] }), { source: dice({ act0: [20, 10] }), flow: 1 });
    assert.deepEqual([earlier.rounds.length, earlier.stop], [1, 'decisive']);
});

test('lost: every party member is Down', () => {
    const alone = { wessel: party().wessel, 'wessel-skills': party()['wessel-skills'], foes: party({ foes: [['Sluice Rats', 6, 6, 8]] }).foes };
    // The foe's natural 20 is a decisive hit: 2 blocks a round, from 6 blocks, so Wessel is Down in round 3 (and heavy in round 1: the first stop that happens is lost only when no one stands).
    const foe = { slot: 1, target: 'Wessel' };
    const hurt = { wessel: { ...alone.wessel, fields: { ...alone.wessel.fields, health: 1 } } };
    const result = roll(planOf({ foes: [foe] }), { blocks: { ...alone, ...hurt, foes: alone.foes }, source: dice({ foe0: [1, 20] }) });
    assert.equal(result.stop, 'lost');
    assert.equal(result.rounds.length, 1, 'Wessel, the only one, is Down in round 1');
    assert.match(result.text, /everyone on your side is Down/);
});

test('heavy: a party member who lost 2 Health blocks in this reply, or went Down, ends the rolls', () => {
    const foe = { slot: 1, target: 'Wessel' };
    const strong = party({ foes: [['Sluice Rats', 6, 6, 8]], ren: {} });
    // A decisive foe hit takes 2 blocks at once.
    const decisive = roll(planOf({ acts: [hit], foes: [foe] }), { blocks: strong, source: dice({ foe0: [1, 20] }) });
    assert.equal(decisive.stop, 'heavy');
    assert.equal(decisive.rounds.length, 1);
    // Two plain hits (a block each) in two rounds: the second makes it heavy.
    const plain = roll(planOf({ acts: [hit], foes: [foe] }), { blocks: strong, source: dice({ foe0: [2, 20, 10, 10, 2, 20, 2, 20, 2, 20] }) });
    assert.ok(plain.rounds.length >= 1 && plain.rounds.length <= 8);
    const lost = (round) => round.lines.filter(line => line.kind === 'foe' && line.damage).reduce((total, line) => total + line.damage.blocks, 0);
    assert.equal(plain.stop, 'heavy');
    assert.ok(plain.rounds.reduce((total, round) => total + lost(round), 0) >= 2);
    assert.ok(plain.rounds.slice(0, -1).reduce((total, round) => total + lost(round), 0) < 2, 'it stopped at the first round that made it two');
});

test('cap: the rules\' most exchanges per reply ends the rolls; careful still rolls one exchange', () => {
    const big = party({ foes: [['Sluice Rats', 6, 6, 8]] });
    const capped = roll(planOf({ acts: [hit] }), { blocks: big, rules: std({ roundCap: 3 }) });
    assert.deepEqual([capped.rounds.length, capped.stop], [3, 'cap']);
    const normal = roll(planOf({ pace: 'normal', acts: [hit] }), { blocks: big, rules: std({ roundCap: 8 }) });
    assert.deepEqual([normal.rounds.length, normal.stop], [8, 'cap'], 'the normal pace is no longer five: the cap decides');
    const careful = roll(planOf({ pace: 'careful', acts: [hit] }), { blocks: big, rules: std({ roundCap: 8 }) });
    assert.deepEqual([careful.rounds.length, careful.stop], [1, 'pace']);
    assert.equal(STANDARD_FORMULA.roundCap, LIMITS.roundCapDefault);
    assert.equal(LIMITS.roundCapDefault, 8);
});

test('budget: the cue that no longer fits is cut to fewer rounds, never fewer than one, and says so', () => {
    const names = ['Adalbert the Unwavering', 'Brunhilde of the Marches', 'Cornelius Featherstone', 'Dorothea Nightingale', 'Everard Longstride', 'Fenella of the Reeds'];
    const blocks = party({ foes: [['Sluice Rat Vanguard of the Lower Drain', 20, 9, 5], ['Sluice Rat Chieftain of the Lower Drain', 2, 9, 5], ['Sluice Rat Sappers of the Lower Drain', 3, 9, 5], ['Sluice Rat Archers of the Lower Drain', 3, 9, 5]] });
    for (const name of names) blocks[name] = { role: 'character', fields: character(name, { health: 5 }) };
    const acts = names.map(who => ({ who, target: 'Sluice Rat Vanguard of the Lower Drain' }));
    const foes = [1, 2, 3, 4].map(slot => ({ slot, target: names[slot] }));
    const result = roll(planOf({ acts, foes }), { blocks, source: dice({}, 20) });
    assert.ok(result.rounds.length >= 1 && result.rounds.length < 8, `${result.rounds.length} rounds`);
    assert.equal(result.stop, 'budget');
    assert.match(result.text, /is the last rolled/);
});

test('the USER\'s case: four crawlers, Hurt, against Astra: no stop on "Decisive block"; the fight runs to won', () => {
    const blocks = {
        astra: { role: 'character', fields: character('Astra', { health: 6, str: 10, vit: 10, agi: 10, dex: 6, int: 5, luk: 9, cha: 5, soul: 2, level: 2 }) },
        'astra-skills': { role: 'skills', fields: skillBlock('Astra', [['Iron Breath', 2, 'str']]) },
        foes: { role: 'foes', fields: foeBlock([['Crawlers', 4, 1, 3]]) },
    };
    const plan = planOf({ acts: [{ who: 'Astra', skill: 'Iron Breath', target: 'Crawlers' }], foes: [{ slot: 1, target: 'Astra' }] });
    // Astra defends with a natural 20 each time (a Decisive block): the old rule ended the reply on the first.
    const foe = Array.from({ length: 16 }, (_, n) => (n % 2 === 0 ? 20 : 5));
    const now = roll(plan, { blocks, source: dice({ foe0: foe }) });
    assert.equal(now.rounds[0].lines.find(line => line.kind === 'foe').decisive, true, 'round 1 holds a Decisive block');
    assert.ok(now.rounds.length > 1 && now.rounds.length <= 8, `${now.rounds.length} rounds`);
    assert.equal(now.stop, 'won');
    const before = roll(plan, { blocks, source: dice({ foe0: foe }), flow: 1 });
    assert.deepEqual([before.rounds.length, before.stop], [1, 'decisive'], 'the roll made before stops there, as it did');
});

// ---- past rolls ---------------------------------------------------------------------------------------------------------

test('a payload with no flow (a roll made before) keeps its stop rule and its record; a Re-read, a rebuild and a reload give it back byte for byte', { skip }, async () => {
    const { host } = await setup({ blocks: blocksStd(), answers: [ANSWER], flowless: true });
    await host.send('I hit the lead rat.', 'The rats scatter.');
    const receipt = rollReceipt(host, 2);
    assert.equal('flow' in receipt.replan.payload, false);
    assert.equal('flow' in receipt.data.v2.result, false);
    assert.ok(['decisive', 'over', 'pace', 'cap', 'budget'].includes(receipt.data.v2.result.stop), receipt.data.v2.result.stop);
    const kept = JSON.stringify(receipt.data.v2.result), head = JSON.stringify(host.head());
    assert.equal((await host.turn.reread(2)).ok, true);
    assert.equal(JSON.stringify(resultOf(host, 2)), kept);
    assert.equal(JSON.stringify(host.head()), head);
    same(host);
    await reloads(host);
    host.close();
});

test('a new roll carries the flow: Re-read, swipe, middle delete, rebuild and reload agree, and the stop is one of the new words', { skip }, async () => {
    const { host } = await setup({ blocks: blocksStd(), answers: [ANSWER] });
    await host.send('I hit the lead rat.', 'The rats scatter.');
    const first = rollReceipt(host, 2);
    assert.equal(first.replan.payload.flow, FLOW_VERSION);
    assert.equal(first.data.v2.result.flow, FLOW_VERSION);
    assert.ok(['won', 'lost', 'heavy', 'cap', 'budget', 'pace'].includes(first.data.v2.result.stop), first.data.v2.result.stop);
    const kept = JSON.stringify(first.data.v2.result);
    assert.equal((await host.turn.reread(2)).ok, true);
    assert.equal(JSON.stringify(resultOf(host, 2)), kept);
    await host.send('Again, I hit.', 'The rats come on.');
    await host.swipe('A different telling.');
    assert.equal(resultOf(host, 4).flow, FLOW_VERSION);
    await host.st.deleteMessage(2);
    same(host);
    await reloads(host);
    host.close();
});
