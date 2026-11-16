// What the inventory commands cap at cause `system` (a settle's changes run as `system`), pinned on the REAL handlers through the REAL bus.
// A kind must not rely on a cap this file does not show (INTERACTION-PLAN §1.3 step 6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { growKind, hostWith, settleOn, settlePayload } from './helpers/core-kind.js';

const run = (host, type, payload, cause = 'system') => host.bus.command(type, payload, { cause });
const stacks = host => Object.values(host.head().domains.inventory?.stacks ?? {});
const SWORD = n => ({ name: n, kind: 'equipment', stack: false, slot: 'hand' });

test('grant: a quantity must be a whole number of at least 1; a stacking item has NO upper cap at system', async () => {
    const host = await createHost();
    try {
        for (const qty of [0, -1, 1.5, '2']) {
            const before = host.head();
            const out = run(host, 'inventory.grant', { name: 'Rope', qty });
            assert.equal(out.ok, false, `qty ${JSON.stringify(qty)}`);
            assert.equal(out.code, 'INVALID');
            assert.equal(host.head(), before, 'nothing kept');
        }
        const big = run(host, 'inventory.grant', { name: 'Rope', qty: 1e9 });
        assert.equal(big.ok, true, 'no cap on a stacking item: the kind\'s own payload must bound it');
        assert.equal(stacks(host)[0].qty, 1e9);
    } finally { host.close(); }
});

test('grant: a non-stacking item is capped at 50 a call (MAX_UNSTACKED)', async () => {
    const host = await createHost();
    try {
        const over = run(host, 'inventory.grant', { def: SWORD('Sword'), qty: 51 });
        assert.equal(over.ok, false);
        assert.equal(over.code, 'INVALID');
        assert.match(over.message, /at most 50/);
        assert.equal(stacks(host).length, 0);
        const ok = run(host, 'inventory.grant', { def: SWORD('Sword'), qty: 50 });
        assert.equal(ok.ok, true, ok.message);
        assert.equal(stacks(host).length, 50);
    } finally { host.close(); }
});

test('grant: the reader-facing refusal stays for ui, so a settle is the system caller that is allowed', async () => {
    const host = await createHost();
    try {
        const out = run(host, 'inventory.grant', { name: 'Rope' }, 'ui');
        assert.equal(out.ok, false);
        assert.equal(out.code, 'REFUSED');
        assert.equal(run(host, 'inventory.grant', { name: 'Rope' }, 'system').ok, true);
    } finally { host.close(); }
});

test('consume and drop: more than the stack holds is NOT_ENOUGH and keeps nothing; a missing stack is NOT_FOUND', async () => {
    const host = await createHost();
    try {
        assert.equal(run(host, 'inventory.grant', { name: 'Rope', qty: 3 }).ok, true);
        const [stack] = stacks(host);
        const before = host.head();
        for (const type of ['inventory.consume', 'inventory.drop']) {
            const out = run(host, type, { stack: stack.id, qty: 4 });
            assert.equal(out.ok, false, type);
            assert.equal(out.code, 'NOT_ENOUGH', type);
            assert.equal(host.head(), before, `${type}: nothing kept`);
        }
        assert.equal(run(host, 'inventory.drop', { stack: 'it_nope0000' }).code, 'NOT_FOUND');
        assert.equal(run(host, 'inventory.consume', { stack: stack.id, qty: 3 }).ok, true);
        assert.equal(stacks(host).length, 0, 'using the last one up removes the stack');
    } finally { host.close(); }
});

test('a settle that hits a cap fails whole: the earlier change is not kept and no claim is made', async () => {
    const kind = growKind({
        settle: () => ({ result: { stop: 'done' }, stop: 'done', changes: [
            { type: 'inventory.grant', payload: { name: 'Rope', qty: 2 } },
            { type: 'inventory.grant', payload: { def: SWORD('Sword'), qty: 51 } },
        ] }),
    });
    const host = await hostWith(kind);
    try {
        const before = host.head();
        const out = settleOn(host, settlePayload(host, kind));
        assert.equal(out.ok, false);
        assert.equal(out.code, 'INVALID');
        assert.equal(host.head(), before, 'atomic: nothing kept, not even the first grant or the claim');
    } finally { host.close(); }
});

test('a settle may only run the commands its kind lists, even a real one', async () => {
    const kind = growKind({ settle: () => ({ result: { stop: 'done' }, stop: 'done', changes: [{ type: 'inventory.drop', payload: { stack: 'x' } }] }) });
    const host = await hostWith(kind);
    try {
        const before = host.head();
        const out = settleOn(host, settlePayload(host, kind));
        assert.equal(out.ok, false);
        assert.equal(host.head(), before);
    } finally { host.close(); }
});
