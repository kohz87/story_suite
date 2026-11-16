// The old-engine fight's Fight view (the kind's `view`): every standing member's actions with the pick each one stands for, and the picks the renderer writes are accepted by the real port.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STANDARD_FORMULA } from '../../../../modules/rpg/rules.js';
import { actorIdOf } from '../../../../modules/rpg/roster.js';
import { readSheet } from '../../../../modules/rpg/read.js';
import { boardApi, openBoard } from '../../../core/helpers/board-port.js';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { character, foeBlock, setup, skillBlock } from '../helpers.js';

const FIGHT = {
    hero: { role: 'character', fields: character('Astra', { str: 20, agi: 20, stamina: 4 }) },
    skills: { role: 'skills', fields: skillBlock('Astra', [['Cut', 3, 'str', 'stamina', 'strike one foe']]) },
    foes: { role: 'foes', fields: foeBlock([['Rats', 3, 1, 5]]) },
};
const RULES = { ...STANDARD_FORMULA, levelDivisor: 5 };
const inputOf = (actor, action, target) => ({ actor, choice: action.pick.choice, args: { ...action.pick.args, ...(target?.arg ?? {}) } });

test('an old fight\'s view lists the party, the groups and each member\'s actions; a tapped pick stages and plays', async () => {
    const restore = seedCrypto(9);
    try {
        const { host } = await setup({ blocks: FIGHT, board: true });
        const sid = host.store.carrierSid(host.store.headIndex()), state = host.head();
        assert.ok(openBoard(host.ctx.chatMetadata, state, { sid, rules: RULES }).session);
        const api = boardApi(host.ctx.chatMetadata, () => host.head(), sid), now = api.current(), v = now.view;
        const id = actorIdOf(readSheet(state).characters[0].module);
        assert.equal(v.state, 'choose');
        assert.equal(v.party[0].actorId, id);
        assert.equal(v.foeGroups[0].members.length, 3);
        assert.equal(typeof v.foeGroups[0].members[0].arg.target, 'number', 'an old foe is targeted by slot');
        assert.equal(v.actors[0].id, id);
        const tiles = Object.values(v.actors[0].groups).flat();
        assert.ok(tiles.some(tile => tile.pick.choice === 'attack') && tiles.some(tile => tile.pick.choice === 'skill') && tiles.some(tile => tile.pick.choice === 'flee'));
        assert.equal(tiles.find(tile => tile.pick.choice === 'attack').pick.args.who, 'Astra', 'the old kind needs `who`');
        assert.ok(v.result?.rounds, 'the record rides along for the page\'s own readers');
        const attack = tiles.find(tile => tile.pick.choice === 'attack');
        const staged = api.stage(now.id, { inputs: [inputOf(id, attack, v.foeGroups[0].members[0])] });
        assert.equal(staged.ok, true, staged.message);
        const after = api.current().view;
        assert.equal(after.log.length, 1);
        assert.equal(after.state, 'after');
        assert.equal(after.exchange, 1);
        assert.equal(tiles.find(tile => tile.pick.choice === 'flee').pick.alone, true);
    } finally { restore(); }
});
