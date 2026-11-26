// A world pack's day steps find places by file id only when the pack says `"placeIds": true`. One that does not (Ersveil's shape)
// keeps the literal lookup everywhere, so Re-read, Continue, trimmed receipts and swipes have no older mode to remember.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overrideWorld } from '../../../../modules/world/chronicle/world-daily/read-world.js';
import { agrees, chronicle, dailyOf, dailyReceipts, newHost, reply } from './daily-host.helpers.js';

const pack = (id, extra = {}) => JSON.stringify({
    id, version: '1.0.0', name: id, format: 4, kind: 'world', requires: { suite: '^0.1' }, ...extra,
    content: {
        places: [{ id: 'deep-hold', name: 'Deepmantle Hold', region: 'The March', x: 0, y: 0, kind: 'town' }],
        conditions: [{ name: 'unrest', scope: 'place', fades: '60 days', means: 'Crowds in the streets.' }],
    },
});
const PLAIN = pack('world-plain');
const OPTED = pack('world-opted', { placeIds: true });
const beat = (id, after, effects) => ({ id, kind: 'one-off', certainty: 'set-in-motion', where: ['Deepmantle Hold'], window: { after, within: '2 days' }, ends_when: 'instant', effects, summary: `The ${id}.` });
// The riot names the place by its display name (so it fires either way) and sets a condition by the file id; the march waits on that.
const EVENTS = { events: [beat('riot', 'start + 2 days', { set: ['unrest@deep-hold: 30 days'] }), beat('march', 'set:unrest@deep-hold', {})] };
// The start world sets the condition by file id on the chat's first step, and the march waits on it.
const START_MARCH = { events: [beat('march', 'set:unrest@deep-hold', {})], startWorld: { set: ['unrest@deep-hold'], facts: [] } };

const on = (day, text = 'A day.') => reply(text, [`~ time June ${day}, 1200, 08:00 am`]);
const keys = host => Object.keys(chronicle(host).conditions ?? {});
const fired = (host, id) => dailyOf(host).events[id]?.fired !== undefined;
// (a condition's `rev` is the number of the write that made it, which a Re-read gives again)
const story = host => JSON.stringify(chronicle(host), (key, value) => (key === 'rev' ? undefined : value));
const marksOf = (host, at) => host.ctx.chat[at].extra.storySuite.rules;

/** No file id was read: no condition was set by one, nothing waiting on it fired, and no `set:` anchor was kept. */
function literal(host, label) {
    assert.deepEqual(keys(host), [], label);
    assert.equal(fired(host, 'march'), false, label);
    assert.equal(Object.keys(dailyOf(host).anchors).some(key => key.startsWith('set:')), false, label);
    assert.equal('placeIds' in dailyOf(host), false, label);
    assert.ok(dailyReceipts(host).every(entry => entry.receipt.data?.placeIds === undefined), label);
}

/** `run()` as a build before file ids ran it: no file ids on the map, no rule marks on the reply. */
async function older(host, spec, run) {
    const undo = overrideWorld(world => ({ ...world, ...spec, places: world.places.map(({ slug, ...place }) => place) }));
    const setter = host.store.setRuleMarks;
    host.store.setRuleMarks = () => { throw new Error('old build'); };
    try { await run(); } finally {
        host.store.setRuleMarks = setter;
        undo();
        overrideWorld(world => ({ ...world, ...spec }));
    }
}

async function withHost(spec, json, run) {
    const host = await newHost(true, spec, undefined, json);
    try { await run(host); } finally { host.done(); }
}

async function rereadSame(host, at, label) {
    const before = story(host);
    assert.equal((await host.turn.reread(at)).ok, true, label);
    assert.equal(story(host), before, label);
}

test('no opt-in, an older chat: a Re-read of its replies changes nothing, and later steps stay literal', () => withHost(EVENTS, PLAIN, async host => {
    await older(host, EVENTS, () => host.send('Begin.', on(3)));
    const first = host.ctx.chat.length - 1;
    await older(host, EVENTS, () => host.send('Wait.', on(8)));
    assert.equal(fired(host, 'riot'), true);
    literal(host, 'as stored');
    await rereadSame(host, first, 'first step');
    await rereadSame(host, host.ctx.chat.length - 1, 'last reply');
    await host.send('Wait more.', on(14));
    literal(host, 'a later step');
    await agrees(host, 'older chat');
}));

