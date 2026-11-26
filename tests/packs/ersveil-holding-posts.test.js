// Your Holding's officer posts (Ersveil rules 1.2.0): who may take one, the small bonus each gives, the rejoin rule, and replay equals live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { success, reply } from '../modules/data-modules/helpers.js';
import { rebuilt, skip, world } from '../modules/rpg/join.helpers.js';
import { grammarFor, summaryOf } from '../../modules/data-modules/part.js';
import { TAIL_KEY } from '../../core/turn.js';
import { selectStory } from '../../ui/select/story.js';

const ID = 'pack.ersveil-game/holding';
const GAME = readFileSync(new URL('../../examples/packs/ersveil-game/pack.json', import.meta.url), 'utf8');
const FOUND = '+ dm holding — Founded Ravenhold | kind: found | type: fief | name: Ravenhold';
const SEAT = '~ dm holding — the palisade is up | kind: seat | at: Ravenhold';
const post = (name, as) => `~ dm holding — ${name} takes it | kind: post | post: ${as} | who: ${name}`;
const unpost = as => `~ dm holding | kind: unpost | post: ${as}`;

// A founded holding with its seat at Ravenhold, where the party is.
async function chat(t, { seat = true } = {}) {
    const host = await world({ mode: 'auto' });
    t.after(() => host.close());
    t.mock.method(console, 'warn', () => {});
    host.ctx.name1 = 'Wessel';
    success(await host.packs.packs.install(GAME));
    const offer = host.sdk.query('dataModules.offers').find(row => row.module === ID);
    success(await host.sdk.command('dm.pin', { module: ID, hash: offer.hash, packHash: offer.packHash }));
    await say(host, '~ place Ravenhold | kind: settlement', FOUND, ...(seat ? [SEAT] : []));
    return host;
}
const say = (host, ...lines) => host.send('On.', reply(...lines));
const holding = host => host.sdk.query('dataModules.view', { module: ID }).chat;
const pick = (host, ...keys) => keys.map(key => holding(host)[key]);
const said = (host, text) => host.turn.problems().some(problem => problem.message.includes(`Your Holding: ${text}`));
const problemsText = host => host.turn.problems().map(problem => problem.message).join('\n');
const refused = (host, text) => assert.ok(said(host, text), `${text}\n--\n${problemsText(host)}`);
// A companion joins, then stays behind where the party is now: in the scene there.
async function stays(host, name) {
    await say(host, `+ present ${name}`, `+ party ${name}`);
    await say(host, `- party ${name}`);
}
const sentTail = host => host.st.promptLog.filter(entry => entry.key === TAIL_KEY && entry.value).at(-1)?.value ?? '';

test('a companion who stays at the seat takes a post under their own name; the line lists it', { skip }, async t => {
    const host = await chat(t);
    await stays(host, 'Mara');
    await say(host, '~ dm holding — Mara takes the stewardship | kind: post | post: steward | who: mara');
    assert.equal(holding(host).steward, 'Mara');
    assert.ok(summaryOf(host.head(), ID).endsWith('; posts: steward Mara.'), summaryOf(host.head(), ID));
    await say(host, unpost('steward'));
    assert.equal(holding(host).steward, '');
    assert.equal(summaryOf(host.head(), ID).includes('posts:'), false);
    await say(host, unpost('steward'));
    refused(host, 'No post was freed: nobody holds that post');
    await rebuilt(host, 'posted and freed');
});

