// Consumables: Use on…, story used line, and board Use item on the real host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playBoard } from '../../../../modules/rpg/board/engine.js';
import { settledNote } from '../../../../modules/rpg/board/note.js';
import { STANDARD_FORMULA } from '../../../../modules/rpg/rules.js';
import { boardSession, openBoard, stageExchange } from '../../../../modules/rpg/board/session.js';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { boardGuard } from '../../../../modules/rpg/board/commit.js';
import { hashJson } from '../../../../core/replay.js';
import { createBoardPart } from '../../../../modules/rpg/board/overrides.js';
import { ASTRA, DRAUGHT, fieldOf, itemRounds, potionBoard, potionHost, stackOf } from './commit.helpers.js';


test('Use on…: items.useOn offers the party\'s consumables, and rpg.useItem restores the pool by rarity and uses one unit up', async () => {
    const restore = seedCrypto(5), host = await potionHost();
    try {
        const offered = host.sdk.query('items.useOn', {});
        assert.deepEqual(Object.keys(offered).sort(), ['Healing Draught', 'Mana Potion', 'Travel Ration'].map(name => stackOf(host, name).id).sort(), 'every consumable, no one else');
        assert.deepEqual(offered[stackOf(host, 'Mana Potion').id], [{ id: ASTRA, via: 'rpg.useItem' }]);
        assert.deepEqual(host.sdk.query('inventory.equipment', {}).users[stackOf(host, 'Mana Potion').id], [{ id: ASTRA, name: 'Astra', via: 'rpg.useItem' }], 'the inventory screen\'s picker reads it, and its button runs the RPG\'s own command');
        const before = fieldOf(host, 'health');
        const used = await host.sdk.command('rpg.useItem', { stack: stackOf(host, 'Healing Draught').id, target: ASTRA });
        assert.equal(used.ok, true, used.message);
        assert.equal(before, 2);
        assert.equal(fieldOf(host, 'health'), 6, 'a rare draught gives 4 health blocks (2 + 4)');
        assert.equal(stackOf(host, 'Healing Draught').qty, 2, 'one unit is used up');
        assert.match(used.receipt.summary, /Astra \+4 health, now 6 of 6/);
        assert.equal(used.receipt.narrate, true, 'from the button the narrator is told, as it is of inventory.consume');
        const mana = fieldOf(host, 'mana');
        assert.equal((await host.sdk.command('rpg.useItem', { stack: stackOf(host, 'Mana Potion').id, target: ASTRA })).ok, true);
        assert.equal(fieldOf(host, 'mana'), Math.min(5, mana + 2), 'a common mana potion gives 2 mana blocks');
        assert.equal(stackOf(host, 'Mana Potion'), undefined, 'the last unit leaves the bag');
        const stamina = fieldOf(host, 'stamina');
        assert.equal((await host.sdk.command('rpg.useItem', { stack: stackOf(host, 'Travel Ration').id, target: ASTRA })).ok, true);
        assert.equal(fieldOf(host, 'stamina'), 5, 'an epic ration gives 5 stamina blocks, held to the bar\'s size');
        assert.equal((await host.sdk.command('rpg.useItem', { stack: stackOf(host, 'Healing Draught').id, target: 'ac_nobody00' })).ok, false, 'a target that is not in the party is refused');
        assert.equal(stackOf(host, 'Healing Draught').qty, 2, 'and nothing is used up');
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, 'a rebuild gives the live state');
    } finally { host.close(); restore(); }
});

