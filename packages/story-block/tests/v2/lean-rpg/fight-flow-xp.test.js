// Stage 49: a won fight pays the party its XP by code (fight.js):
//   - XP: won by the dice and by the narrator's own foe lines, once per fight, to every party member who has not Left, never twice with the narrator's XP
//     line, a rise at 100, and swipe, Re-read, middle delete, rebuild and reload all agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, FIGHT, FIGHT_XP, FIGHT_XP_HELD, LEAN_RPG_FEATURE, fightOf, memberXp, readSheet, scaleXp, xpRateFrom, xpRateOf } from '../../../src/v2/lean-rpg/index.js';
import { fightLines } from '../../../src/v2/lean-rpg/view/changes-lines.js';
import { reply, success } from '../data-modules/helpers.js';
import { character, cueOf, levelFoeBlock, rollReceipt, setup, sheetDomain } from './helpers.js';
import { DOWN, ONE_SIDED, SLOT, XP, fields, fieldsOf, fightReceipts, party, reloads, resultOf, same, skip, world, xpOf } from './fight-flow.helpers.js';

// ---- XP: by the dice -----------------------------------------------------------------------------------------------------

test('a fight won by the dice pays every party member who has not Left, once; the cue tells the narrator; swipe, Re-read, delete, rebuild and reload agree', { skip }, async () => {
    // One group of a single block against Wessel alone in the plan; nobody attacks, so the first hit that lands wins it (eight exchanges to land one).
    const weak = party({ foes: [['Sluice Rats', 6, 1, 1]], ren: {} });
    weak.foes.fields = levelFoeBlock([['Sluice Rats', 6, 1, 1]]);
    weak.ren.fields.health = 0;                      // Ren is Down: paid all the same
    weak.left = { role: 'character', fields: character('Orsolya', { left: true }) };
    const { host } = await setup({ blocks: weak, answers: [ONE_SIDED] });
    const { request } = await host.send('I hit the lead rat.', 'The rats are beaten.');
    const result = resultOf(host, 2);
    assert.equal(result.stop, 'won');
    assert.equal(fieldsOf(host, 'foes').hurt1, 0);
    assert.equal(FIGHT_XP.min, 1);
    assert.deepEqual([xpOf(host, 'wessel'), xpOf(host, 'ren'), xpOf(host, 'left')], [21, 21, 0], 'level 2 against six level 1: 12 × 90 % × 2, rounded down; Wessel and the Down Ren are paid, Orsolya who Left is not');
    const [step, ...others] = fightReceipts(host, 2);
    assert.equal(others.length, 0, 'one step');
    assert.deepEqual(step.data.v2.result.fight.awards.map(award => [award.who, award.xp]), [['Ren', 21], ['Wessel', 21]]);
    assert.equal(step.data.v2.result.fight.lv, 1, 'the record carries the level version');
    assert.deepEqual(step.data.v2.result.fight.groups.map(group => [group.name, group.count, group.level]), [['Sluice Rats', 6, 1]]);
    assert.ok(step.replan && step.afterCapture === true);
    assert.deepEqual(fightLines(host.ctx.chat[2].extra.storySuite).map(line => line.text), ['Ren +21 XP (fight won) · outnumbered ×2', 'Wessel +21 XP (fight won) · outnumbered ×2']);
    assert.match(cueOf(rollReceipt(host, 2)), /Code gives the party its XP for it: write no XP line for this fight/);
    assert.ok(JSON.stringify(request.chat).includes('write no XP line for this fight'), 'the cue told is the cue stored');
    same(host);
    await reloads(host);
    // Re-read keeps it; the next reply (no fight left standing) pays nothing more.
    const head = JSON.stringify(host.head());
    assert.equal((await host.turn.reread(2)).ok, true);
    assert.equal(JSON.stringify(host.head()), head);
    await host.send('I look around.', 'Quiet.');
    assert.deepEqual([xpOf(host, 'wessel'), xpOf(host, 'ren')], [21, 21], 'a fight is rewarded once');
    // A swipe of the winning reply rolls anew and pays again from nothing; a delete takes the XP with the reply.
    await host.swipe('Another telling of the lull.');
    assert.deepEqual([xpOf(host, 'wessel'), xpOf(host, 'ren')], [21, 21]);
    same(host);
    await host.st.deleteMessage(2);
    assert.deepEqual([xpOf(host, 'wessel'), xpOf(host, 'ren')], [0, 0], 'deleting the reply takes the XP with it');
    same(host);
    await reloads(host);
    host.close();
});

