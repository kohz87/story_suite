// The core's `interaction.settle` on the real bus and real handlers: refused to any caller, settles into the real inventory,
// and its guard (dispatched by the core's replayGuard on predicate.kind === 'interaction') answers on the state before the block.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuards } from '../../../src/v2/commands/guards.js';
import { KIND_ID, growKind, hostWith, settleOn, settlePayload } from './helpers/core-kind.js';

const guardCheck = host => createGuards({ registry: host.registry, findQuery: name => host.registry.query?.(name) ?? null }).replayGuardCheck;

function settled(host, kind, payload) {
    const before = host.head();
    const result = settleOn(host, payload);
    assert.equal(result.ok, true, result.message);
    const v2 = result.receipt.data.v2;
    return { before, result, info: { guard: v2.guard, source: v2.source, block: null, operation: null, recorded: payload, payload: null } };
}

test('it is a prelude, internal command of the core, so no button, module or story line can run it', async () => {
    const host = await hostWith(growKind());
    try {
        assert.equal(host.registry.isInternal('interaction.settle'), true);
        assert.equal(host.registry.isPrelude('interaction.settle'), true);
        assert.equal(host.registry.commandOwner('interaction.settle'), 'story-block');
        const payload = settlePayload(host, growKind());
        for (const cause of ['ui', 'story']) {
            const out = host.bus.command('interaction.settle', payload, { cause });
            assert.equal(out.ok, false, cause);
            assert.equal(out.code, 'REFUSED', cause);
        }
        assert.equal(Object.keys(host.head().domains.inventory?.stacks ?? {}).length, 0);
    } finally { host.close(); }
});

test('a settle runs the kind\'s change on the real inventory handler and records the interaction guard', async () => {
    const kind = growKind();
    const host = await hostWith(kind);
    try {
        const { result } = settled(host, kind, settlePayload(host, kind));
        const stacks = Object.values(host.head().domains.inventory.stacks);
        assert.equal(stacks.length, 1);
        assert.equal(stacks[0].qty, 2);
        assert.equal(result.receipt.guarded, true);
        assert.equal(result.receipt.data.v2.guard.predicate.kind, 'interaction');
        assert.equal(result.receipt.data.interaction.changes[0].type, 'inventory.grant');
    } finally { host.close(); }
});

test('the core guard dispatches interaction predicates: ok on the state before the block, CHANGED when the witness moved, NOT_READY when the kind is not ready or gone', async () => {
    const live = { ready: true };
    const kind = growKind({ ready: () => live.ready });
    const host = await hostWith(kind);
    try {
        const { before, info } = settled(host, kind, settlePayload(host, kind));
        const check = guardCheck(host);
        assert.deepEqual(check(before, info), { ok: true });

        const moved = structuredClone(before);
        moved.domains.inventory = { ...(moved.domains.inventory ?? {}), stacks: { it_x: { id: 'it_x' } } };
        const changed = check(moved, info);
        assert.equal(changed.ok, false);
        assert.match(changed.reason, /changed/i);

        live.ready = false;
        const notReady = check(before, info);
        assert.equal(notReady.ok, false);
        assert.match(notReady.reason, /not ready/i);

        live.ready = true;
        const forged = structuredClone(info);
        forged.guard.predicate.kind = 'nope';
        assert.equal(check(before, forged).ok, false, 'another kind of predicate is not answered as an interaction');
    } finally { host.close(); }
});

test('with the module leaving the guard is NOT_READY, not an error, and a host without the kind answers the same', async () => {
    const kind = growKind();
    const host = await hostWith(kind);
    let info, before;
    try { ({ before, info } = settled(host, kind, settlePayload(host, kind))); } finally { host.close(); }
    const bare = await hostWith(growKind(), { id: 'other' });
    try {
        const answer = guardCheck(bare)(before, info);
        assert.equal(answer.ok, false);
        assert.match(answer.reason, new RegExp(`not ready`, 'i'));
        assert.equal(KIND_ID, 'test/probe');
    } finally { bare.close(); }
});