test('Use on… is capped at the pool\'s size, and not offered while a board fight is open', async () => {
    const restore = seedCrypto(5), host = await potionHost({ health: 3 });
    try {
        const used = await host.sdk.command('rpg.useItem', { stack: stackOf(host, 'Healing Draught').id, target: ASTRA });
        assert.equal(used.ok, true, used.message);
        assert.equal(fieldOf(host, 'health'), 6, '4 + 4 is held to the bar of 6');
        assert.match(used.receipt.summary, /Astra \+2 health, now 6 of 6/);
        const full = await host.sdk.command('rpg.useItem', { stack: stackOf(host, 'Healing Draught').id, target: ASTRA });
        assert.equal(full.ok, true, 'a full pool still takes the dose: the reader chose it');
        assert.match(full.receipt.summary, /already full/);
        assert.equal(stackOf(host, 'Healing Draught').qty, 1);
        openBoard(host.ctx.chatMetadata, host.head(), { sid: host.store.carrierSid(host.store.headIndex()), rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
        assert.deepEqual(host.sdk.query('items.useOn', {}), {}, 'the sheet is held while the fight is open');
        assert.equal(fieldOf(host, 'health'), 6);
    } finally { host.close(); restore(); }
});

test('the story line `- item X | used: yes | on: Name` does the same through the story path: one unit, the pool by rarity, replay-safe', async () => {
    const restore = seedCrypto(5), host = await potionHost();
    try {
        await host.send('I drink.', 'She drinks.\n<Changes>\n- item Healing Draught | used: yes | on: Astra\n</Changes>');
        assert.equal(fieldOf(host, 'health'), 6, 'a rare draught: 2 + 4');
        assert.equal(stackOf(host, 'Healing Draught').qty, 2);
        assert.equal(host.ctx.chat.at(-1).extra.storySuite.receipts.find(receipt => receipt.type === 'capture.item').narrate, false, 'from the story the narrator already said so');
        await host.send('Again.', 'She drinks.\n<Changes>\n- item Mana Potion | used: yes\n</Changes>');
        assert.equal(fieldOf(host, 'mana'), 4, 'no `on:` means the reader: a common mana potion, 2 + 2');
        assert.equal(stackOf(host, 'Mana Potion'), undefined);
        await host.send('A stranger.', 'He drinks.\n<Changes>\n- item Healing Draught | used: yes | on: Nobody\n</Changes>');
        assert.equal(stackOf(host, 'Healing Draught').qty, 1, 'someone off the sheet still uses the unit up');
        assert.equal(fieldOf(host, 'health'), 6, 'and no one on the sheet is helped');
        await host.send('Eat.', 'She eats.\n<Changes>\n- item Travel Ration | used: yes | on: Astra\n</Changes>');
        assert.equal(fieldOf(host, 'stamina'), 5, 'an epic ration: stamina to the bar');
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, 'a rebuild gives the live state');
        await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
        assert.equal(JSON.stringify(host.head()), live, 'a reload does too');
        assert.equal((await host.sdk.reread(host.ctx.chat.length - 1)).ok, true);
        assert.equal(JSON.stringify(host.head()), live, 'a Re-read keeps it');
    } finally { host.close(); restore(); }
});

test('with the RPG off the used line still takes the unit away, and no one is healed', async () => {
    const restore = seedCrypto(5), host = await potionHost({ rpg: false });
    try {
        const sent = await host.send('I drink.', 'She drinks.\n<Changes>\n- item Healing Draught | used: yes | on: Astra\n</Changes>');
        assert.notEqual(sent.aborted, true);
        assert.equal(stackOf(host, 'Healing Draught').qty, 2, 'the line falls back: one unit goes');
        assert.equal(fieldOf(host, 'health'), 2);
        assert.deepEqual(host.sdk.query('inventory.equipment', {}).users, {}, 'and there is no Use on…');
    } finally { host.close(); restore(); }
});

test('board: Use item takes the actor\'s action, restores the pool, uses the unit up when the reply commits, and the foes still attack', async () => {
    const restore = seedCrypto(11), host = await potionHost();
    try {
        const stack = stackOf(host, 'Healing Draught').id, meta = potionBoard(host, [DRAUGHT(host)]);
        const session = boardSession(meta), preview = playBoard(host.head(), session.setup, session.exchanges);
        assert.equal(preview.error, undefined, preview.error);
        const lines = preview.result.rounds[0].lines;
        assert.equal(lines[0].item, 'Healing Draught');
        assert.equal(lines[0].pool, 'health');
        assert.equal(lines[0].gained, 4);
        assert.equal(lines.filter(line => line.kind === 'act').length, 0, 'no attack was made');
        assert.ok(lines.some(line => line.kind === 'foe'), 'the foes still attack');
        assert.equal(host.head().domains.inventory.stacks[stack].qty, 3, 'the preview changes nothing in the bag');
        assert.deepEqual(preview.result.items.map(item => [item.name, item.who, item.target, item.pool, item.gained]), [['Healing Draught', 'Astra', 'Astra', 'health', 4]]);
        assert.match(settledNote(preview.result), /Astra drinks the Healing Draught \(\+4 health\); already used up/);
        await host.send('I drink and brace.', 'She drinks.');
        const result = itemRounds(host);
        assert.deepEqual(result.rounds, preview.result.rounds, 'the reply holds what the board showed');
        assert.equal(host.head().domains.inventory.stacks[stack].qty, 2, 'one unit is used up');
        for (const hurt of result.hurts) assert.equal(fieldOf(host, hurt.field), hurt.to, 'the bars the reply wrote are the recorded ones');
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, 'a rebuild gives the live state');
        await host.swipe('Told another way.');
        assert.deepEqual(itemRounds(host).rounds, preview.result.rounds, 'a swipe gives the same result');
        assert.equal(host.head().domains.inventory.stacks[stack].qty, 2, 'and the unit is used up once');
        assert.equal((await host.sdk.reread(host.ctx.chat.length - 1)).ok, true);
        assert.deepEqual(itemRounds(host).rounds, preview.result.rounds, 'Re-read keeps it');
        assert.equal(host.head().domains.inventory.stacks[stack].qty, 2);
        await host.store.flush();
        const kept = JSON.stringify(host.head());
        await host.st.loadChat(structuredClone(host.st.saves.at(-1)));
        assert.equal(JSON.stringify(host.head()), kept, 'a reload keeps it');
    } finally { host.close(); restore(); }
});