test('a post is refused with its reason: no seat, a stranger, You, a companion who travels, someone elsewhere or nowhere known', { skip }, async t => {
    const host = await chat(t, { seat: false });
    await say(host, '+ present Mara', '+ party Mara', '+ present Ilse', '+ party Ilse', '+ present Dov', '+ party Dov');
    await say(host, '- party Ilse', post('Ilse', 'steward'));
    refused(host, 'the holding has no seat yet');
    await say(host, SEAT, post('Zed', 'steward'));
    refused(host, 'Zed is nobody the story knows');
    await say(host, post('Wessel', 'steward'));
    refused(host, 'Wessel is You; a post is for someone who stays behind');
    await say(host, post('Mara', 'steward'));
    refused(host, 'Mara travels with You; only someone who stays at the seat can hold a post');
    await say(host, '~ place Highmark | kind: town', '+ present Ilse', post('Ilse', 'steward'));
    refused(host, 'Ilse is with You at Highmark, not at the seat (Ravenhold)');
    await say(host, '- present Ilse', '- present Dov');
    await say(host, '- party Dov', post('Dov', 'envoy'));
    refused(host, 'nothing says Dov is staying at the seat (Ravenhold)');
    assert.deepEqual(pick(host, 'steward', 'envoy'), ['', '']);
    await rebuilt(host, 'refusals');
});

test('one person to a post and one post to a person; chaplain is the healer\'s post', { skip }, async t => {
    const host = await chat(t);
    await stays(host, 'Mara');
    await stays(host, 'Ilse');
    await say(host, post('Mara', 'chaplain'));
    assert.equal(holding(host).healer, 'Mara');
    assert.ok(summaryOf(host.head(), ID).includes('posts: healer/chaplain Mara'));
    await say(host, post('Ilse', 'healer'));
    refused(host, 'Mara holds the healer/chaplain post; free it first (kind: unpost)');
    await say(host, post('Mara', 'healer'));
    refused(host, 'Mara already holds that post');
    await say(host, post('Mara', 'envoy'));
    refused(host, 'Mara already holds the healer/chaplain post; one post each');
    await say(host, post('Ilse', 'envoy'));
    assert.deepEqual(pick(host, 'healer', 'envoy'), ['Mara', 'Ilse']);
    await rebuilt(host, 'two posts');
});

test('steward, envoy and quartermaster: a tenth more income, 1 or 2 more renown, a tenth less upkeep, only while held', { skip }, async t => {
    const host = await chat(t);
    for (const name of ['Mara', 'Ilse', 'Dov']) await stays(host, name);
    await say(host, '+ dm holding — hands | kind: recruit | n: 20');
    await say(host, post('Mara', 'steward'), post('Ilse', 'envoy'), post('Dov', 'quartermaster'));
    assert.equal(holding(host).upkeep, 9, '10 less a tenth');
    await say(host, '+ dm holding — toll | kind: income | gold: 25', '+ dm holding — word | kind: renown | size: small');
    assert.deepEqual(pick(host, 'treasury', 'renown'), [28, 4], 'the tenth is rounded up');
    await say(host, '+ dm holding — the ford | kind: renown | size: great');
    assert.equal(holding(host).renown, 16);
    await say(host, unpost('steward'), unpost('envoy'), unpost('quartermaster'));
    assert.equal(holding(host).upkeep, 10);
    await say(host, '+ dm holding — toll | kind: income | gold: 25', '+ dm holding — word | kind: renown | size: small');
    assert.deepEqual(pick(host, 'treasury', 'renown'), [53, 19]);
    await rebuilt(host, 'bonuses');
});

test('healer: a paid month gains 2 loyalty more than the 2 it gives anyway, an unpaid one gains nothing', { skip }, async t => {
    const host = await chat(t);
    await stays(host, 'Mara');
    await say(host, post('Mara', 'healer'), '+ dm holding — hands | kind: recruit | n: 20', '+ dm holding — toll | kind: income | gold: 10');
    await say(host, '! dm holding | kind: month');
    assert.deepEqual(pick(host, 'treasury', 'loyalty'), [0, 64]);
    await say(host, '! dm holding | kind: month');
    assert.equal(holding(host).loyalty, 49);
    await rebuilt(host, 'months');
});