test('B4: a fight won on blocks made before levels (Soul Class, class{n} foes) is paid by the levels they stand for, and its witness and receipt have no level, so a rebuild, a Re-read and a reload agree', { skip }, async () => {
    const old = party({ foes: [['Sluice Rats', 6, 1, 1]], ren: {} });     // class I foes (level 5), Soul Class II members (level 15)
    old.ren.fields.health = 0;
    const { host } = await setup({ blocks: old, answers: [ONE_SIDED], levelless: true });
    await host.send('I hit the lead rat.', 'The rats are beaten.');
    assert.equal(resultOf(host, 2).stop, 'won');
    const [step] = fightReceipts(host, 2);
    assert.ok(step, 'the fight was paid');
    const span = host.ctx.chat[2].extra.storySuite.spans.find(entry => entry.guard?.predicate?.kind === FIGHT);
    assert.equal(JSON.stringify(span.guard).includes('"level"'), false, 'no level in the guard of a fight on earlier blocks');
    assert.equal(Object.hasOwn(span.recorded, 'lv'), false);
    same(host);
    await reloads(host);
    const head = JSON.stringify(host.head());
    assert.equal((await host.turn.reread(2)).ok, true);
    assert.equal(JSON.stringify(host.head()), head, 'a Re-read gives the same story');
    host.close();
});

