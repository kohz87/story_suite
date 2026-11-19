// The narrator names a special item's numbers in the story (`| rarity: rare | DEX: +2 | slot: weapon`): held to the budget and ceiling; plain lines keep the default; Gear off sends no gear words; replay equals live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { fresh, reply, defNamed, staticOf, FIGHT } from './gear-inventory.helpers.js';
import { reload, clone } from '../../core/helpers/timeline.js';

const SETTINGS = { settings: { features: { 'story-block.gear': true, 'story-block.rpg': true } } };
const record = host => JSON.stringify(Object.values(host.head().domains.inventory.defs).filter(def => def.slot).map(({ name, slot, rarity, stats }) => [name, slot, rarity ?? null, stats]));
const indexOf = (host, text) => host.ctx.chat.findIndex(message => message.mes.includes(text));

test('a story line with slot, rarity and stats makes the item with those numbers; a plain line gets the default', async t => {
    const host = await fresh(t);
    await host.send('Loot.', reply('A blade.', ['+ item Moonlit Blade | slot: weapon | rarity: rare | DEX: +2 | AGI: 1', '+ item Warded Plate | slot: body | rarity: uncommon | VIT: 5 | STR: 4', '+ item Old Sword']));
    const blade = defNamed(host, 'Moonlit Blade');
    assert.deepEqual([blade.slot, blade.rarity, blade.stats], ['weapon', 'rare', { DEX: 2, AGI: 1 }]);
    assert.deepEqual(defNamed(host, 'Warded Plate').stats, { VIT: 2 }, 'held to the uncommon budget of 2');
    const plain = defNamed(host, 'Old Sword');
    assert.deepEqual([plain.slot, plain.rarity, Object.keys(plain.stats).length], ['weapon', 'common', 1], 'the default: the name\'s slot, one stat');
});

test('a legendary word is held to epic unless earned', async t => {
    const host = await fresh(t);
    await host.send('Loot.', reply('A relic.', ['+ item Sun Crown | slot: head | rarity: legendary | WIS: 5']));
    assert.equal(defNamed(host, 'Sun Crown').rarity, 'epic');
});

test('with Gear off the prompt has no gear words and a stats line makes no numbers', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [FIGHT], settings: {} });
    t.after(() => host.close());
    await host.send('Loot.', reply('A blade.', ['+ item Moonlit Blade | slot: weapon | rarity: rare | DEX: +2']));
    assert.equal(/enchanted|masterwork|rarity:/.test(staticOf(host)), false);
    assert.deepEqual(defNamed(host, 'Moonlit Blade').stats ?? {}, {});
});

test('replay equals live for an item defined with stats: swipe and back, middle delete, edited Re-read, reload', async t => {
    const host = await fresh(t);
    await host.send('Loot.', reply('A blade.', ['+ item Moonlit Blade | slot: weapon | rarity: rare | DEX: +2 | AGI: 1']));
    await host.send('Pay.', reply('Coins.', ['+ coin 5']));
    const same = async label => {
        const live = record(host);
        host.store.rebuild();
        assert.equal(record(host), live, `${label}: a rebuild equals live`);
        const cold = await reload(createHost, { chat: clone(host.ctx.chat), metadata: clone(host.ctx.chatMetadata) }, [FIGHT], SETTINGS);
        t.after(() => cold.close());
        assert.equal(record(cold), live, `${label}: a reload equals live`);
        return live;
    };
    const start = await same('start');
    assert.match(start, /Moonlit Blade","weapon","rare",\{"DEX":2,"AGI":1\}/);
    const last = host.ctx.chat.length - 1;
    await host.swipe(reply('Other coins.', ['+ coin 2']));
    await same('swiped');
    await host.st.swipeTo(last, 0);
    assert.equal(await same('swiped back'), start);
    const at = indexOf(host, 'A blade.');
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(await same('plain re-read'), start);
    host.ctx.chat[at].mes = reply('A blade.', ['+ item Moonlit Blade | slot: weapon | rarity: epic | STR: +3 | VIT: 1']);
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.match(await same('edited re-read'), /"epic",\{"STR":3,"VIT":1\}/);
    await host.st.deleteMessage(at);
    assert.equal(await same('middle delete'), '[]');
});