test('the retainer cap goes by tier, a marshal adds a fifth, a full holding refuses recruits and nobody is sent away', { skip }, async t => {
    const host = await chat(t);
    await stays(host, 'Mara');
    await say(host, '+ dm holding — hands | kind: recruit | n: 500');
    assert.deepEqual(pick(host, 'retainers', 'cap'), [20, 20]);
    await say(host, '+ dm holding — more | kind: recruit | n: 1');
    refused(host, 'Nobody can be recruited: the holding is full (20 retainers, cap 20)');
    await say(host, post('Mara', 'marshal'));
    assert.equal(holding(host).cap, 24);
    await say(host, '+ dm holding — more | kind: recruit | n: 9');
    assert.equal(holding(host).retainers, 24);
    await say(host, unpost('marshal'));
    assert.deepEqual(pick(host, 'retainers', 'cap'), [24, 20]);
    await say(host, '+ dm holding — more | kind: recruit | n: 1');
    assert.equal(holding(host).retainers, 24);
    for (const [tier, cap] of [[1, 60], [2, 150], [3, 400], [4, 1000], [5, 2500]]) {
        success(await host.sdk.command('dm.set', { module: ID, field: 'tier', value: tier }));
        assert.equal(holding(host).cap, cap, `tier ${tier}`);
    }
});

test('the post lines are taught in the tail once there is a seat and someone stayed behind, never in the static prompt; a spymaster is told to warn first', { skip }, async t => {
    const host = await chat(t, { seat: false });
    assert.equal(/kind: (un)?post/.test(grammarFor(host.head())), false);
    await say(host, 'x');
    assert.equal(sentTail(host).includes('kind: post'), false, 'no seat, nothing to stay at');
    await say(host, SEAT);
    await say(host, '+ present Mara', '+ party Mara');
    await say(host, 'x');
    assert.equal(sentTail(host).includes('kind: post'), false, 'nobody has stayed behind');
    await say(host, '- party Mara');
    await say(host, 'x');
    assert.ok(sentTail(host).includes('~ dm holding — reason | kind: post | post: steward|marshal|spymaster|healer|quartermaster|envoy | who: Name'), sentTail(host));
    assert.ok(sentTail(host).includes('~ dm holding | kind: unpost'));
    assert.equal(sentTail(host).includes('Spymaster'), false);
    await say(host, post('Mara', 'spymaster'));
    await say(host, 'x');
    assert.ok(sentTail(host).includes('posts: spymaster Mara'));
    assert.ok(sentTail(host).includes("Spymaster Mara: before an assassin's contract (the Hand's too) or a rival's move against the holding strikes, show Mara's warning reaching the player."));
    assert.equal(/kind: (un)?post/.test(grammarFor(host.head())), false);
});

test('all six posts under long names fit the holding\'s line, and the editor cannot type a holder', { skip }, async t => {
    const host = await chat(t);
    // (seven character sheets: at the default 8,192 the tail has no room for any module's line)
    host.st.contextSize = 65536;
    const names = ['Mara', 'Ilse', 'Dov', 'Pip', 'Kit', 'Lou'].map(name => `${name} of the Very Long Northern March`.slice(0, 40));
    for (const name of names) await stays(host, name);
    await say(host, ...['steward', 'marshal', 'spymaster', 'healer', 'quartermaster', 'envoy'].map((as, at) => post(names[at], as)));
    const line = summaryOf(host.head(), ID);
    assert.ok(line.endsWith(`envoy ${names[5]}.`), line);
    assert.ok(sentTail(host).length > 0);
    await say(host, 'x');
    assert.ok(sentTail(host).includes(line), 'the whole line is sent');
    const typed = await host.sdk.command('dm.set', { module: ID, field: 'steward', value: 'Zed' });
    assert.equal(typed.ok, false);
});

