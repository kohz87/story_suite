// Pack file ids are read by a chat's day steps only when the chat's first step ran with them (`daily.placeIds`): a chat first stepped
// on an older build keeps the old literal lookup, also on a Re-read, so its saved history stays in step with itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occurrences } from '../../../../modules/world/daily/anchors.js';
import { withMapName } from '../../../../modules/world/daily/anchor-ref.js';
import { makeWs } from '../../../../modules/world/daily/step.js';
import { overrideWorld } from '../../../../modules/world/chronicle/world-daily/read-world.js';
import { validateDaily } from '../../../../modules/world/chronicle/world-daily/validate.js';
import { agrees, chronicle, dailyOf, dailyReceipts, newHost, reply } from './daily-host.helpers.js';

const PACK = JSON.stringify({
    id: 'world-ids', version: '1.0.0', name: 'World ids', format: 4, kind: 'world', requires: { suite: '^0.1' },
    content: {
        places: [{ id: 'deep-hold', name: 'Deepmantle Hold', region: 'The March', x: 0, y: 0, kind: 'town' }],
        conditions: [{ name: 'unrest', scope: 'place', fades: '60 days', means: 'Crowds in the streets.' }],
    },
});
const beat = (id, after, effects) => ({ id, kind: 'one-off', certainty: 'set-in-motion', where: ['Deepmantle Hold'], window: { after, within: '2 days' }, ends_when: 'instant', effects, summary: `The ${id}.` });
// The riot names the place by its display name (so it fires either way) and sets a condition by the file id; the march waits on that.
const EVENTS = { events: [beat('riot', 'start + 2 days', { set: ['unrest@deep-hold: 30 days'] }), beat('march', 'set:unrest@deep-hold', {})] };
const FROM_START = { events: [], startWorld: { set: ['unrest@deep-hold'], facts: [] } };

const on = (day, text = 'A day.') => reply(text, [`~ time June ${day}, 1200, 08:00 am`]);
const keys = host => Object.keys(chronicle(host).conditions ?? {});
const fired = (host, id) => dailyOf(host).events[id]?.fired !== undefined;
const story = host => JSON.stringify(chronicle(host));
const marksOf = (host, at) => host.ctx.chat[at].extra.storySuite.rules;

const forget = value => {
    if (!value || typeof value !== 'object') return;
    delete value.placeIds;
    Object.values(value).forEach(forget);
};

/** `run()` as the older build ran it: no file ids on the map, no rule marks on the reply, no `placeIds` in anything stored. */
async function older(host, spec, run) {
    const undo = overrideWorld(world => ({ ...world, ...spec, places: world.places.map(({ slug, ...place }) => place) }));
    const setter = host.store.setRuleMarks;
    host.store.setRuleMarks = () => { throw new Error('old build'); };
    try { await run(); } finally {
        host.store.setRuleMarks = setter;
        undo();
    }
    overrideWorld(world => ({ ...world, ...spec }));
    for (const message of host.ctx.chat) forget(message.extra);
    host.store.rebuild();
}

async function withHost(spec, run) {
    const host = await newHost(true, spec, undefined, PACK);
    try { await run(host); } finally { host.done(); }
}

test('an old chat: a Re-read of an unchanged reply gives the old result, and later steps agree with it', () => withHost(EVENTS, async host => {
    await older(host, EVENTS, async () => {
        await host.send('Begin.', on(3));
        await host.send('Wait.', on(8));
    });
    const at = host.ctx.chat.length - 1;
    assert.equal(fired(host, 'riot'), true);
    assert.equal('placeIds' in dailyOf(host), false);
    assert.deepEqual(keys(host), []);
    const before = story(host);
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(story(host), before);
    await host.send('Wait more.', on(14));
    assert.equal('placeIds' in dailyOf(host), false);
    assert.deepEqual(keys(host), []);
    assert.equal(fired(host, 'march'), false);
    assert.equal(Object.keys(dailyOf(host).anchors).some(key => key.startsWith('set:')), false);
    await agrees(host, 'old chat');
}));

test('an old chat: a Re-read of the reply with its very first step, with later replies, stays the old way', () => withHost(FROM_START, async host => {
    await older(host, FROM_START, () => host.send('Begin.', on(3)));
    const at = host.ctx.chat.length - 1;
    await older(host, FROM_START, () => host.send('Wait.', on(5)));
    assert.deepEqual(keys(host), []);
    const before = story(host);
    for (const pass of ['first', 'second']) {
        assert.equal((await host.turn.reread(at)).ok, true);
        assert.equal(story(host), before, pass);
    }
    await host.send('Wait more.', on(9));
    assert.equal('placeIds' in dailyOf(host), false);
    assert.deepEqual(keys(host), []);
    await agrees(host, 'old first step');
}));

