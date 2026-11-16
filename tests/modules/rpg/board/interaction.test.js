// The fight kind over today's engine: the steps are the pre-port exchanges, play and settle agree, and the settle writes what the pre-port commit wrote.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fightKind, toActions, toExchanges } from '../../../../modules/rpg/board/interaction.js';
import { fightSeed } from '../../../../modules/rpg/board/dice.js';
import { boardWitness, playBoard } from '../../../../modules/rpg/board/engine.js';
import { boardSession, discardBoard, openBoard, stageExchange } from '../../../core/helpers/board-port.js';
import { planGear } from '../../../../modules/rpg/gear.js';
import { readSheet } from '../../../../modules/rpg/read.js';
import { hashJson } from '../../../../core/replay.js';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { stackOf } from './commit.helpers.js';
import { ASTRA_ID, FX_KIND, RULES, fxHost, stepOf } from './interaction.helpers.js';

// (a fight against a counted group plays on member bars: the first slot the engine accepts is the first standing foe)
const slotOf = host => {
    const sheet = { seed: 1, offset: 0, rules: RULES, members: 1, aoe: 1, areaAll: 1, foesSix: 1, foesClear: 1, fightLen: 1 };
    for (let slot = 1; slot < 40; slot += 1) if (!playBoard(host.head(), sheet, [{ actions: [{ who: 'Astra', kind: 'attack', target: slot }] }]).error) return slot;
    throw new Error('no foe stands');
};
const attack = host => ({ who: 'Astra', kind: 'attack', target: slotOf(host) });
const DRAUGHT = host => ({ who: 'Astra', kind: 'item', stack: stackOf(host, 'Healing Draught').id, target: 'Astra' });
const anchorOf = host => host.store.carrierSid(host.store.headIndex());
const FLEE = { who: 'Astra', kind: 'flee' };

// the fight on the chat metadata (what the reader's view stages, through the port) and the kind's own opening for the same fight
function both(host, rounds) {
    const meta = host.ctx.chatMetadata, sid = anchorOf(host), state = host.head();
    const old = openBoard(meta, state, { sid, rules: RULES });
    assert.equal(old.error, undefined, old.error);
    for (const actions of rounds) { const staged = stageExchange(meta, state, actions); assert.equal(staged.error, undefined, staged.error); }
    // (a discarded fight counts as an attempt, and the next one rolls its own seed)
    const attempt = meta.storySuiteInteraction.open.attempt;
    const opened = fightKind.open(state, { anchor: sid, seed: fightSeed(sid, attempt), attempt, args: { rules: RULES } });
    assert.equal(opened.error, undefined, opened.error);
    return { session: boardSession(meta), stored: meta.storySuiteInteraction.open, setup: opened.setup, state, sid, steps: rounds.map(actions => stepOf(...actions)) };
}

test('toExchanges gives the engine the exchanges that were staged, and the stored setup is the kind\'s own opening', async () => {
    const restore = seedCrypto(11), host = await fxHost();
    try {
        for (const rounds of [[[attack(host)]], [[DRAUGHT(host)], [attack(host)]], [[attack(host)], [FLEE]]]) {
            const { session, stored, setup, steps, state } = both(host, rounds);
            assert.deepEqual(toExchanges(steps), rounds.map(actions => ({ actions })), 'exchanges deep-equal the staged actions');
            assert.deepEqual(toExchanges(stored.steps), toExchanges(steps), 'the stored steps are the same exchanges');
            assert.deepEqual(session.exchanges.map(({ actions }) => ({ actions })), toExchanges(steps));
            assert.deepEqual(toActions(steps[0]), rounds[0]);
            assert.deepEqual(stored.setup, setup, 'the stored setup is what the kind opened');
            assert.deepEqual(stored.witness, { offset: setup.offset, hash: stored.witness.hash }, 'the witness is top level, not in the setup');
            assert.equal(Object.hasOwn(setup, 'witness'), false);
            assert.deepEqual(session.groups, setup.groups);
            assert.deepEqual(fightKind.play(state, setup, steps).view.result, playBoard(state, setup, toExchanges(steps)).result, 'play = the engine');
            assert.equal(discardBoard(host.ctx.chatMetadata), true);
        }
    } finally { host.close(); restore(); }
});

test('play and settle give the same result, and the settle is atomic and writes what the pre-port commit wrote', async () => {
    const restore = seedCrypto(11), host = await fxHost();
    try {
        const { setup, steps, state } = both(host, [[DRAUGHT(host)], [attack(host)], [attack(host)]]);
        assert.equal(discardBoard(host.ctx.chatMetadata), true);
        const played = fightKind.play(state, setup, steps), settled = fightKind.settle(state, setup, steps);
        assert.deepEqual(settled.result, played.result, 'play and settle agree');
        assert.equal(settled.stop, played.stop);
        for (const call of settled.changes) assert.ok(fightKind.changes.includes(call.type), `${call.type} is on the kind's list`);
        // the same fight through the pre-port commit
        // the same fight through the pre-port commit and through the port's settle, from the same state
        sameRun(fight(host, [[DRAUGHT(host)], [attack(host)], [attack(host)]]));
    } finally { host.close(); restore(); }
});

