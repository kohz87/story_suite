// Soak bug 5: the default currency follows the game pack (the Ersveil pair says copper), then the reader's setting wins, and gold is only the last fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost } from '../../../../testkit/index.js';

const read = name => readFileSync(new URL(`../../../../examples/packs/${name}/pack.json`, import.meta.url), 'utf8');
const currency = host => host.sdk.query('inventory.currency');
const said = line => `Told.\n<Changes>\n${line}\n</Changes>`;

async function ersveil(t, settings = {}) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings });
    t.after(() => host.close());
    for (const name of ['ersveil', 'ersveil-game']) assert.equal((await host.packs.packs.install(read(name), { origin: 'pack.json' })).ok, true);
    return host;
}

test('with the Ersveil pair selected and fresh settings the purse says copper, not gold', async t => {
    const host = await ersveil(t);
    assert.equal(currency(host).name, 'copper');
    await host.send('Hi.', said('+ coin 20 | from: Hedda Vane'));
    assert.equal(host.head().domains.inventory.wallets.party.coin, 20);
    assert.equal(currency(host).name, 'copper', 'after the first reply the chat frame keeps it');
});

test('with no game pack the fallback is gold; a currency the reader set wins over the pack', async t => {
    t.mock.method(console, 'warn', () => {});
    const bare = await createHost();
    t.after(() => bare.close());
    assert.equal(currency(bare).name, 'gold');
    const own = await ersveil(t, { modules: { 'story-block': { currency: 'ducat' } } });
    assert.equal(currency(own).name, 'ducat');
});