test('board: the item is checked against the bag, one item per member per exchange, and later exchanges see what earlier ones used', async () => {
    const restore = seedCrypto(11), host = await potionHost();
    try {
        const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
        openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
        assert.match(stageExchange(meta, host.head(), [{ who: 'Astra', kind: 'item', stack: 'it_nothere', target: 'Astra' }]).error, /no longer in the bag/);
        assert.match(stageExchange(meta, host.head(), [{ who: 'Astra', kind: 'item', stack: stackOf(host, 'Healing Draught').id, target: 'Nobody' }]).error, /no longer here/);
        assert.match(stageExchange(meta, host.head(), [{ who: 'Astra', kind: 'item', target: 'Astra' }]).error, /Choose an item/);
        assert.match(stageExchange(meta, host.head(), [{ who: 'Astra', kind: 'item', stack: stackOf(host, 'Mana Potion').id, target: 'Astra' }, { who: 'Astra', kind: 'item', stack: stackOf(host, 'Mana Potion').id, target: 'Astra' }]).error, /cannot act twice|Choose an action/);
        assert.equal(boardSession(meta).exchanges.length, 0, 'a refused choice never enters the session');
        const mana = { who: 'Astra', kind: 'item', stack: stackOf(host, 'Mana Potion').id, target: 'Astra' };
        assert.equal(stageExchange(meta, host.head(), [mana]).error, undefined);
        assert.match(stageExchange(meta, host.head(), [mana]).error, /no longer in the bag/, 'the last Mana Potion went in exchange 1');
        assert.equal(boardSession(meta).exchanges.length, 1);
    } finally { host.close(); restore(); }
});