test('each member\'s XP: count × max(1, ceil(foe level / 10)) × 2, times 100 % + 10 % a level of gap held to 0..200 %, summed and rounded down, held to 1..60, nothing at 0', () => {
    const group = (count, level) => ({ count, level });
    assert.deepEqual([FIGHT_XP.perBand, FIGHT_XP.perLevels, FIGHT_XP.gapPercent, FIGHT_XP.maxPercent, FIGHT_XP.min, FIGHT_XP.max], [2, 10, 10, 200, 1, 60]);
    // The table for one foe of level 30 (base 1 × 3 × 2 = 6), members from 10 levels below it to 10 above it.
    assert.deepEqual([-10, -5, -3, -1, 0, 1, 3, 5, 10].map(gap => [gap, memberXp([group(1, 30)], 30 + gap)]), [[-10, 12], [-5, 9], [-3, 7], [-1, 6], [0, 6], [1, 5], [3, 4], [5, 3], [10, 0]],
        'a member 10 levels below the foe gets 200 %, level for level 100 %, 10 levels above nothing');
    const six = [group(6, 1)];                    // base 12
    assert.equal(memberXp(six, 1), 12, 'same level: the base');
    assert.equal(memberXp(six, 2), 10, 'one level above the foe: 90 % of 12 = 10.8, rounded down');
    assert.equal(memberXp(six, 6), 6, 'five above: 50 %');
    assert.equal(memberXp(six, 10), 1, 'nine above: 10 % of 12 = 1.2, rounded down to 1');
    assert.equal(memberXp(six, 11), 0, 'ten above: nothing');
    assert.equal(memberXp(six, 99), 0, 'far above: nothing');
    assert.equal(memberXp([group(6, 11)], 1), 48, 'ten below an 11-level foe (base 6 × 2 × 2 = 24): 200 %');
    assert.equal(memberXp([group(1, 10)], 8), 2, 'two below a level 10 foe: base 2 × 120 % = 2.4: 2');
    assert.equal(memberXp([group(1, 11)], 9), 4, 'level 11 is the second band of ten: base 4, 120 % = 4.8: 4');
    // the band is never below 1 and steps at 11, 21, … ; the percent is held at both ends
    assert.deepEqual([1, 10, 11, 20, 21, 99].map(level => memberXp([group(1, level)], level)), [2, 2, 4, 4, 6, 20]);
    // a group that rounds to 0 alone still counts in the total (the sum is rounded, not each group)
    assert.equal(memberXp([group(1, 1)], 5), 1, '2 × 60 % = 1.2: 1');
    assert.equal(memberXp([group(1, 1)], 11), 0, '2 × 0 % = nothing');
    assert.equal(memberXp([group(1, 1), group(1, 1), group(1, 1), group(1, 1), group(1, 1), group(1, 1), group(1, 1), group(1, 1), group(1, 1)], 10), 1, 'nine groups of 0.2 make 1.8: 1');
    assert.equal(memberXp([group(1, 1), group(1, 1), group(1, 1), group(1, 1), group(1, 1), group(1, 1), group(1, 1), group(1, 1), group(1, 1), group(1, 1)], 10), 2, 'ten groups of 0.2 make 2.0: 2 (a single one makes 0)');
    // mixed groups against a level 5 member: 2 foes of level 3 (base 4, 80 % = 3.2), 1 of level 1 (base 2, 60 % = 1.2), 1 of level 12 (base 4, 170 % = 6.8)
    assert.equal(memberXp([group(2, 3), group(1, 1), group(1, 12)], 5), 11, '11.2: the sum is rounded down once');
    assert.equal(memberXp([group(1, 99), group(20, 99)], 99), 60, 'at most 60');
    // two members of different levels get different amounts from the same fight
    assert.deepEqual([memberXp(six, 1), memberXp(six, 2)], [12, 10]);
    const sheet = counts => readSheet({ domains: { dataModules: sheetDomain({ c: party().wessel, foes: { role: 'foes', fields: levelFoeBlock(counts.map(([count, level]) => ['Group', count, level, 0])) } }) } });
    assert.equal(fightOf(sheet([[3, 2]]), [1]).won, true);
    assert.equal(fightOf(sheet([[3, 2]]), []).won, false, 'a fight that began with no standing group is not won now');
});

// ---- XP: by the narrator's foe lines, on the real block engine ------------------------------------------------------------

test('a fight won by the narrator\'s own foe lines pays the party once; Astra (level 2) against six level 1 crawlers gets 21', { skip }, async t => {
    const { host } = await world(t, { party: ['Astra', 'Ren'] });
    await host.send('A swarm.', reply(SLOT));
    assert.equal(fields(host, 'Astra').xp, 0, 'a fight that is only begun pays nothing');
    await host.send('I strike.', reply('~ dm foes — why | kind: hurt-1 | to: 2'));
    assert.equal(fields(host, 'Astra').xp, 0, 'hurt, not Down');
    await host.send('I finish them.', reply(DOWN));
    assert.deepEqual([fields(host, 'Astra').xp, fields(host, 'Ren').xp], [21, 21]);
    assert.deepEqual(fightLines(host.ctx.chat[8].extra.storySuite).map(line => line.text), ['Astra +21 XP (fight won) · outnumbered ×2', 'Ren +21 XP (fight won) · outnumbered ×2']);
    // The beaten group stays on the block: the next reply pays nothing.
    await host.send('We rest.', reply('+ dm character — why | kind: add-xp | amount: 0'));
    assert.deepEqual([fields(host, 'Astra').xp, fields(host, 'Ren').xp], [21, 21]);
    // A new group in another slot is a new fight, paid for its own groups only.
    await host.send('A hound.', reply('+ dm foes — why | kind: set-slot-2 | name: Silt Hound | count: 1 | level: 2'));
    assert.equal(fields(host, 'Astra').xp, 21);
    await host.send('I kill it.', reply('~ dm foes — why | kind: hurt-2 | to: 0'));
    assert.equal(fields(host, 'Astra').xp, 23);
    assert.deepEqual(host.store.problems(), []);
    same(host);
    await reloads(host);
});

