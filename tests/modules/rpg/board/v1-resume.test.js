// A v1 fight against the foes a lost or fled v1 fight left starts from their exact bars (resume-v1.js), and only when the story sets the same foes again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { rollReceipt } from '../helpers.js';
import { resumeFoesV1 } from '../../../../modules/rpg/board/resume-v1.js';
import { FIGHT_KIND } from '../../../../modules/rpg/board/results.js';
import { fightKind } from '../../../../modules/rpg/board/interaction.js';
import { dice } from '../../../../core/interaction/dice.js';
import { step } from './v1.helpers.js';
import { foeStats } from '../../../../modules/rpg/combat/foes.js';
import { resumeKit } from './v1-resume.helpers.js';

// (the story sets a group: the same fields its set-slot line writes)
const setGroup = async (host, { count, level, tier = 'standard' }) => {
    for (const [field, value] of [['foe1', 'Rats'], ['count1', count], ['level1', level], ['tier1', tier]]) assert.equal((await host.sdk.command('test.set', { slug: 'foes', field, value })).ok, true);
};
const lastResult = host => rollReceipt(host, 2).data.v2.result;

// A hero too weak to win and a group strong enough to hurt: attacking until the end loses; the flee loop runs away.
async function endedFight(t, how, options) {
    const kit = await resumeKit(t, options);
    assert.equal(kit.board.open(), true, 'the fight opens');
    if (how === 'fled') kit.play('normal', 1);
    const outcome = kit.play(how === 'fled' ? 'flee' : 'normal');
    return { kit, outcome };
}

for (const how of ['fled', 'lost']) {
    test(`the story sets the same foes after a ${how} v1 fight: the next fight starts from their bars`, async t => {
        const restore = seedCrypto(how === 'fled' ? 5 : 9);
        t.after(restore);
        const { kit, outcome } = await endedFight(t, how, how === 'lost' ? { hero: { hp: 20, 'hp-max': 20, vit: 1 }, level: 12, count: 4 } : { count: 3, level: 5 });
        assert.match(outcome, how === 'fled' ? /fled/u : /lost/u);
        await kit.host.send('The fight, then the end.', 'It ends.');
        const result = lastResult(kit.host);
        assert.equal(result.stop, how);
        assert.deepEqual(result.cleared, [1], 'the ended fight cleared the group');
        if (how === 'lost') assert.equal((await kit.host.sdk.command('test.set', { slug: 'character', field: 'hp', value: 20 })).ok, true, 'the hero rests (a Down hero cannot open a fight)');
        await setGroup(kit.host, { count: result.foes.length, level: result.foes[0].level });
        await kit.host.send('They come again.', 'The same foes stand again.');
        assert.equal(kit.board.open(), true);
        const setup = kit.meta().storySuiteInteraction.open.setup;
        assert.equal(setup.resumed, true);
        assert.deepEqual(setup.carried.foes.map(foe => [foe.id, foe.hp]), result.foes.map(foe => [foe.id, foe.hp]));
        const byId = [...result.foes].sort((a, b) => a.id.localeCompare(b.id));
        assert.deepEqual(kit.foeHp(), byId.map(foe => foe.hp), 'the board draws the bars the last fight left');
        assert.ok(result.foes.some(foe => foe.hp < foe.maxHp), 'the last fight hurt a foe (else the resume proves nothing)');
    });
}

test('foes the story sets differently, or a won fight in between, do not resume', async t => {
    const restore = seedCrypto(5);
    t.after(restore);
    const { kit } = await endedFight(t, 'fled', { count: 3, level: 5 });
    await kit.host.send('Away.', 'Gone.');
    await setGroup(kit.host, { count: 3, level: 7 });
    await kit.host.send('Others.', 'Other rats.');
    assert.equal(kit.board.open(), true);
    assert.equal(kit.meta().storySuiteInteraction.open.setup.resumed, undefined, 'a different level is a new group');
    assert.equal(kit.meta().storySuiteInteraction.open.setup.carried, undefined);
});

