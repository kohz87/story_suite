// The fight kind's other members: Auto's pick, the next segment's setup, the witness and the actor list, each against the pre-port board's own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { autoPicks } from '../../../../modules/rpg/board/auto.js';
import { fightSeed } from '../../../../modules/rpg/board/dice.js';
import { equipmentForBoard, playBoard } from '../../../../modules/rpg/board/engine.js';
import { fightKind, toAction } from '../../../../modules/rpg/board/interaction.js';
import { carriedFrom } from '../../../../modules/rpg/board/members.js';
import { hashJson } from '../../../../core/replay.js';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { ASTRA_ID, RULES, fxHost, stepOf } from './interaction.helpers.js';

const stackOf = (state, def) => Object.values(state.domains.inventory.stacks).find(item => item.def === def).id;
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

test('next: the carried setup moves the offset on, carries the order and member bars, and drops the opening-only keys', async () => {
    const restore = seedCrypto(7), host = await fxHost();
    try {
        const setup = opened(host), slot = slotOf(host);
        const played = playBoard(host.head(), setup, [{ actions: [{ who: 'Astra', kind: 'attack', target: slot }] }]);
        assert.equal(played.result.stop, 'open', 'the fight goes on');
        const first = { ...setup, witness: { offset: 0, hash: 'x' }, opening: true, approach: [{ x: 1 }], drop: { y: 1 }, opened: [1] };
        const next = fightKind.next(first, played.result, host.head());
        assert.equal(next.offset, setup.offset + played.result.rounds.length, 'the offset moves on by the rounds played');
        assert.equal(next.offset, 1);
        assert.deepEqual(next.order, played.result.order ?? [], 'the order carries');
        assert.deepEqual(next.carriedMembers, carriedFrom(played.result.members), 'the member bars carry');
        for (const key of ['witness', 'opening', 'approach', 'drop', 'opened']) assert.equal(Object.hasOwn(next, key), false, `${key} is dropped`);
        const { offset: _o, order: _r, carriedMembers: _c, ...kept } = next, { offset: _o2, order: _r2, carriedMembers: _c2, ...before } = setup;
        assert.deepEqual(kept, before, 'everything else of the setup (id, groups, seed, rules, flags) is as it was');
    } finally { host.close(); restore(); }
});

test('the witness moves when the sheet or a consumable the steps name does, and not otherwise; the actors are the standing party', async () => {
    const restore = seedCrypto(7), host = await fxHost();
    try {
        const setup = opened(host), now = hashJson(fightKind.witness(host.head(), setup));
        assert.equal(hashJson(fightKind.witness(host.head(), setup)), now, 'the same state gives the same witness');
        assert.deepEqual(fightKind.actors(host.head(), setup), [{ id: ASTRA_ID, name: 'Astra', party: true }]);
        const bag = host.bus.run('inventory.consume', { def: 'story/healing-draught', qty: 1 }, { cause: 'system' });
        assert.equal(bag.ok, true, bag.message);
        const stack = stackOf(host.head(), 'story/healing-draught'), named = [stepOf({ who: 'Astra', kind: 'item', stack, target: 'Astra' })], plainStep = [stepOf({ who: 'Astra', kind: 'attack', target: 1 })];
        const usedNow = hashJson(fightKind.witness(host.head(), setup, named));
        assert.notEqual(usedNow, now, 'steps naming an item add that stack');
        assert.notEqual(hashJson(fightKind.witness(bag.state, setup, named)), usedNow, 'a drink gone from the bag moves a fight that used it');
        assert.equal(hashJson(fightKind.witness(bag.state, setup)), now, 'without steps the bag does not move it');
        assert.equal(hashJson(fightKind.witness(bag.state, setup, plainStep)), hashJson(fightKind.witness(host.head(), setup, plainStep)), 'steps naming no item leave the bag out');
        assert.equal(hashJson(fightKind.witness(host.head(), setup, plainStep)), now, 'and add nothing');
        const hurt = host.bus.run('rpg.board.hurts', { hurts: [{ module: 'pack.chat/foes', field: 'hurt1', to: 2 }] }, { cause: 'system' });
        assert.notEqual(hashJson(fightKind.witness(hurt.state, setup)), now, 'a foe\'s bar moved moves it');
        const setupB = { ...setup, seed: setup.seed + 1 };
        assert.equal(hashJson(fightKind.witness(host.head(), setupB)), now, 'the seed is not part of what the fight read');
    } finally { host.close(); restore(); }
});
