// The fight kind's other members: Auto's pick, the next segment's setup, the witness and the actor list, each against the pre-port board's own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { autoPicks } from '../../../../src/v2/lean-rpg/board/auto.js';
import { fightSeed } from '../../../../src/v2/lean-rpg/board/dice.js';
import { equipmentForBoard, playBoard } from '../../../../src/v2/lean-rpg/board/engine.js';
import { fightKind, toAction } from '../../../../src/v2/lean-rpg/board/interaction.js';
import { boardSession, openBoard, receiveBoard, stageExchange } from '../../../../src/v2/lean-rpg/board/session.js';
import { hashJson } from '../../../../src/v2/replay.js';
import { seedCrypto } from '../../qa/helpers/seeded.js';
import { ASTRA_ID, RULES, fxHost, stepOf } from './interaction.helpers.js';

const anchorOf = host => host.store.carrierSid(host.store.headIndex());
const slotOf = host => { for (let slot = 1; slot < 40; slot += 1) if (!playBoard(host.head(), { seed: 1, offset: 0, rules: RULES, members: 1, aoe: 1, areaAll: 1, foesSix: 1, foesClear: 1, fightLen: 1 }, [{ actions: [{ who: 'Astra', kind: 'attack', target: slot }] }]).error) return slot; return 0; };
const opened = host => { const sid = anchorOf(host), made = fightKind.open(host.head(), { anchor: sid, seed: fightSeed(sid, 0), args: { rules: RULES } }); assert.equal(made.error, undefined, made.error); return made.setup; };

test('Auto: the kind picks what the pre-port Auto picked, for the sheet the steps so far leave', async () => {
    const restore = seedCrypto(7), host = await fxHost();
    try {
        const setup = opened(host), slot = slotOf(host), steps = [stepOf({ who: 'Astra', kind: 'attack', target: slot })];
        for (const taken of [[], steps]) {
            const now = playBoard(host.head(), setup, taken.map(step => ({ actions: step.inputs.map(toAction) })));
            const old = autoPicks({ state: now.state, setup, members: now.result.members, number: setup.offset + taken.length + 1 }, RULES);
            const pick = fightKind.auto(host.head(), setup, taken, ASTRA_ID);
            assert.deepEqual(toAction(pick), old[0], `after ${taken.length} step(s)`);
        }
        assert.throws(() => fightKind.auto(host.head(), setup, [], 'ac_nobody00'), /nothing to do/);
    } finally { host.close(); restore(); }
});

test('next: the carried setup is the one the pre-port carry made (offset, order, member bars; the opening-only keys dropped)', async () => {
    const restore = seedCrypto(7), host = await fxHost();
    try {
        const meta = host.ctx.chatMetadata, sid = anchorOf(host), setup = opened(host), slot = slotOf(host);
        const actions = [{ who: 'Astra', kind: 'attack', target: slot }];
        assert.equal(openBoard(meta, host.head(), { sid, rules: RULES }).error, undefined);
        assert.equal(stageExchange(meta, host.head(), actions).error, undefined);
        const session = boardSession(meta), played = playBoard(host.head(), session.setup, session.exchanges);
        assert.equal(played.result.stop, 'open', 'the fight goes on');
        const payload = { id: session.id, anchor: session.anchor, groups: session.groups, setup: session.setup, exchanges: session.exchanges };
        assert.equal(receiveBoard(meta, { key: 'b:k', board: payload }, played.result, 'next-sid', 'rc_1', host.head(), null), true);
        const old = boardSession(meta).setup, next = fightKind.next({ ...setup, witness: { offset: 0, hash: 'x' } }, { ...played.result, rounds: played.result.rounds }, host.head());
        assert.deepEqual(next, { ...old, id: setup.id, groups: setup.groups, practice: setup.practice });
        assert.equal(next.offset, 1);
        assert.equal(next.witness, undefined);
    } finally { host.close(); restore(); }
});

test('the witness moves when the sheet or a consumable in the bag does, and not otherwise; the actors are the standing party', async () => {
    const restore = seedCrypto(7), host = await fxHost();
    try {
        const setup = opened(host), now = hashJson(fightKind.witness(host.head(), setup));
        assert.equal(hashJson(fightKind.witness(host.head(), setup)), now, 'the same state gives the same witness');
        assert.deepEqual(fightKind.actors(host.head(), setup), [{ id: ASTRA_ID, name: 'Astra', party: true }]);
        const bag = host.bus.run('inventory.consume', { def: 'story/healing-draught', qty: 1 }, { cause: 'system' });
        assert.equal(bag.ok, true, bag.message);
        assert.notEqual(hashJson(fightKind.witness(bag.state, setup)), now, 'a drink gone from the bag moves it');
        const hurt = host.bus.run('rpg.board.hurts', { hurts: [{ module: 'pack.chat/foes', field: 'hurt1', to: 2 }] }, { cause: 'system' });
        assert.notEqual(hashJson(fightKind.witness(hurt.state, setup)), now, 'a foe\'s bar moved moves it');
        const setupB = { ...setup, seed: setup.seed + 1 };
        assert.equal(hashJson(fightKind.witness(host.head(), setupB)), now, 'the seed is not part of what the fight read');
    } finally { host.close(); restore(); }
});
