// A v1 win shows in the reply's lines (XP, practice, the exchanges and who fought whom) and in the battle log (rounds, rows with the HP they moved), from the settle's own record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../qa/helpers/seeded.js';
import { openFight, stage, step, v1Host } from './v1.helpers.js';
import { exchangesOf } from '../../../../src/v2/lean-rpg/view/changes-lines-parts/rolls.js';
import { v1PaidLines } from '../../../../src/v2/lean-rpg/view/changes-lines-parts/v1-paid.js';
import { readResolveV1 } from '../../../../src/v2/lean-rpg/view/battle-log/read-v1.js';
import { resolveOf } from '../../../../src/v2/lean-rpg/view/battle-log.js';

test('the lines and the battle log read a v1 win meaningfully', async () => {
    const restore = seedCrypto(5);
    const { host } = await v1Host({ hero: { str: 30 }, count: 1, level: 5, tier: 'standard' });
    try {
        assert.equal(openFight(host).ok, true);
        for (let at = 0; at < 14; at += 1) stage(host, step('skill'));
        await host.send('Go.', 'Done.');
        const entry = host.store.receipts().filter(item => item.index === 2).find(item => item.receipt.type === 'interaction.settle');
        const record = { receipts: [entry.receipt] }, result = entry.receipt.data.v2.result;
        assert.equal(result.stop, 'won');
        const pairs = exchangesOf(record);
        assert.equal(pairs.exchanges, result.rounds.length);
        assert.deepEqual(pairs.pairs, ['Astra vs Rats']);
        const lines = v1PaidLines(record).map(line => line.text);
        assert.equal(lines[0], 'Astra +15 XP (fight won)');
        assert.match(lines[1], /^Astra's Cut \+\d+ practice \(rolled\)$/);
        assert.deepEqual(v1PaidLines({ receipts: [{ ...entry.receipt, id: 'x' }] }, [{ receipts: ['x'] }]), [], 'a settle the replay skipped is not told');
        const log = resolveOf(record);
        assert.equal(log.stop, 'won');
        assert.equal(log.board, true);
        assert.equal(log.rounds.length, result.rounds.length);
        const first = log.rounds[0].lines[0];
        assert.equal(first.who, 'Astra');
        assert.equal(first.skill, 'Cut');
        assert.ok(log.rounds.flatMap(round => round.lines).some(row => row.arrows.some(arrow => /^Rats HP \d+ → 0$/.test(arrow))), 'a hit tells the HP it moved');
        assert.ok(log.order.length > 0, 'the turn order is told');
        assert.equal(readResolveV1({ rounds: [] }), null);
    } finally { host.close(); restore(); }
});
