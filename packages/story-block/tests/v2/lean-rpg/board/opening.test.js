// The fight kind's opening (a pre-check fight): the same roll the old opening made, through the port's settle. With the same seed the record (opened groups,
// approach checks, ambush, dice) equals the old `rpg.resolve` opening's, the note equals its cue, and the Foes block ends the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openingPayload } from '../../../../src/v2/lean-rpg/board/precheck-run.js';
import { cueOfResult } from '../../../../src/v2/lean-rpg/cue.js';
import { readSheet } from '../../../../src/v2/lean-rpg/read.js';
import { fightKind } from '../../../../src/v2/lean-rpg/board/interaction.js';
import { FX_KIND, RULES, fxHost } from './interaction.helpers.js';

const SEED = 777;
const OPEN = [{ name: 'Marsh Wraith', count: 2, level: 3 }];
const anchorOf = host => host.store.carrierSid(host.store.headIndex());

function openingOf(host, open, key) {
    const anchor = anchorOf(host), old = openingPayload({ groups: open, key, rules: RULES, anchor, values: {} });
    const made = fightKind.open(host.head(), { anchor, seed: 1, args: { opening: { groups: open, key, rules: RULES, practice: old.practice, stale: [] } } });
    assert.equal(made.error, undefined, made.error);
    const id = `${anchor}:0:${FX_KIND}#open`;
    return { old, payload: { v: 1, kindId: FX_KIND, version: 1, key: `i:${encodeURIComponent(id)}:${encodeURIComponent(anchor)}:0`, id, anchor, seed: SEED, offset: 0, setup: made.setup, steps: [], witness: null, opening: true } };
}

test('the opening settles to the old opening\'s record, note and Foes block', async () => {
    const host = await fxHost();
    try {
        const { old, payload } = openingOf(host, OPEN, '3-abc');
        const before = JSON.stringify(host.head().domains.dataModules);
        const was = host.bus.run('rpg.resolve', old, { cause: 'system', seed: SEED });
        assert.equal(was.ok, true, was.message);
        const now = host.bus.run('interaction.settle', payload, { cause: 'system', seed: SEED });
        assert.equal(now.ok, true, now.message);
        const mine = now.receipt.data.v2.result;
        assert.deepEqual(mine.opened, was.receipt.data.v2.result.opened, 'the same groups opened');
        assert.ok(mine.opened.length === 1, 'one group opened');
        const { key: _k, ...a } = mine, { key: _o, ...b } = was.receipt.data.v2.result;
        assert.deepEqual(a, b, 'the record is the old opening\'s, field for field');
        assert.equal(now.receipt.summary, cueOfResult(was.receipt.data.v2.result, was.receipt.data.v2.shape), 'the note is the old cue');
        assert.deepEqual(readSheet(now.state).foes, readSheet(was.state).foes, 'the Foes block ends the same');
        assert.equal(JSON.stringify(host.head().domains.dataModules), before, 'the live head is untouched by a preview');
    } finally { host.close(); }
});

test('an opening with no groups is refused; a changed sheet changes what the opening read', async () => {
    const host = await fxHost();
    try {
        assert.ok(fightKind.open(host.head(), { anchor: 'a', seed: 1, args: { opening: { groups: [], key: 'k', rules: RULES } } }).error);
        const { payload } = openingOf(host, OPEN, '3-abc');
        assert.notDeepEqual(fightKind.witness(host.head(), payload.setup), fightKind.witness({ ...host.head(), domains: { ...host.head().domains, dataModules: { ...host.head().domains.dataModules, instances: {} } } }, payload.setup));
    } finally { host.close(); }
});
