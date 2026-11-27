// Supplies in the tail: which items count, that they come first with more of their note, and the upkeep line after the story day turns.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { createModule } from '../../../modules/director/module.js';
import { fakeFightRunner } from '../../suite/integration/director/helpers/fake-fight-runner.js';
import { TAIL_KEY } from '../../../core/turn.js';
import { inventoryTail } from '../../../modules/inventory/index.js';
import { isSupply, upkeepCue } from '../../../modules/inventory/prompt-parts/supply.js';

const goods = (name, note = '') => ({ name, note, kind: 'goods' });
const CURRENCY = { name: 'gold', plural: 'gold', short: '' };

test('a supply word in the name or note, as a whole word in any case; a consumable (a potion or draught that restores) never by itself', () => {
    for (const item of [goods('Party River Rations & Slingbags'), goods('Slingbags', '6-day smoked eel, biscuit & salt-plum provisions'), goods('Healer\'s Pouch', 'two BANDAGES left'),
        goods('Torches'), goods('Lamp Oil'), goods('Bundle', 'dry firewood')]) assert.equal(isSupply(item), true, `${item.name} ${item.note}`);
    for (const item of [goods('Waterproof Cloak'), goods('Oilskin'), goods('Fishing Rod'), goods('Whetstone', 'found in the fish market'), goods('Rope', 'a salesman\'s')]) {
        assert.equal(isSupply(item), false, `${item.name} ${item.note}`);
    }
    const draught = { name: 'Red Vial', note: '', kind: 'consumable' };
    assert.deepEqual([isSupply(draught, true), isSupply(draught, false)], [false, false]);
    assert.equal(isSupply({ name: 'Minor Healing Draught', note: '', kind: 'goods' }), false, 'a healing draught is no supply by its words either');
});

test('paperwork is never a supply, whatever its words say', () => {
    for (const item of [goods('Ration Pass'), goods('Medicine Ledger'), goods('Guild Warrant', 'for the wine and ale'), { name: 'Letter', note: 'about the water', kind: 'quest' },
        { name: 'Provisions Tally', note: '', kind: 'material' }]) assert.equal(isSupply(item), false, item.name);
});

const inventoryOf = items => ({
    domains: { inventory: {
        defs: Object.fromEntries(items.map((item, i) => [`d${i}`, { id: `d${i}`, name: item.name, kind: item.kind ?? 'goods' }])),
        stacks: Object.fromEntries(items.map((item, i) => [`s${i}`, { id: `s${i}`, def: `d${i}`, owner: item.owner ?? 'party', qty: 1, equipped: item.equipped ?? null, note: item.note ?? '' }])),
        wallets: {},
    } },
});
const tailOf = (items, more = {}) => inventoryTail(inventoryOf(items), { currency: CURRENCY, chars: 2000, optionalChars: 800, ...more });

test('supplies have a line of their own for each owner, before any Carried line, and only their notes keep 80 characters', () => {
    const long = '6-day smoked eel, biscuit and salt-plum provisions in four waxed-canvas slingbags, one each';
    const other = 'an old map of the river with every ford, weir and landing marked in red ink';
    const { lines } = tailOf([
        { name: 'Anchor', note: other }, { name: 'Bell' }, { name: 'Packs', note: long }, { name: 'Zinc Torches' }, { name: 'Tarred Sack', kind: 'supply' },
        { name: 'Awl', owner: 'npc' }, { name: 'Yeast Bread', owner: 'npc' },
    ]);
    assert.deepEqual(lines.slice(1).map(line => line.slice(0, line.indexOf(':'))), ['Supplies', 'Supplies (npc)', 'Carried', 'Carried (npc)']);
    const [supplies, theirs, carried, rest] = lines.slice(1);
    for (const name of ['Packs', 'Zinc Torches', 'Tarred Sack']) assert.ok(supplies.includes(name) && !carried.includes(name), name);
    assert.ok(theirs.includes('Yeast Bread') && rest.includes('Awl') && !rest.includes('Yeast Bread'));
    const noteOf = (line, name) => line.slice(line.indexOf(`${name} (`) + name.length + 2).split(')')[0];
    assert.ok(noteOf(supplies, 'Packs').length > 60 && noteOf(supplies, 'Packs').length <= 80, supplies);
    assert.ok(noteOf(carried, 'Anchor').length <= 40, carried);
});