test('board: a fight that used an item holds its replay guard to that stack, and the old shape is unchanged', async () => {
    const restore = seedCrypto(11), host = await potionHost();
    try {
        potionBoard(host, [DRAUGHT(host)]);
        const before = structuredClone(host.head());
        await host.send('I drink.', 'She drinks.');
        const guarded = host.ctx.chat.at(-1).extra.storySuite.spans.find(span => span.guard?.predicate?.kind === 'rpg.resolve');
        assert.equal(guarded.guard.predicate.items, 1, 'the predicate says items were used');
        const check = state => boardGuard({ state, hash: hashJson }, { guard: guarded.guard, source: guarded.source, recorded: guarded.recorded });
        const earlier = structuredClone(before);
        // (the state this reply began on: the bag still held the dose; the guard must say so, and must say no when the bag no longer does)
        assert.equal(check(earlier).ok, true, JSON.stringify(check(earlier)));
        const stack = stackOf({ head: () => earlier }, 'Healing Draught');
        stack.qty = 1;
        assert.equal(check(earlier).ok, false, 'a different stock behind the fight breaks the guard');
        delete earlier.domains.inventory.stacks[stack.id];
        assert.equal(check(earlier).ok, false, 'so does a bag with no such item');
        const plain = await potionHost();
        try {
            potionBoard(plain, [{ who: 'Astra', kind: 'attack', target: 11 }]);
            await plain.send('I strike.', 'She strikes.');
            const span = plain.ctx.chat.at(-1).extra.storySuite.spans.find(item => item.guard?.predicate?.kind === 'rpg.resolve');
            assert.equal('items' in span.guard.predicate, false, 'a fight with no item has the predicate it always had');
            assert.equal('items' in plain.ctx.chat.at(-1).extra.storySuite.receipts.find(item => item.type === 'rpg.resolve').data.v2.result, false);
        } finally { plain.close(); }
    } finally { host.close(); restore(); }
});

test('story used line: a reply captured before the consumableRecovery mark only takes the unit away (also on Re-read); a marked one heals', async () => {
    const restore = seedCrypto(5), host = await potionHost(), setter = host.store.setRuleMarks;
    try {
        host.store.setRuleMarks = () => { throw new Error('old reply'); };
        await host.send('I drink.', 'She drinks.\n<Changes>\n- item Healing Draught | used: yes | on: Astra\n</Changes>');
        host.store.setRuleMarks = setter;
        assert.equal(fieldOf(host, 'health'), 2, 'an old-carrier line heals no one');
        assert.equal(stackOf(host, 'Healing Draught').qty, 2, 'and takes one unit');
        const live = JSON.stringify(host.head());
        assert.equal((await host.sdk.reread(host.ctx.chat.length - 1)).ok, true);
        assert.equal(JSON.stringify(host.head()), live, 'a Re-read keeps it byte-identical');
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, 'a rebuild too');
        await host.send('Again.', 'She drinks.\n<Changes>\n- item Healing Draught | used: yes | on: Astra\n</Changes>');
        assert.equal(fieldOf(host, 'health'), 6, 'a new-carrier line heals');
        assert.equal(stackOf(host, 'Healing Draught').qty, 1);
    } finally { host.store.setRuleMarks = setter; host.close(); restore(); }
});

test('a used line for a unit the same reply\'s board already used is refused: one unit, one heal', async () => {
    const restore = seedCrypto(11), host = await potionHost();
    try {
        const stack = stackOf(host, 'Healing Draught').id;
        potionBoard(host, [DRAUGHT(host)]);
        await host.send('I drink.', 'She drinks.\n<Changes>\n- item Healing Draught | used: yes | on: Astra\n</Changes>');
        assert.equal(host.head().domains.inventory.stacks[stack].qty, 2, 'the board took one unit; the line took none');
        assert.match(host.turn.problems().map(item => item.message).join(' | '), /already used on the fight board/, 'the line is refused with a problem');
        assert.equal(itemRounds(host).rounds[0].lines[0].item, 'Healing Draught');
    } finally { host.close(); restore(); }
});

test('Use on… leaves out a bound stack', async () => {
    const restore = seedCrypto(5), host = await potionHost();
    try {
        const id = stackOf(host, 'Mana Potion').id, part = createBoardPart({ persona: () => '', metadata: () => null }), ask = state => part.queries['items.useOn'](state);
        const domains = structuredClone(host.head().domains);
        assert.ok(ask({ domains })[id]);
        domains.inventory.stacks[id].bound = 'pc:astra';
        assert.equal(ask({ domains })[id], undefined);
    } finally { host.close(); restore(); }
});
