// The supply kind: made by a story line under its rule mark, set by the reader's Edit, and shown under its own Bag heading.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createHost } from '../../../testkit/index.js';
import { itemsCard } from '../../../ui/tabs/bag/item-grid.js';
import { itemEditForm, itemPatch } from '../../../ui/tabs/bag/item-edit.js';
import { addPayload } from '../../../ui/tabs/bag/item-add.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { TAIL_KEY } from '../../../core/turn.js';

const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const RATIONS = '+ item Trail Rations | qty: 6 | kind: supply | note: 6 days of food';

async function start(t, gear = false) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: gear ? { features: { 'story-block.gear': true, 'story-block.rpg': true } } : {} });
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    return host;
}
const defNamed = (host, name) => Object.values(host.head().domains.inventory.defs).find(def => def.name === name);
const stackNamed = (host, name) => host.sdk.query('inventory.items').find(item => item.name === name);
const bagOf = host => buildSelectors(() => null, null).bag((type, args) => host.sdk.query(type, args));
const sentTail = host => host.st.promptLog.filter(entry => entry.key === TAIL_KEY && entry.value).at(-1)?.value ?? '';

for (const gear of [false, true]) {
    test(`gear ${gear ? 'on' : 'off'}: kind: supply (or supplies) makes a supply, never worn, weighing what a consumable does`, async t => {
        const host = await start(t, gear);
        await host.send('Pack.', reply('Packed.', [RATIONS, '+ item Boot Grease | kind: supplies', '+ item Odd Stone']));
        assert.deepEqual(['Trail Rations', 'Boot Grease', 'Odd Stone'].map(name => defNamed(host, name).kind), ['supply', 'supply', 'goods']);
        assert.equal(defNamed(host, 'Boot Grease').slot, null, 'a slot noun in the name gives a supply no slot');
        assert.equal(stackNamed(host, 'Trail Rations').qty, 6);
        if (gear) assert.equal(host.sdk.query('gear.view').rows[stackNamed(host, 'Trail Rations').stack].weight, 1);
        await host.send('Walk.', 'On.');
        assert.match(sentTail(host), /^Supplies: .*Trail Rations ×6 \(6 days of food\)/m);
        const before = JSON.stringify(host.head().domains.inventory);
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head().domains.inventory), before, 'replay');
    });

    test(`gear ${gear ? 'on' : 'off'}: a reply without the supplyKind mark keeps its old item on Re-read; a marked one stays a supply`, async t => {
        const host = await start(t, gear);
        const setter = host.store.setRuleMarks;
        host.store.setRuleMarks = () => { throw new Error('old reply'); };
        await host.send('Pack.', reply('Packed.', [RATIONS]));
        host.store.setRuleMarks = setter;
        const old = host.ctx.chat.length - 1;
        assert.equal(defNamed(host, 'Trail Rations').kind, 'goods');
        assert.equal((await host.turn.reread(old)).ok, true);
        assert.equal(defNamed(host, 'Trail Rations').kind, 'goods');
        await host.send('More.', reply('More.', ['+ item Lamp Wicks | kind: supply']));
        assert.equal((await host.turn.reread(host.ctx.chat.length - 1)).ok, true);
        assert.deepEqual(['Trail Rations', 'Lamp Wicks'].map(name => defNamed(host, name).kind), ['goods', 'supply']);
    });

    test(`gear ${gear ? 'on' : 'off'}: the Bag lists supplies under their own heading, and Edit sets Supply on a story item and takes it off`, async t => {
        installFakeDom();
        const host = await start(t, gear);
        await host.send('Pack.', reply('Packed.', [RATIONS, '+ item Brass Key']));
        const bag = bagOf(host);
        const card = itemsCard(bag, {});
        card.querySelector('[data-f="supply"]').click();
        assert.deepEqual(card.querySelectorAll('.itm').map(row => [row.querySelector('.n').textContent, row.querySelector('.k').textContent]), [['Trail Rations', 'Supplies']]);

        const key = bag.items.find(item => item.name === 'Brass Key');
        const select = itemEditForm(key, { rpg: gear }).querySelector('[data-field="kind"]');
        assert.deepEqual(select.querySelectorAll('option').map(option => option.textContent), ['Goods', 'Supplies']);
        const values = { name: key.name, qty: '1', note: key.note };
        assert.equal(itemPatch(key, { ...values, kind: 'goods' }), null, 'unchanged');
        const patch = itemPatch(key, { ...values, kind: 'supply' });
        assert.deepEqual(patch, { stack: key.stack, kind: 'supply' });
        const out = await host.sdk.command('inventory.edit', patch);
        assert.equal(out.ok, true, out.message);
        assert.equal(defNamed(host, 'Brass Key').kind, 'supply');

        const now = bagOf(host).items.find(item => item.name === 'Brass Key');
        assert.equal(now.kind, 'supply');
        assert.deepEqual(itemEditForm(now, {}).querySelector('[data-field="kind"]').querySelectorAll('option').map(option => option.textContent), ['Supplies', 'Goods'], 'only the kind it came from');
        host.store.rebuild();
        assert.equal(defNamed(host, 'Brass Key').kind, 'supply', 'replay');
        for (const kind of ['consumable', 'material', 'quest']) {
            const refused = await host.sdk.command('inventory.edit', { stack: now.stack, kind });
            assert.equal(refused.ok, false, `a story item cannot leave Supply as ${kind}`);
        }
        assert.equal(defNamed(host, 'Brass Key').kind, 'supply');
        const back = await host.sdk.command('inventory.edit', itemPatch(now, { ...values, kind: 'goods' }));
        assert.equal(back.ok, true, back.message);
        assert.equal(defNamed(host, 'Brass Key').kind, 'goods');
        const live = JSON.stringify(host.head().domains.inventory);
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head().domains.inventory), live, 'replay after both');
    });
}