test('resumeFoesV1 reads only v1 lost or fled results, newest first, and refuses an old-engine one', () => {
    const slot = { slot: 1, name: 'Rats', count: 1, level: 5, tier: 'standard' };
    const foe = { id: '1.1', label: 'Rats', level: 5, tier: 'standard', hp: 3, maxHp: 10 };
    const receipt = (stop, v1 = 1, foes = [foe]) => ({ receipt: { type: 'interaction.settle', replan: { payload: { kindId: FIGHT_KIND } }, data: { v2: { result: { stop, foes, board: { groups: [1], ...(v1 ? { v1 } : {}) } } } } } });
    assert.equal(foe.maxHp, foeStats({ level: 5, tier: 'standard' }).hp, 'the fixture is the engine\'s own max HP');
    assert.deepEqual(resumeFoesV1([receipt('fled')], [slot]), { foes: [{ id: '1.1', hp: 3 }] });
    assert.equal(resumeFoesV1([receipt('fled'), receipt('won')], [slot]), null, 'the newest fight was won');
    assert.deepEqual(resumeFoesV1([receipt('won'), receipt('lost')], [slot]), { foes: [{ id: '1.1', hp: 3 }] });
    assert.equal(resumeFoesV1([receipt('fled', 0)], [slot]), null, 'an old-engine fight is not read');
    const old = { receipt: { type: 'interaction.settle', replan: { payload: { kindId: FIGHT_KIND } }, data: { v2: { result: { stop: 'fled', board: { groups: [1] }, members: [{ group: 1 }] } } } } };
    assert.equal(resumeFoesV1([receipt('fled'), old], [slot]), null, 'a newer old-engine fight on the slot stops the search');
    assert.equal(resumeFoesV1([receipt('fled'), receipt('open')], [slot]), null, 'a newer unfinished fight stops it');
    assert.equal(resumeFoesV1([receipt('fled')], []), null);
});

test('the group must be exactly the recorded one (not another name that starts the same), and a fallen foe stays fallen and is never targeted', async t => {
    const slot = { slot: 1, name: 'Rats', count: 2, level: 5, tier: 'standard' };
    const foes = [{ id: '1.1', label: 'Rats 1', level: 5, tier: 'standard', hp: 0, maxHp: 10 }, { id: '1.2', label: 'Rats 2', level: 5, tier: 'standard', hp: 4, maxHp: 10 }];
    const receipt = { receipt: { type: 'interaction.settle', replan: { payload: { kindId: FIGHT_KIND } }, data: { v2: { result: { stop: 'fled', foes, board: { groups: [1], v1: 1 } } } } } };
    assert.deepEqual(resumeFoesV1([receipt], [slot]), { foes: [{ id: '1.1', hp: 0 }, { id: '1.2', hp: 4 }] }, 'a fallen foe is carried at 0 HP');
    assert.equal(resumeFoesV1([receipt], [{ ...slot, name: 'Rats' }, { slot: 2, name: 'x', count: 1, level: 1 }]), null, 'a second slot with no fight is a new group');
    assert.equal(resumeFoesV1([receipt], [{ ...slot, name: 'Rat' }]), null);
    const chief = { ...receipt, receipt: { ...receipt.receipt, data: { v2: { result: { stop: 'fled', board: { groups: [1], v1: 1 }, foes: foes.map(foe => ({ ...foe, label: foe.label.replace('Rats', 'Rats Chief') })) } } } } };
    assert.equal(resumeFoesV1([chief], [slot]), null, 'Rats Chief is not Rats');
    const kit = await resumeKit(t, { count: 2, level: 5 });
    assert.equal(kit.board.open(), true);
    assert.equal(kit.current().id !== undefined, true);
    const carried = { foes: [{ id: '1.1', hp: 0 }, { id: '1.2', hp: 4 }] };
    const opened = fightKind.open(kit.host.head(), { anchor: 'x', seed: 1, attempt: 0, args: { rules: {}, resumed: carried } });
    assert.equal(opened.setup.carried.foes.length, 2);
    const played = fightKind.play(kit.host.head(), opened.setup, [step('normal', { target: '1.2' })], dice(1, 0));
    assert.equal(played.view.result.foes.find(foe => foe.id === '1.1').hp, 0, 'the fallen foe stays at 0');
    assert.ok(played.view.result.lines.every(line => !(Array.isArray(line) && line.includes('Rats 1') && line[0] === 'foe-attack')), 'the fallen foe does not attack');
});
