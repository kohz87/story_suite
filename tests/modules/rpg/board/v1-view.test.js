// The v1 fight's Fight view (the kind's `view`, answered by `interaction.view`): every action's pick is accepted by the real port when written as the scene renderer writes it, Auto runs on a v1 fight, and the view moves with the steps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { setup } from '../helpers.js';
import { runAuto } from '../../../../modules/rpg/board/auto-run.js';
import { hurtHeroes } from '../../../../modules/rpg/board/auto-stop.js';
import { api, HERO_ID, openFight, v1Blocks } from './v1.helpers.js';

const withSkills = () => {
    const blocks = v1Blocks({ count: 3, level: 5 });
    blocks.skills.fields = { ...blocks.skills.fields, skill2: 'Sweep', stat2: 'str', type2: 'area', practice2: 100, rank2: 1, skill3: 'Mend', stat3: 'wis', type3: 'heal', practice3: 100, rank3: 1 };
    return blocks;
};
const host0 = async () => (await setup({ blocks: withSkills(), board: true, planner: false })).host;
const view = host => api(host).current().view;
const open = host => host.ctx.chatMetadata.storySuiteInteraction.open;
// The input the scene renderer builds for a tapped action and target (ui/tabs/scene/fight.js `commit`).
const inputOf = (actor, action, target) => ({ actor, choice: action.pick.choice, args: { ...action.pick.args, ...(target?.arg ?? {}) } });

test('the view names the party, the groups and each hero\'s actions, with the pick each one stands for', async () => {
    const restore = seedCrypto(5);
    try {
        const host = await host0();
        assert.equal(openFight(host).ok, true);
        const v = view(host);
        assert.equal(v.state, 'choose');
        assert.equal(v.exchange, 1);
        assert.deepEqual(v.foeGroups.map(group => [group.id, group.name, group.tier, group.lv, group.members.map(member => member.id)]), [['1', 'Rats', 'Standard', 5, ['1.1', '1.2', '1.3']]]);
        assert.equal(v.party[0].actorId, HERO_ID);
        assert.equal(v.actors[0].id, HERO_ID);
        const tiles = Object.values(v.actors[0].groups).flat();
        assert.deepEqual(tiles.map(tile => [tile.id, tile.target, tile.pick.choice]), [['normal', 'member', 'normal'], ['attack', 'member', 'attack'], ['area', 'none', 'area'], ['heal', 'ally', 'heal'], ['flee', 'none', 'flee']]);
        assert.equal(tiles.find(tile => tile.id === 'flee').pick.alone, true);
        assert.equal(tiles.find(tile => tile.id === 'area').pick.args.area, true);
        assert.equal(tiles.find(tile => tile.id === 'heal').enabled, false, 'nobody is hurt yet');
        assert.equal(v.end, null);
    } finally { restore(); }
});

test('every action, written as the renderer writes it, is accepted by the real port and plays', async () => {
    const restore = seedCrypto(6);
    try {
        const host = await host0();
        for (const id of ['normal', 'attack', 'area', 'flee']) {
            assert.equal(openFight(host).ok, true);
            const v = view(host), action = Object.values(v.actors[0].groups).flat().find(tile => tile.id === id);
            const target = action.target === 'member' ? v.foeGroups[0].members[1] : null;
            const staged = api(host).stage(open(host).id, { inputs: [inputOf(v.actors[0].id, action, target)] });
            assert.equal(staged.ok, true, `${id}: ${staged.message}`);
            const after = view(host);
            assert.ok(after.log.length >= 1, `${id}: the exchange is in the log`);
            if (id === 'normal' || id === 'attack') assert.match(after.log[0].rows[0].who, /^Astra → Rats 2$/u, 'the tapped foe was the target');
            assert.equal(after.state, after.end ? 'end' : 'after');
            assert.equal(api(host).discard(open(host).id).ok, true);
        }
        // a heal names its ally the way the party card writes it
        assert.equal(openFight(host).ok, true);
        const heal = view(host).actors[0].groups.Magic.find(tile => tile.id === 'heal'), ally = view(host).party[0];
        assert.equal(api(host).stage(open(host).id, { inputs: [inputOf(HERO_ID, heal, ally)] }).ok, true);
    } finally { restore(); }
});

test('Auto plays a v1 fight (it stopped at once before: the record has no `stop`) and ends on the outcome', async () => {
    const restore = seedCrypto(7);
    try {
        const host = await host0();
        assert.equal(openFight(host).ok, true);
        const ran = runAuto({ api: api(host), cap: 30 });
        assert.ok(ran.done >= 1, `Auto played exchanges (${JSON.stringify(ran)})`);
        assert.ok(['won', 'lost', 'hurt', 'cap'].includes(ran.stop), ran.stop);
        const v = view(host);
        assert.equal(v.state === 'end', ran.stop === 'won' || ran.stop === 'lost');
        assert.equal(v.exchange, v.log.at(-1).n, 'the exchange counter is the last one played');
        if (v.end) assert.deepEqual(v.actors, [], 'an ended fight asks no one');
    } finally { restore(); }
});

test('the hurt rule reads the last exchange: two fifths of the maximum HP', () => {
    const record = { party: [{ label: 'Astra', maxHp: 20 }, { label: 'Bo', maxHp: 20 }], rounds: [[['foe-attack', 'Rat', 'Astra', 1, 1, 1, 1, 'hit', 0, 8, 12], ['foe-attack', 'Rat', 'Bo', 1, 1, 1, 1, 'hit', 0, 7, 13]], [['foe-attack', 'Rat', 'Astra', 1, 1, 1, 1, 'hit', 0, 5, 7], ['foe-attack', 'Rat', 'Astra', 1, 1, 1, 1, 'hit', 0, 3, 4], ['foe-attack', 'Rat', 'Bo', 1, 1, 1, 1, 'evaded', 0, 0, 13]]] };
    assert.deepEqual(hurtHeroes(record), ['Astra']);
    assert.deepEqual(hurtHeroes({ ...record, rounds: [record.rounds[0]] }), ['Astra'], 'exactly 8 of 20 counts');
    assert.deepEqual(hurtHeroes({ ...record, rounds: [record.rounds[0].slice(1)] }), []);
});