test('a story consumable made a supply goes back to Use, and to nothing else; rebuild equals live', async t => {
    installFakeDom();
    const host = await start(t, true);
    await host.send('Pack.', reply('Packed.', ['+ item Healing Draught | kind: consumable']));
    const draught = () => bagOf(host).items.find(item => item.name === 'Healing Draught');
    assert.equal((await host.sdk.command('inventory.edit', { stack: draught().stack, kind: 'supply' })).ok, true);
    assert.deepEqual(itemEditForm(draught(), {}).querySelector('[data-field="kind"]').querySelectorAll('option').map(option => option.textContent), ['Supplies', 'Use']);
    assert.equal((await host.sdk.command('inventory.edit', { stack: draught().stack, kind: 'goods' })).ok, false);
    assert.equal((await host.sdk.command('inventory.edit', { stack: draught().stack, kind: 'supply' })).ok, true, 'saved again: the first kind is still kept');
    const out = await host.sdk.command('inventory.edit', { stack: draught().stack, kind: 'consumable' });
    assert.equal(out.ok, true, out.message);
    assert.equal(defNamed(host, 'Healing Draught').kind, 'consumable');
    assert.equal('wasKind' in defNamed(host, 'Healing Draught'), false);
    const live = JSON.stringify(host.head().domains.inventory);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains.inventory), live);
});

test('the reader\'s + Add takes Supplies; equipment has no Kind in Edit and cannot be made a supply', async t => {
    installFakeDom();
    const host = await start(t, true);
    const added = await host.sdk.command('inventory.add', addPayload({ name: 'Pitch', kind: 'supply', qty: '2' }));
    assert.equal(added.ok, true, added.message);
    assert.equal(defNamed(host, 'Pitch').kind, 'supply');
    await host.send('Arm.', reply('Armed.', ['+ item Iron Sword']));
    const sword = bagOf(host).items.find(item => item.name === 'Iron Sword');
    assert.equal(sword.kind, 'gear');
    assert.equal(itemEditForm(sword, { rpg: true }).querySelector('[data-field="kind"]'), null);
    const refused = await host.sdk.command('inventory.edit', { stack: sword.stack, kind: 'supply' });
    assert.equal(refused.ok, false);
    assert.equal(defNamed(host, 'Iron Sword').kind, 'equipment');
});