test('a posted companion who rejoins leaves the post on that reply; swipe, Re-read, delete, rebuild and reload agree', { skip }, async t => {
    const host = await chat(t);
    await stays(host, 'Mara');
    await say(host, post('Mara', 'steward'));
    await say(host, '+ party Mara', '+ dm holding — toll | kind: income | gold: 10');
    assert.equal(holding(host).steward, '');
    assert.ok(host.sdk.receipts().some(entry => entry.receipt.summary === 'Your Holding: Mara travels with You again and leaves the steward post.'));
    await rebuilt(host, 'rejoined');
    await host.swipe(reply('~ place Ravenhold'));
    assert.equal(holding(host).steward, 'Mara', 'the swipe takes the rejoin back');
    await rebuilt(host, 'swiped back');
    await host.swipe(reply('+ party Mara'));
    assert.equal(holding(host).steward, '');
    const last = host.ctx.chat.length - 1;
    assert.equal((await host.turn.reread(last)).ok, true);
    assert.equal(holding(host).steward, '');
    await rebuilt(host, 'Re-read');
    await host.st.editMessage(last, reply('~ place Ravenhold'));
    assert.equal((await host.turn.reread(last)).ok, true);
    assert.equal(holding(host).steward, 'Mara', 'the edit takes the rejoin back');
    await rebuilt(host, 'edited');
    await say(host, '+ party Mara');
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.equal(holding(host).steward, 'Mara', 'a deleted rejoin leaves the post');
    await rebuilt(host, 'deleted');
});

test('the reader\'s own return of a companion frees the post before the next reply is asked', { skip }, async t => {
    const host = await chat(t);
    await stays(host, 'Mara');
    await say(host, post('Mara', 'envoy'));
    success(await host.sdk.command('dm.set', { module: 'pack.chat/mara', field: 'left', value: false }));
    await say(host, 'x');
    assert.equal(holding(host).envoy, '');
    assert.equal(sentTail(host).includes('envoy Mara'), false);
    await rebuilt(host, 'returned by hand');
});

test('deleting the reply where they stayed behind takes the post with it, and rebuild and reload agree', { skip }, async t => {
    const host = await chat(t);
    await stays(host, 'Mara');
    const left = host.ctx.chat.length - 1;
    await say(host, post('Mara', 'steward'));
    await host.st.deleteMessage(left);
    assert.equal(holding(host).steward, '', 'they never stayed, so the post line is not applied');
    assert.ok(host.store.problems().length > 0, 'and the story says so');
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
    await host.st.loadChat(structuredClone(host.ctx.chat));
    assert.equal(JSON.stringify(host.head()), live);
});

test('a post line witnesses the seat: moving the seat in an earlier reply leaves the post unapplied, and rebuild agrees', { skip }, async t => {
    const host = await chat(t, { seat: false });
    await say(host, SEAT);
    const seated = host.ctx.chat.length - 1;
    await stays(host, 'Mara');
    await say(host, post('Mara', 'steward'));
    assert.equal(holding(host).steward, 'Mara');
    await host.st.editMessage(seated, reply('~ dm holding — they chose the mill | kind: seat | at: The Old Mill'));
    assert.equal((await host.turn.reread(seated)).ok, true);
    assert.deepEqual(pick(host, 'seat', 'steward'), ['The Old Mill', '']);
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
    await host.st.loadChat(structuredClone(host.ctx.chat));
    assert.equal(JSON.stringify(host.head()), live);
});

test('the tracker card and the Holding screen show the six posts and the retainer cap, none of them editable', { skip }, async t => {
    const host = await chat(t);
    await stays(host, 'Mara');
    await say(host, post('Mara', 'healer'));
    const card = selectStory((name, args) => { try { return host.sdk.query(name, args); } catch { return null; } }).trackers.find(row => row.id === ID);
    const shown = Object.fromEntries(card.fields.map(field => [field.label, field]));
    const labels = ['Steward', 'Marshal', 'Spymaster', 'Healer or chaplain', 'Quartermaster', 'Envoy', 'Retainer cap'];
    assert.deepEqual(labels.map(label => shown[label]?.edit ?? null), labels.map(() => null));
    assert.equal(shown['Healer or chaplain'].value, 'Mara');
    const screen = host.sdk.query('dataModules.presentation', { kind: 'screens' }).find(entry => entry.id === 'ersveil-holding');
    for (const key of ['cap', 'steward', 'marshal', 'spymaster', 'healer', 'quartermaster', 'envoy']) assert.ok(screen.layout.root.props.fields.includes(key), key);
});