test('the narrator\'s XP line in the reply that won the fight is not used, in either order, with one Problems line; in another reply it stands', { skip }, async t => {
    for (const lines of [[DOWN, XP(50)], [XP(50), DOWN]]) {
        const { host } = await world(t);
        await host.send('A swarm.', reply(SLOT));
        await host.send('I finish them.', reply(...lines));
        assert.equal(fields(host, 'Astra').xp, 21, `${lines[0]} first: the code's 21, with the story's XP held`);
        assert.equal(fields(host, 'Astra').level, 2);
        assert.deepEqual(host.turn.problems().filter(problem => problem.message === FIGHT_XP_HELD).map(problem => problem.code), ['LIMITED'], 'one Problems line');
        // In another reply the narrator's XP line is the narrator's.
        await host.send('A kindness.', reply(XP(30)));
        assert.equal(fields(host, 'Astra').xp, 51);
        same(host);
        await reloads(host);
        host.close();
    }
});

test('XP reaching 100 raises the level by the block\'s own rule and carries the rest (95 + 21: level 3, 16 XP, 1 point)', { skip }, async t => {
    const { host } = await world(t, { xp: 95 });
    await host.send('A swarm.', reply(SLOT));
    await host.send('I finish them.', reply(DOWN));
    const astra = fields(host, 'Astra');
    assert.deepEqual([astra.level, astra.xp, astra.points], [3, 16, 1]);
    same(host);
    // A swipe takes the XP and the rise with it.
    await host.swipe(reply('~ dm foes — why | kind: hurt-1 | to: 3'));
    const swiped = fields(host, 'Astra');
    assert.deepEqual([swiped.level, swiped.xp, swiped.points], [2, 95, 0]);
    same(host);
});

test('Re-read, middle delete, rebuild and reload agree for a fight won over several replies', { skip }, async t => {
    const { host } = await world(t, { party: ['Astra', 'Ren'] });
    await host.send('A swarm.', reply(SLOT));
    await host.send('I strike.', reply('~ dm foes — why | kind: hurt-1 | to: 2'));
    await host.send('I finish them.', reply(DOWN));
    assert.equal(fields(host, 'Astra').xp, 21);
    const head = JSON.stringify(host.head());
    assert.equal((await host.turn.reread(8)).ok, true);
    assert.equal(JSON.stringify(host.head()), head, 'a Re-read gives the same story');
    same(host);
    // Deleting the reply that began the fight leaves nothing to win: the XP goes with it, and the rest still agrees with a rebuild and a reload.
    await host.st.deleteMessage(4);
    assert.equal(fields(host, 'Astra').xp, 0);
    // (the later foe lines no longer apply on a story with no crawlers: the replay says so, which is not the XP step's doing)
    assert.ok(host.store.problems().every(problem => problem.code === 'REPLAY_PREREQUISITE'), JSON.stringify(host.store.problems().map(problem => problem.code)));
    assert.equal(host.ctx.chat.flatMap(message => message.extra?.storySuite?.receipts ?? []).filter(receipt => receipt.type === FIGHT).length, 0, 'the step went with the story it was planned on');
    same(host);
    const after = JSON.stringify(host.head());
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(JSON.stringify(host.head()), after, 'a reload gives the live story');
});