test('an old chat: a Re-read of its only reply makes the first step the old way again', () => withHost(FROM_START, async host => {
    await older(host, FROM_START, () => host.send('Begin.', on(3)));
    assert.equal((await host.turn.reread(host.ctx.chat.length - 1)).ok, true);
    assert.equal('placeIds' in dailyOf(host), false);
    assert.deepEqual(keys(host), []);
    await agrees(host, 'old only reply');
}));

test('a new chat takes the flag at its first step, reads file ids, and keeps both through Re-read, rebuild and reload', () => withHost(EVENTS, async host => {
    await host.send('Begin.', on(3));
    assert.equal(dailyOf(host).placeIds, 1);
    const first = host.ctx.chat.length - 1;
    await host.send('Wait.', on(8));
    const second = host.ctx.chat.length - 1;
    await host.send('Wait more.', on(14));
    assert.deepEqual(keys(host), ['unrest@Deepmantle Hold']);
    assert.equal(fired(host, 'march'), true);
    assert.equal(dailyOf(host).placeIds, 1);
    assert.ok(dailyReceipts(host).every(entry => entry.receipt.data.placeIds === 1));
    const before = story(host);
    for (const at of [first, second]) {
        assert.equal((await host.turn.reread(at)).ok, true);
        assert.equal(dailyOf(host).placeIds, 1);
    }
    assert.deepEqual(keys(host), ['unrest@Deepmantle Hold']);
    assert.equal(JSON.stringify(chronicle(host).daily), JSON.stringify(JSON.parse(before).daily));
    await agrees(host, 'new chat');
}));

test('a new chat: the first step Re-read keeps the flag by the reply\'s rule mark when its receipt data is gone', () => withHost(FROM_START, async host => {
    await host.send('Begin.', on(3));
    const at = host.ctx.chat.length - 1;
    await host.send('Wait.', on(5));
    assert.ok(marksOf(host, at).includes('packPlaceIds'));
    // The store drops a far-back reply's receipt `data` (receiptKeep).
    for (const receipt of host.ctx.chat[at].extra.storySuite.receipts) delete receipt.data;
    host.store.rebuild();
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(dailyOf(host).placeIds, 1);
    assert.deepEqual(keys(host), ['unrest@Deepmantle Hold']);
    await agrees(host, 'mark only');
}));

test('the stored state takes placeIds as 1 or not at all', () => {
    const state = { seed: 's', day: 2, start: 1, minors: [], events: {}, anchors: {}, lastMajor: {}, cast: {}, standings: {}, facts: {}, masks: {}, cooldowns: {} };
    for (const good of [state, { ...state, placeIds: 1 }]) assert.deepEqual(validateDaily([good]), []);
    assert.match(validateDaily([{ ...state, placeIds: true }])[0], /placeIds/);
});

test('a state without the flag reads homes, anchors and untils as written, aliases and letter case included', () => {
    const world = {
        places: [{ id: 'pack.p/deep-hold', slug: 'deep-hold', name: 'Deepmantle Hold', aliases: ['The Hold'], region: 'The March', kind: 'town' }],
        conditions: [{ name: 'unrest', scope: 'place' }],
        cast: [{ id: 'bram', name: 'Bram', homeBase: 'The Hold' }],
    };
    const read = placeIds => {
        const state = { seed: 's', day: 1, start: 1, anchors: { 'set:unrest@Deepmantle Hold': [1] }, ...(placeIds ? { placeIds } : {}) };
        const { ws } = makeWs({ state, world, today: 2 });
        return {
            home: ws.people.get('bram').home, until: withMapName(ws, 'unrest@deepmantle hold'),
            days: ['unrest@The Hold', 'unrest@deep-hold'].map(id => occurrences(ws, { kind: 'set', id })),
        };
    };
    assert.deepEqual(read(undefined), { home: 'The Hold', until: 'unrest@deepmantle hold', days: [[], []] });
    assert.deepEqual(read(1), { home: 'Deepmantle Hold', until: 'unrest@Deepmantle Hold', days: [[1], [1]] });
});