test('supplies take the required room first; with only supplies there is no Carried line', () => {
    const tight = tailOf([...Array.from({ length: 20 }, (_, i) => ({ name: `Trinket number ${i}` })), { name: 'Bread' }], { chars: 70 });
    assert.ok(tight.lines.includes('Supplies: Bread') && !tight.lines.some(line => line.startsWith('Carried')), tight.lines.join('\n'));
    assert.match(tight.optional[0], /^Also carried: /);
    assert.deepEqual(tailOf([{ name: 'Bread' }]).lines.slice(1), ['Supplies: Bread']);
});

test('the upkeep line is the first optional one, counts equipped supplies, and its room comes out of the optional lines', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `Trinket number ${i}` }));
    const tail = tailOf([{ name: 'Bread' }, ...many], { chars: 120, optionalChars: 400, days: 2 });
    assert.equal(tail.optional[0], upkeepCue(2));
    assert.ok(tail.optional.slice(0, -1).join('\n').length <= 400, 'within the optional room');
    assert.deepEqual(tailOf([{ name: 'Oil Lamp', equipped: 'off-hand' }], { days: 1 }).optional, [upkeepCue(1)], 'only an equipped supply, nothing carried');
    assert.deepEqual(tailOf([{ name: 'Bread' }]).optional, [], 'no day passed');
    assert.deepEqual(tailOf([{ name: 'Rope' }], { days: 3 }).optional, [], 'no supply');
    assert.equal(upkeepCue(1), '1 day has passed: the party ate and used supplies (the Supplies line). Write their change lines (- item Name | qty: n, or ~ item Name | note: what is left, e.g. "3 days of food left").');
    assert.match(upkeepCue(2), /^2 days have passed: /);
});

const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
async function start(t, first = ['~ time March 3, 1200, 06:00 pm', '+ item Smoked Eel | qty: 6']) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [fakeFightRunner(), createModule()] });   // (the Director owns the story clock)
    t.after(() => host.close());
    await host.send('Hello.', reply('The road.', first));
    return host;
}
const sentTail = host => host.st.promptLog.filter(entry => entry.key === TAIL_KEY && entry.value).at(-1)?.value ?? '';
const cueIn = text => text.split('\n').find(line => /passed: the party ate/.test(line)) ?? null;
// What the next send is told: the reader's message with a plain reply.
async function told(host, answer = 'On.') { await host.send('Go on.', answer); return cueIn(sentTail(host)); }

test('the reply after the day turns is asked once; the same day and the replies after are not', async t => {
    const host = await start(t);
    assert.equal(await told(host, reply('Dusk.', ['~ time March 3, 1200, 11:00 pm'])), null, 'the first clock: no day before it');
    assert.equal(await told(host, reply('Morning.', ['~ time March 4, 1200, 07:00 am'])), null, 'the same day');
    assert.equal(await told(host), upkeepCue(1), 'next morning');
    assert.equal(await told(host), null, 'a reply with no clock sends nothing');
});

test('a two-day skip says 2 days, and swipe, regenerate, Re-read and reload send the same tail', async t => {
    const host = await start(t);
    await host.send('We ride.', reply('Two days on.', ['! time +2d']));
    await host.send('Camp.', 'Camp.');
    const first = sentTail(host);
    assert.equal(cueIn(first), upkeepCue(2));
    await host.swipe('Camp, retold.');
    assert.equal(sentTail(host), first, 'swipe');
    await host.regenerate('Camp again.');
    assert.equal(sentTail(host), first, 'regenerate');
    const jump = host.ctx.chat.length - 3;
    assert.equal((await host.turn.reread(jump)).ok, true);
    await host.regenerate('Camp once more.');
    assert.equal(sentTail(host), first, 'after a Re-read of the reply that moved the clock');
    await host.turn.onChatChanged();
    await host.regenerate('Camp after a reload.');
    assert.equal(sentTail(host), first, 'reload');
});

test('no supply, or no clock: nothing is asked', async t => {
    const bare = await start(t, ['~ time March 3, 1200, 06:00 pm', '+ item Rope']);
    await bare.send('Ride.', reply('On.', ['! time +2d']));
    assert.equal(await told(bare), null, 'no supply');
    const clockless = await start(t, ['+ item Bread']);
    assert.equal(await told(clockless, reply('Days go by.', ['~ item Bread | note: stale'])), null);
    assert.equal(await told(clockless), null, 'no clock');
});