test('an outnumbered fight recorded before the rule keeps its exact XP receipt through Re-read, rebuild and reload', { skip }, async t => {
    const { host } = await world(t);
    await host.send('A swarm.', reply(SLOT));
    const original = host.registry.hookEntries;
    host.registry.hookEntries = name => original(name).map(entry => ({ ...entry, fn: (view, info) => {
        const out = entry.fn(view, info);
        for (const command of out?.commands ?? []) if (command.type === FIGHT) delete command.payload.outnumbered;
        return out;
    } }));
    await host.send('I finish them.', reply(DOWN));
    host.registry.hookEntries = original;
    const receipt = () => fightReceipts(host, 6)[0];
    const kept = () => JSON.stringify({ summary: receipt().summary, fight: receipt().data.v2.result.fight, payload: receipt().replan.payload });
    const old = kept();
    assert.equal(fields(host, 'Astra').xp, 10, 'the earlier formula floors 10.8 without a bonus');
    assert.equal(receipt().replan.payload.outnumbered, undefined);
    assert.equal((await host.turn.reread(6)).ok, true);
    assert.equal(kept(), old, 'the old fight result and text stay byte-identical');
    same(host);
    await reloads(host);
    assert.equal(kept(), old);
    assert.equal(fields(host, 'Astra').xp, 10);
});

test('the step is not tied to the feature: a reply that has it keeps it when the RPG is switched off, and no new fight is paid while it is off', { skip }, async t => {
    const { host } = await world(t);
    await host.send('A swarm.', reply(SLOT));
    await host.send('I finish them.', reply(DOWN));
    assert.equal(fields(host, 'Astra').xp, 21);
    host.features.set(LEAN_RPG_FEATURE, false);
    assert.equal((await host.turn.reread(4)).ok, true);
    assert.equal(fields(host, 'Astra').xp, 21, 'the step kept on the reply stands');
    await host.send('A second swarm.', reply('+ dm foes — why | kind: set-slot-2 | name: Others | count: 2 | level: 5'));
    await host.send('Done.', reply('~ dm foes — why | kind: hurt-2 | to: 0'));
    assert.equal(fields(host, 'Astra').xp, 21, 'off means off: nothing new is paid');
});

test('deleting an earlier reply that gave XP plans the fight\'s step again on the new numbers; swipe of the winning reply takes the XP back', { skip }, async t => {
    const { host } = await world(t);
    await host.send('A kindness.', reply(XP(30)));
    await host.send('A swarm.', reply(SLOT));
    await host.send('I finish them.', reply(DOWN));
    assert.equal(fields(host, 'Astra').xp, 51);
    await host.st.deleteMessage(4);
    assert.equal(fields(host, 'Astra').xp, 21, 'the kindness is gone; the fight still pays its 21');
    assert.deepEqual(host.turn.problems().filter(problem => problem.code === 'FAILED'), []);
    same(host);
    const after = JSON.stringify(host.head());
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(JSON.stringify(host.head()), after, 'a reload gives the live story');
    await host.swipe(reply('~ dm foes — why | kind: hurt-1 | to: 3'));
    assert.equal(fields(host, 'Astra').xp, 0, 'the swiped telling did not win it');
    same(host);
});

test('a member whose XP comes to 0 gets none and no receipt line; another member, nearer the foe level, is paid from the same fight', { skip }, async t => {
    const { host } = await world(t, { party: ['Astra', 'Ren'] });
    success(await host.sdk.command('dm.set', { module: 'pack.chat/ren', fields: { level: 85 } }));
    await host.send('A swarm.', reply(SLOT.replace('count: 6', 'count: 1')));
    await host.send('I finish them.', reply(DOWN));
    assert.deepEqual([fields(host, 'Astra').xp, fields(host, 'Ren').xp], [1, 0], 'one level 1 crawler (base 2): level 2 gets 90 % = 1, level 9 gets 20 % = 0.4: nothing');
    assert.deepEqual(fightLines(host.ctx.chat[6].extra.storySuite).map(line => line.text), ['Astra +1 XP (fight won)']);
    same(host);
});

// ---- a fight opened and won in the same reply -------------------------------------------------------------------------------


