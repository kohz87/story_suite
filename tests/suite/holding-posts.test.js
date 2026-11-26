// Your Holding's officer posts on the real suite (Story Block, Story Director with the cast and World events, NPC State): the cast's own
// "waits for You at <place>" record decides who is staying at the seat, and rejoining frees the post.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSuite, suiteHost } from './break/helpers/suite.js';

const loaded = await loadSuite();
const skip = loaded.skip ?? false;
const ID = 'pack.ersveil-game/holding';
const NAME = 'Sister Temiwa';
const POST = '~ dm holding — Temiwa keeps the books | kind: post | post: steward | who: Temiwa';

async function start(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await suiteHost(loaded, { settings: { modules: { 'story-director': { 'tracker.maxJump': 60 }, 'story-block': { rpgJoin: 'auto' } } } });
    t.after(() => host.close());
    for (const id of ['story-block.rpg', 'story-director.cast', 'story-director.world-events']) host.features.set(id, true);
    const templates = await loaded.at('modules/rpg/templates.js');
    const hero = structuredClone(templates.CHOOSER_TEMPLATES.find(entry => entry.definition.role === 'character').definition);
    Object.assign(hero, { slug: 'hero', name: 'Hero' });
    hero.state.who.default = 'Astra';
    assert.equal((await host.cmd('dm.define', { definition: hero })).ok, true);
    const offer = host.q('dataModules.offers').find(row => row.module === ID);
    assert.equal((await host.cmd('dm.pin', { module: ID, hash: offer.hash, packHash: offer.packHash, subjects: [] })).ok, true);
    await say(host, '! time March 29, 1200, 08:00 am', '~ place Ravenhold | kind: settlement', `+ present ${NAME}`);
    await say(host, `+ party ${NAME} | about: a clerk | class: I | best: int`, '+ dm holding — Founded | kind: found | type: fief | name: Ravenhold', '~ dm holding — built | kind: seat | at: Ravenhold');
    // NPC State's dossier for the pack person (the harness runs no fill-in that would make it).
    const key = Object.keys(host.head().domains.cast.people).find(each => each.endsWith(':temiwa'));
    const { seedPeople } = await loaded.at('tests/people/helpers/seed-people.js');
    await seedPeople(host.sdk, host.store, { npc_temiwa: { id: 'npc_temiwa', name: NAME, aliases: ['Temiwa'], present: true, memories: [], memoryStamps: {}, castFrom: { key, id: 'temiwa' } } });
    await say(host, '! time +5m');
    return host;
}
async function say(host, ...lines) {
    await host.send('On.', host.reply('Quiet.', lines));
    for (let turn = 0; turn < 20; turn += 1) await new Promise(resolve => setImmediate(resolve));
}
const holding = host => host.q('dataModules.view', { module: ID }).chat;
const record = host => Object.values(host.head().domains.cast.people).find(person => person.name === NAME).base?.[0] ?? null;
const refused = (host, text) => assert.ok(host.turn.problems().some(problem => problem.message.includes(`Your Holding: ${text}`)), host.turn.problems().map(problem => problem.message).join('\n'));
async function same(host, label) {
    const live = JSON.stringify(host.head().domains.dataModules);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains.dataModules), live, `${label}: rebuild equals live`);
    await host.st.loadChat(structuredClone(host.ctx.chat));
    assert.equal(JSON.stringify(host.head().domains.dataModules), live, `${label}: a reload equals live`);
}

test('the stays record at the seat gives the post while You are elsewhere; rejoining frees it and a swipe gives it back', { skip, timeout: 120000 }, async t => {
    const host = await start(t);
    await say(host, `- party ${NAME}`);
    assert.deepEqual([record(host).at, record(host).by], ['Ravenhold', 'stays']);
    await say(host, '~ place Highmark | kind: town', `- present ${NAME}`);
    await say(host, POST);
    assert.equal(holding(host).steward, NAME, host.turn.problems().map(problem => problem.message).join('\n'));
    await same(host, 'posted');
    await say(host, `+ party ${NAME}`);
    assert.equal(holding(host).steward, '');
    assert.equal(record(host), null, 'they travel with You again');
    await same(host, 'rejoined');
    await host.swipe(host.reply('Not yet.', ['! time +5m']));
    assert.equal(holding(host).steward, NAME);
    await same(host, 'swiped');
});

test('a stays record somewhere else refuses the post and says where they are', { skip, timeout: 120000 }, async t => {
    const host = await start(t);
    await say(host, '~ place Highmark | kind: town');
    await say(host, `- party ${NAME}`);
    assert.deepEqual([record(host).at, record(host).by], ['Highmark Capital', 'stays']);
    await say(host, '~ place Auvoth | kind: town', `- present ${NAME}`);
    await say(host, POST);
    refused(host, `${NAME} is at Highmark Capital, not at the seat (Ravenhold)`);
    assert.equal(holding(host).steward, '');
});

test('leaving and taking a post in one reply at the seat works, before the cast has written its record', { skip, timeout: 120000 }, async t => {
    const host = await start(t);
    await say(host, `- party ${NAME}`, POST);
    assert.equal(holding(host).steward, NAME, host.turn.problems().map(problem => problem.message).join('\n'));
    await same(host, 'one reply');
    assert.equal((await host.turn.reread(host.ctx.chat.length - 1)).ok, true);
    assert.equal(holding(host).steward, NAME, 'a Re-read keeps it');
    await same(host, 'Re-read');
});
