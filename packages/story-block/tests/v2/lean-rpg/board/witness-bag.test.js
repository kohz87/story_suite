// The fight's replay witness holds the stacks its item actions named, and no other part of the bag: a middle delete of a reply that gave an
// unrelated consumable keeps a fight that used no item; one that drank the granted item is taken back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../qa/helpers/seeded.js';
import { potionBoard, potionHost, stackOf } from './commit.helpers.js';

const GIVE = 'Found.\n<Changes>\n+ item Elixir | kind: consumable | rarity: epic | qty: 2\n</Changes>';
const fights = host => host.store.receipts().filter(entry => entry.receipt.type === 'interaction.settle' && entry.receipt.replan?.payload?.opening !== true);
const takenBack = host => host.turn.problems().filter(item => item.code === 'INTERACTION_TAKEN_BACK').length;
const indexOf = (host, text) => host.ctx.chat.findIndex(message => String(message.mes).startsWith(text));

test('a fight with no item action survives deleting an earlier reply that gave an unrelated consumable', async () => {
    const restore = seedCrypto(11), host = await potionHost();
    try {
        await host.send('Look.', GIVE);
        potionBoard(host, [{ who: 'Astra', kind: 'attack', target: 11 }]);
        await host.send('I strike.', 'She strikes.');
        assert.equal(fights(host).length, 1, 'the fight settled');
        const at = indexOf(host, 'Found.');
        await host.st.deleteMessage(at);
        await host.st.deleteMessage(at - 1);
        assert.equal(stackOf(host, 'Elixir'), undefined, 'the Elixir went with its reply');
        assert.equal(fights(host).length, 1, 'the fight stays');
        assert.equal(takenBack(host), 0);
    } finally { host.close(); restore(); }
});

test('a fight that drank the granted item is taken back when the reply that gave it is deleted', async () => {
    const restore = seedCrypto(11), host = await potionHost();
    try {
        await host.send('Look.', GIVE);
        potionBoard(host, [{ who: 'Astra', kind: 'item', stack: stackOf(host, 'Elixir').id, target: 'Astra' }]);
        await host.send('I drink.', 'She drinks.');
        assert.equal(fights(host).length, 1, 'the fight settled');
        const at = indexOf(host, 'Found.');
        await host.st.deleteMessage(at);
        await host.st.deleteMessage(at - 1);
        assert.equal(fights(host).length, 0, 'the fight goes with the grant');
        assert.ok(takenBack(host) > 0, 'and the reader is told');
    } finally { host.close(); restore(); }
});

const reread = async (host, index, text) => { host.ctx.chat[index].mes = text; return host.sdk.reread(index); };

test('an edited Re-read of the granting reply: shrunk (the Elixir line dropped) takes back only the fight that drank it; grown (another consumable added) takes back none', async () => {
    for (const drink of [false, true]) {
        const restore = seedCrypto(11), host = await potionHost();
        try {
            await host.send('Look.', GIVE);
            const stack = stackOf(host, 'Elixir').id;
            potionBoard(host, [drink ? { who: 'Astra', kind: 'item', stack, target: 'Astra' } : { who: 'Astra', kind: 'attack', target: 11 }]);
            await host.send('I act.', 'She acts.');
            assert.equal(fights(host).length, 1);
            const at = indexOf(host, 'Found.');
            const grown = await reread(host, at, `${GIVE.replace('</Changes>', '+ item Salts | kind: consumable | rarity: common | qty: 1\n</Changes>')}`);
            assert.equal(grown.ok, true, grown.message);
            assert.equal(fights(host).length, 1, 'a grown Re-read keeps the fight');
            const shrunk = await reread(host, at, 'Found nothing.');
            assert.equal(shrunk.ok, true, shrunk.message);
            assert.equal(fights(host).length, drink ? 0 : 1, drink ? 'the fight that drank it goes' : 'a fight with no item stays');
            host.store.rebuild();
            assert.equal(fights(host).length, drink ? 0 : 1, 'a rebuild gives the same');
        } finally { host.close(); restore(); }
    }
});