test('a fight the narrator opens with its own set-slot line and wins in the same reply is paid once', { skip }, async t => {
    const { host } = await world(t);
    await host.send('A swarm, dead at once.', reply(SLOT, DOWN));
    assert.equal(fields(host, 'Astra').xp, 21);
    same(host);
    await host.send('We rest.', reply(XP(0)));
    assert.equal(fields(host, 'Astra').xp, 21, 'the beaten group does not pay again');
});

// ---- the XP rate (rpgXpRate) ----------------------------------------------------------------------------------------------------

test('scaleXp and xpRateOf: floor(gain × rate / 100), at least 1 for a gain of 1 or more, 0 stays 0; the rate is 50..300 on a step of 25', () => {
    assert.deepEqual([50, 100, 300].map(rate => scaleXp(10, rate)), [5, 10, 30]);
    assert.deepEqual([50, 75, 100, 125, 300].map(rate => scaleXp(1, rate)), [1, 1, 1, 1, 3]);
    assert.equal(scaleXp(3, 50), 1, '1.5 floors to 1');
    assert.equal(scaleXp(0, 300), 0);
    assert.equal(scaleXp(7), 7, 'no rate is 100');
    assert.equal(scaleXp(7, 60), 7, 'a rate off the step is 100');
    assert.deepEqual([49, 50, 60, 75, 300, 301, '100', null, 1.5].map(xpRateOf), [null, 50, null, 75, 300, null, null, null, null]);
    assert.deepEqual([undefined, 100, 50, 300, 10, 999, 60, 'x'].map(rate => xpRateFrom({ rpgXpRate: rate })), [100, 100, 50, 300, 50, 300, 50, 100]);
    assert.equal(DEFAULT_SETTINGS.rpgXpRate, 100);
    assert.equal(xpRateFrom(null), 100);
});

for (const rate of [50, 100, 300]) {
    test(`XP rate ${rate}: the fight's XP and the narrator's XP line are scaled, and a later change of the setting moves no reply already made`, { skip }, async t => {
        const { host } = await world(t, { rate });
        await host.send('A swarm.', reply(SLOT));
        await host.send('I finish them.', reply(DOWN));
        const fight = Math.max(1, Math.floor(21 * rate / 100));
        assert.equal(fields(host, 'Astra').xp, fight, `the fight's 21 at ${rate} %`);
        const step = host.ctx.chat.flatMap(message => message.extra?.storySuite?.receipts ?? []).find(receipt => receipt.type === FIGHT);
        assert.equal(step.data.v2.result.fight.rate, rate === 100 ? undefined : rate, 'the rate is recorded unless it is 100');
        await host.send('A kindness.', reply(XP(10)));
        assert.equal(fields(host, 'Astra').xp, fight + Math.floor(10 * rate / 100), `the narrator's 10 at ${rate} %`);
        const after = fields(host, 'Astra').xp;
        // The setting changes: nothing already made moves (a rebuild, a reload), and the next reply uses the new rate.
        host.settings.set('story-block', 'rpgXpRate', rate === 300 ? 50 : 300);
        same(host);
        await reloads(host);
        assert.equal(fields(host, 'Astra').xp, after);
        await host.send('Another kindness.', reply(XP(10)));
        assert.equal(fields(host, 'Astra').xp, after + (rate === 300 ? 5 : 30));
        same(host);
    });
}

test('XP rate: a gain of 1 stays 1 at 50 %, a gain of 0 stays 0 at 300 %, and the rate is not used with the RPG off', { skip }, async t => {
    const { host } = await world(t, { rate: 50 });
    await host.send('A nod.', reply(XP(1)));
    assert.equal(fields(host, 'Astra').xp, 1);
    await host.send('Nothing.', reply(XP(0)));
    assert.equal(fields(host, 'Astra').xp, 1);
    host.features.set(LEAN_RPG_FEATURE, false);
    await host.send('Off.', reply(XP(10)));
    assert.equal(fields(host, 'Astra').xp, 11, 'off means off: the narrator\'s line is taken as written');
});