test('no opt-in, a new chat on this build reads no file id either, and a Re-read, rebuild and reload agree', () => withHost(EVENTS, PLAIN, async host => {
    await host.send('Begin.', on(3));
    await host.send('Wait.', on(8));
    const at = host.ctx.chat.length - 1;
    await host.send('Wait more.', on(14));
    assert.ok(marksOf(host, at).includes('packPlaceIds'), 'the reply is marked: the pack is what keeps it literal');
    assert.equal(fired(host, 'riot'), true);
    literal(host, 'live');
    await rereadSame(host, host.ctx.chat.length - 1, 'last reply');
    assert.equal((await host.turn.reread(at)).ok, true);
    literal(host, 'after a Re-read');
    await agrees(host, 'new chat, no opt-in');
}));

const RECEIPT_KEEP_REPLIES = 200;
const dailyAt = (host, at) => host.ctx.chat[at].extra.storySuite.receipts.filter(receipt => receipt.type === 'chronicle.world.daily');

test('no opt-in: a first step made by Continue on an old reply stays literal once its receipt data is trimmed', () => withHost(START_MARCH, PLAIN, async host => {
    await older(host, START_MARCH, () => host.send('Begin.', 'No date yet.'));
    const at = host.ctx.chat.length - 1;
    assert.equal(dailyOf(host), null);
    await host.cont(`\n${on(3)}`);
    assert.equal(host.ctx.chat.length - 1, at);
    await host.send('Wait.', on(8));
    literal(host, 'live');
    for (let n = 0; n < RECEIPT_KEEP_REPLIES; n += 1) await host.send('On.', 'A quiet hour.');
    assert.ok(dailyAt(host, at).length > 0);
    assert.ok(dailyAt(host, at).every(receipt => receipt.data === undefined), 'the receipt data is trimmed');
    await rereadSame(host, at, 'trimmed');
    literal(host, 'after the Re-read');
    await host.send('Wait more.', on(14));
    literal(host, 'a later step');
    await agrees(host, 'continued first step');
}));

test('no opt-in: a swipe that starts the world again does not change what the first swipe reads', () => withHost(START_MARCH, PLAIN, async host => {
    await older(host, START_MARCH, () => host.send('Begin.', on(3)));
    const at = host.ctx.chat.length - 1;
    const original = story(host);
    await host.swipe('No date.');
    await host.swipe(on(8));
    literal(host, 'the later swipe');
    await agrees(host, 'later swipe');
    await host.st.swipeTo(at, 0);
    assert.equal(story(host), original, 'swiped back');
    await rereadSame(host, at, 'Re-read of the first swipe');
    literal(host, 'after the Re-read');
    await agrees(host, 'swiped back');
}));

test('opted in: the day step reads file ids; Re-read, rebuild and reload keep the same result', () => withHost(EVENTS, OPTED, async host => {
    await host.send('Begin.', on(3));
    const first = host.ctx.chat.length - 1;
    await host.send('Wait.', on(8));
    const second = host.ctx.chat.length - 1;
    await host.send('Wait more.', on(14));
    assert.deepEqual(keys(host), ['unrest@Deepmantle Hold']);
    assert.equal(fired(host, 'march'), true);
    assert.equal('placeIds' in dailyOf(host), false, 'nothing about it is kept in the chat');
    const daily = JSON.stringify(chronicle(host).daily);
    for (const at of [first, second]) assert.equal((await host.turn.reread(at)).ok, true);
    assert.deepEqual(keys(host), ['unrest@Deepmantle Hold']);
    assert.equal(JSON.stringify(chronicle(host).daily), daily);
    await agrees(host, 'opted in');
}));

test('opted in: the first step reads file ids through a swipe and swipe back', () => withHost(START_MARCH, OPTED, async host => {
    await host.send('Begin.', on(3));
    const at = host.ctx.chat.length - 1;
    const original = story(host);
    assert.deepEqual(keys(host), ['unrest@Deepmantle Hold']);
    await host.swipe('No date.');
    await host.swipe(on(8));
    assert.deepEqual(keys(host), ['unrest@Deepmantle Hold']);
    await host.st.swipeTo(at, 0);
    assert.equal(story(host), original);
    await rereadSame(host, at, 'Re-read of the first swipe');
    await agrees(host, 'opted in, swiped');
}));

test('an installed opted-in pack that is not the chat\'s world gives the selected one no file ids', () => withHost(START_MARCH, OPTED, async host => {
    const second = await host.packs.packs.install(PLAIN, { origin: 'plain.json' });
    assert.equal(second.ok, true, JSON.stringify(second.errors));
    assert.deepEqual(host.sdk.query('packs.content', { kind: 'placeIds' }), ['world-opted']);
    assert.equal(await host.packs.packs.select('world', 'world-plain'), true);
    assert.deepEqual(host.sdk.query('packs.content', { kind: 'placeIds' }), []);
    await host.send('Begin.', on(3));
    await host.send('Wait.', on(8));
    literal(host, 'the other world');
}));
