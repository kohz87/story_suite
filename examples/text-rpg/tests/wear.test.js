import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTry } from '../src/module-parts/kinds/try.js';
import { astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';
import { reply, slice, tries, newHost, BUY, SKILLS } from './helpers/host.js';

// Astra: every stat 12 (bonus +9). Normal is 12: die 2 is a success at a cost (11 total), die 1 a bad failure.
const piece = (name, extra = {}) => ({ name, rarity: 'common', bonus: '+1 DEX', broken: false, ...extra });
const GEAR = { weapon: piece('Iron Sword'), body: piece('Leather'), 'off-hand': null };

function roll(die, { what = 'Lore', labels = { danger: 'yes' }, slots = GEAR, member = astra(), difficulty = 'normal' } = {}) {
    const calls = [];
    const asked = [];
    const ctx = fakeCtx(sliceOf([member], { list: [die, 10, 10], floor: 0 }), {
        query: (name, args) => { asked.push(args); return name === 'gear.view' ? { slots } : null; },
        call: (type, payload) => { calls.push([type, payload]); return { data: { stack: `st_${payload.slot}`, before: 100, now: 66, broken: false } }; },
    });
    const done = run(applyTry, ctx, line('try', member.name, `${what}; ${difficulty}`, labels));
    assert.equal(done.ok, true, done.message);
    return { calls, asked, data: done.result?.data };
}

test('a bad failure in danger wears the weapon of a physical try and the armour for the wound, one step each (what one exchange of a board fight wears), recorded in the receipt', () => {
    const { calls, data, asked } = roll(1, { what: 'dex' });
    assert.deepEqual(calls.map(([, payload]) => [payload.slot, payload.steps, payload.recorded, payload.owner]), [['weapon', 1, true, 'party'], ['body', 1, true, 'party']]);
    assert.deepEqual(asked[0], { owner: 'party' }, 'the reader\'s character wears the party\'s bag');
    assert.deepEqual(data.worn.map(item => [item.slot, item.steps, item.before, item.now]), [['weapon', 1, 100, 66], ['body', 1, 100, 66]]);
});

test('a try with a mind stat wears only the armour for the wound; a success at a cost in danger wears nothing', () => {
    const lore = roll(1);
    assert.deepEqual(lore.calls.map(([, payload]) => payload.slot), ['body']);
    const cost = roll(2, { what: 'str' });
    assert.equal(cost.data.band, 'cost');
    assert.equal(cost.calls.length, 0, 'a cost is paid in wounds and stamina, never in gear');
    assert.equal(cost.data.worn, undefined);
});

test('nothing wears out of danger, on a success or a plain failure, and a broken or missing piece is left alone', () => {
    assert.equal(roll(1, { what: 'str', labels: {} }).calls.length, 0, 'not in danger');
    assert.equal(roll(19, { what: 'str' }).calls.length, 0, 'a success');
    assert.equal(roll(5, { what: 'str', difficulty: 'very hard' }).calls.length, 0, 'a plain failure');
    const none = roll(1, { what: 'str', slots: { weapon: piece('Iron Sword', { broken: true }), body: null, 'off-hand': piece('Buckler') } });
    assert.deepEqual(none.calls.map(([, payload]) => payload.slot), ['off-hand'], 'a broken weapon is skipped, the off-hand takes the wound when there is no body piece');
    assert.equal(roll(1, { what: 'str', slots: {} }).data.worn, undefined, 'no pieces, no worn list');
});

test('an attack skill wears the weapon', () => {
    const member = astra({ skills: [{ name: 'Slash', about: 'a cut', stat: 'int', type: 'attack' }] });
    assert.deepEqual(roll(1, { what: 'Slash', member, slots: { weapon: piece('Iron Sword') } }).calls.map(([, payload]) => payload.slot), ['weapon']);
});

// ---- the real host: the wear belongs to the reply, so a swipe, a Re-read, a reload and a middle delete agree --------------------------------
const FIGHT = ['? try Astra | str | near impossible | danger: yes'];
const word = host => host.sdk.query('gear.view', { owner: 'party' })?.slots.weapon?.word;

async function armed(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await newHost({ 'story-block.gear': true });
    t.after(() => host.close());
    assert.equal((await host.sdk.command('textRpg.create', { name: 'Astra', stats: BUY, skills: SKILLS })).ok, true);
    await host.send('Hello.', 'The road.');
    await host.send('Loot.', reply('A sword.', ['+ item Iron Sword | slot: weapon']));
    const out = await host.sdk.command('inventory.equip', { stack: host.sdk.query('inventory.items').find(item => item.name === 'Iron Sword').stack });
    assert.equal(out.ok, true, out.message);
    return host;
}

// A fight whose try was a bad failure (the only band that wears gear); the dice are the reply's own, so swipe until one is.
async function fight(host, text) {
    await host.send('Strike.', reply(text, FIGHT));
    for (let n = 0; n < 40 && tries(host).at(-1)?.data.band !== 'bad'; n += 1) await host.swipe(reply(text, FIGHT));
    return tries(host).at(-1).data;
}

test('Text RPG wears the weapon in a fight; Re-read, rebuild and reload keep that condition, a swipe without the line and a middle delete take it back', async t => {
    const host = await armed(t);
    assert.equal(word(host), 'good');
    const data = await fight(host, 'The blow lands.');
    assert.ok(data.worn?.some(item => item.slot === 'weapon'), JSON.stringify(data));
    const live = word(host);
    assert.notEqual(live, 'good');
    const at = host.ctx.chat.length - 1;
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.equal(word(host), live, 'a Re-read wears it once');
    host.store.rebuild();
    assert.equal(word(host), live, 'a rebuild');
    await host.send('Later.', reply('Quiet.', []));
    await host.st.deleteMessage(host.ctx.chat.findIndex(message => message.mes.includes('The blow lands.')));
    assert.equal(word(host), 'good', 'a middle delete takes the wear with its reply');
    assert.deepEqual(host.store.problems(), []);
    assert.equal(slice(host).members[Object.keys(slice(host).members)[0]].wounds, 0);
});

test('a swipe without the line gives the gear back', async t => {
    const host = await armed(t);
    await fight(host, 'The blow lands.');
    assert.notEqual(word(host), 'good');
    await host.swipe(reply('Another way.', []));
    assert.equal(word(host), 'good');
});
