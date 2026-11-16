// A settled 4-exchange, four-member against six-foe fight adds at most 24 KB, payload and retained result together.

import test from 'node:test';
import assert from 'node:assert/strict';
import { hashJson } from '../../../core/replay.js';
import { settleInteraction } from '../../../core/interaction/settle.js';

const LIMIT = 24 * 1024;
const members = ['Astra', 'Ren', 'Mira', 'Tavi'].map((name, index) => ({
    id: `pc-${index + 1}`, name, party: true, player: index === 0,
    health: 5, mana: 3, stamina: 4, level: 4, str: 12, vit: 11, agi: 10, dex: 10, int: 9, luk: 8, cha: 7,
}));
const foes = Array.from({ length: 6 }, (_, index) => ({
    slot: index + 1, name: `Night Goblin ${index + 1}`, level: 3, health: 4, hurt: index % 2, tags: ['goblin', 'night', 'ambush'],
}));
const rules = {
    pace: 'normal', formula: 'standard', lethality: 'normal', levels: 1, gear: 1, practice: 'perUse',
    flags: { ambush: 1, flank: 1, morale: 1, soak: 1, aoe: 1, foesClear: 0 },
    weapons: { Slash: { stat: 'STR', power: 2, tags: ['edge', 'close'] }, Guard: { stat: 'VIT', power: 1, tags: ['stance'] } },
};
const setup = {
    id: 'fight-size-1', seed: 0x12345678, offset: 0, rules, members, foes, bars: 2,
    gear: { Astra: { weapon: 'iron sword', armour: 'leather', shield: null, cloak: 'wool' }, Ren: { weapon: 'short bow', armour: 'leather' } },
};

const stepFor = () => ({ inputs: members.map((member, index) => ({
    actor: member.id, choice: index === 1 ? 'guard' : 'skill',
    args: { skill: index === 1 ? 'Guard' : 'Slash', target: (index % 6) + 1, stance: 'careful', intent: 'Hold the line while the others close.' },
})) });
const steps = [stepFor(), stepFor(), stepFor(), stepFor()];

function bigResult(seed) {
    const rolls = Array.from({ length: 4 }, (_, exchange) => members.map((member, at) => ({
        actor: member.id, at, exchange, total: 12 + ((seed + exchange + at) % 9), target: 13, hit: (seed + exchange + at) % 3 !== 0,
    })));
    return {
        v: 1, stop: 'won', seed, flow: 2, fix: 3,
        opening: members.map((member, index) => ({ who: member.id, order: index, line: `${member.name} steps into the night fog, blade low and shield high.` })),
        rounds: Array.from({ length: 4 }, (_, exchange) => ({
            n: exchange + 1,
            order: members.map(member => member.id),
            lines: foes.map(foe => ({ foe: foe.slot, name: foe.name, text: `${foe.name} circles the party, scrapes a claw on stone, and waits for an opening in the line.` })),
            acts: rolls[exchange],
        })),
        hurts: members.map((member, index) => ({ id: member.id, field: index % 2 ? 'stamina' : 'health', was: 4, now: 3 })),
        checks: foes.map(foe => ({ foe: foe.slot, name: foe.name, at: 0, total: 15, dc: 13, ok: true })),
        items: [{ stack: 'it_ration1', by: 'pc-1', name: 'Trail ration', qty: 1 }],
        wear: [{ id: 'gear:pc-1:weapon', name: 'iron sword', from: 'scuffed', to: 'worn', text: 'The iron sword takes a deep notch along the edge.' }],
        awards: members.map(member => ({ who: member.id, module: member.id, xp: 35, held: false })),
    };
}

function fixture() {
    const kind = {
        version: 1, title: 'Fight', feature: null, limits: {}, changes: ['fight.hurt', 'fight.clear', 'inventory.consume'],
        ready: () => true,
        witness: now => ({ sheet: now.sheet, gear: now.gear, place: now.place }),
        validate: () => null,
        actors: () => members,
        play: (now, opened, played, diceAt) => ({ view: { exchanges: played.length }, result: { seed: opened.seed, exchanges: played.length }, stop: 'open' }),
        settle: (now, opened, played) => ({
            result: bigResult(opened.seed), stop: 'won',
            changes: [
                { type: 'fight.hurt', payload: { hurts: members.map(member => ({ id: member.id, field: 'health', now: 3 })) } },
                { type: 'fight.clear', payload: { groups: foes.map(foe => foe.slot) } },
                { type: 'inventory.consume', payload: { stack: 'it_ration1', qty: 1 } },
            ],
        }),
        note: result => ['Astra and the party hold the line through four exchanges.', 'Six night goblins fall or flee into the fog.'],
    };
    const id = 'reply-size:0:story-block/fight', anchor = 'reply-size';
    const payload = {
        v: 1, kindId: 'story-block/fight', version: 1,
        key: `i:${encodeURIComponent(id)}:${encodeURIComponent(anchor)}:0`,
        id, anchor, seed: 0x12345678, offset: 0, setup, steps,
        witness: { offset: 0, hash: hashJson(kind.witness({ sheet: members, gear: setup.gear, place: 'Moonfall road' }, setup)) },
        player: 'pc-1', policy: { choosers: 'party', party: true },
    };
    const ctx = {
        module: 'story-block', cause: 'system', caller: null, epoch: 'ep_k3f9a2qz', hash: hashJson,
        source: { sid: 'sr_abcdefgh', swipeKey: 'sw_abcdefgh', evidence: 'ev_abcdefgh', ordinal: 0 },
        reply: { sid: 'sw_reply2' },
        fail(code, message) { const error = new Error(message); error.code = code; throw error; },
        claim: () => true,
        call: type => ({ summary: `${type} applied.` }),
        replayGuard: () => {},
    };
    return { kind, payload, ctx, state: { sheet: members, gear: setup.gear, place: 'Moonfall road' } };
}

test('the payload, the retained result and the whole receipt stay under 24 KB for a 4-exchange 4 v 6 fight', () => {
    const { kind, payload, ctx, state } = fixture();
    const receipt = settleInteraction(ctx, payload, kind, { state });
    const payloadBytes = Buffer.byteLength(JSON.stringify(payload));
    const resultBytes = Buffer.byteLength(JSON.stringify(receipt.data.v2.result));
    const receiptBytes = Buffer.byteLength(JSON.stringify(receipt));
    assert.equal(receipt.data.v2.result.rounds.length, 4);
    assert.equal(receipt.data.v2.result.rounds[0].lines.length, 6);
    assert.equal(receipt.data.v2.result.awards.length, 4);
    assert.ok(payloadBytes + resultBytes <= LIMIT, `payload ${payloadBytes} + result ${resultBytes} exceeded ${LIMIT}`);
    assert.ok(receiptBytes <= LIMIT, `receipt ${receiptBytes} exceeded ${LIMIT}`);
});