// a fight played to its end on both paths, from the same start: the pre-port commit (the old `rpg.resolve` board record, still read for old chats) and the port's settle;
// the port's settle must leave the same sheet, bag, note and record
const fight = (host, rounds, args = {}) => {
    const sid = anchorOf(host), state = host.head();
    const opened = fightKind.open(state, { anchor: sid, seed: fightSeed(sid, 0), args: { rules: RULES, ...args } });
    assert.equal(opened.error, undefined, opened.error);
    const steps = rounds.map(actions => stepOf(...actions)), setup = opened.setup, { id, groups, practice, ...engineSetup } = setup;
    // (the pre-port record: the witness sat inside the setup, and the record held the exchanges themselves)
    const board = { id, anchor: sid, groups, setup: { ...engineSetup, witness: { offset: setup.offset, hash: boardWitness(state, setup) } }, exchanges: toExchanges(steps) };
    const oldRun = host.bus.run('rpg.resolve', { key: 'b:x', board, practice }, { cause: 'system' });
    const payload = { v: 1, kindId: FX_KIND, version: 1, key: `i:${encodeURIComponent('a:0')}:a:0`, id: 'a:0', anchor: 'a', seed: setup.seed, offset: 0, setup, steps,
        witness: { offset: 0, hash: hashJson(fightKind.witness(state, setup)) }, player: ASTRA_ID, policy: { choosers: 'party', party: true } };
    return { oldRun, run: host.bus.run('interaction.settle', payload, { cause: 'system' }), setup, steps, state };
};
const sameRun = ({ oldRun, run }) => {
    assert.equal(oldRun.ok, true, oldRun.message);
    assert.equal(run.ok, true, run.message);
    const { key: _k, board: _b, ...oldRest } = oldRun.receipt.data.v2.result, { key: _k2, board: _b2, ...newRest } = run.receipt.data.v2.result;
    assert.deepEqual(newRest, oldRest, 'the same record');
    assert.equal(run.receipt.summary, oldRun.receipt.summary, 'the same note');
    assert.deepEqual(run.state.domains.dataModules, oldRun.state.domains.dataModules, 'the same sheet');
    // (a wear's receipt id is random; what each wear took off the piece is not)
    const flat = inventory => JSON.parse(JSON.stringify(inventory).replace(/rc_[0-9a-z]+#/gu, 'rc#'));
    assert.deepEqual(flat(run.state.domains.inventory), flat(oldRun.state.domains.inventory), 'the same bag and gear wear');
};

test('a worn weapon wears the same way: the settle calls gear.wear for each event the record tells', async () => {
    const restore = seedCrypto(3), host = await fxHost({ gear: true });
    try {
        const state = host.head(), query = (name, args) => host.sdk.query(name, args);
        const gear = planGear(readSheet(state), query), weapon = query('inventory.gear', { owner: 'party' }).slots.weapon;
        let seen = 0;
        for (let seed = 1; seed < 40 && !seen; seed += 1) {
            const again = seedCrypto(seed), h = await fxHost({ gear: true });
            try {
                const slot = slotOf(h), rounds = [[{ who: 'Astra', kind: 'attack', target: slot }], [{ who: 'Astra', kind: 'attack', target: slot }], [{ who: 'Astra', kind: 'attack', target: slot }]];
                const ran = fight(h, rounds, { gear, weapons: { astra: weapon } });
                sameRun(ran);
                seen += ran.run.receipt.data.v2.result.wear?.length ?? 0;
                if (seen) assert.equal(ran.run.receipt.data.interaction.changes.filter(change => change.type === 'gear.wear').length, seen, 'one gear.wear call per event');
            } finally { h.close(); again(); }
        }
        assert.ok(seen > 0, 'a seed wore a piece');
    } finally { host.close(); restore(); }
});

test('a fight played to its end clears its groups, and the port leaves the same sheet as the pre-port commit', async () => {
    const restore = seedCrypto(5), host = await fxHost({ count: 1 });
    try {
        const rounds = [], slot = slotOf(host), meta = host.ctx.chatMetadata;
        assert.equal(openBoard(meta, host.head(), { sid: anchorOf(host), rules: RULES }).error, undefined);
        for (let at = 0; at < 60; at += 1) {
            const actions = [{ who: 'Astra', kind: 'attack', target: slot }], staged = stageExchange(meta, host.head(), actions);
            if (staged.error) break;
            rounds.push(actions);
            if (staged.preview.result.stop !== 'open') break;
        }
        assert.equal(discardBoard(meta), true);
        assert.ok(rounds.length > 0 && rounds.length < 60, 'the fight ended');
        const ran = fight(host, rounds);
        sameRun(ran);
        assert.ok(ran.run.receipt.data.v2.result.cleared?.length, 'the ended fight cleared its group');
        assert.deepEqual(ran.run.receipt.data.interaction.changes.map(change => change.type).slice(-2), ['rpg.board.hurts', 'rpg.board.clearFoes']);
    } finally { host.close(); restore(); }
});
