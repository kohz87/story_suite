// A narrator condition naming an installed pack's place by its file id: taken on a reply captured with the rule mark `packPlaceIds`;
// a reply with no mark refuses it, and still does on a Re-read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agrees, chronicle, newHost, reply } from './daily-host.helpers.js';

const PACK = JSON.stringify({
    id: 'world-ids', version: '1.0.0', name: 'World ids', format: 4, kind: 'world', requires: { suite: '^0.1' },
    content: {
        places: [{ id: 'deep-hold', name: 'Deepmantle Hold', region: 'The March', x: 0, y: 0, kind: 'town' }],
        conditions: [{ name: 'unrest', scope: 'place', fades: '10 days', means: 'Crowds in the streets.' }],
    },
});
const riot = (conditions, place = 'deep-hold') => reply('The square fills.', [`+ world Bread Riots — crowds fill the square | state: ongoing | place: ${place} | conditions: ${conditions}`]);
const keys = host => Object.keys(chronicle(host).conditions ?? {});
const marksOf = (host, at) => host.ctx.chat[at].extra.storySuite.rules;

async function start() {
    const host = await newHost(true, {}, undefined, PACK);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    return host;
}
/** `send` as a reply captured before the rule existed: no marks are written on it. */
async function unmarked(host, text) {
    const setter = host.store.setRuleMarks;
    host.store.setRuleMarks = () => { throw new Error('old reply'); };
    await host.send('Look.', text);
    host.store.setRuleMarks = setter;
    const at = host.ctx.chat.length - 1;
    assert.equal(marksOf(host, at), undefined);
    return at;
}

for (const [label, text] of [['the line\'s place', riot('+unrest')], ['name@ref', riot('+unrest@deep-hold', 'The square')]]) {
    test(`a new reply takes a file id from ${label}, and keeps it through Re-read, rebuild and reload`, async () => {
        const host = await start();
        try {
            await host.send('Look.', text);
            const at = host.ctx.chat.length - 1;
            assert.ok(marksOf(host, at).includes('packPlaceIds'));
            assert.deepEqual(keys(host), ['unrest@Deepmantle Hold']);
            assert.equal((await host.turn.reread(at)).ok, true);
            assert.deepEqual(keys(host), ['unrest@Deepmantle Hold']);
            await agrees(host, label);
        } finally { host.done(); }
    });

    test(`a reply with no mark refuses a file id from ${label}, and its Re-read still does`, async () => {
        const host = await start();
        try {
            const at = await unmarked(host, text);
            assert.deepEqual(keys(host), []);
            assert.equal((await host.turn.reread(at)).ok, true);
            assert.deepEqual(keys(host), []);
            assert.equal(marksOf(host, at), undefined);
            await agrees(host, label);
        } finally { host.done(); }
    });
}

test('lifting by file id: a reply with no mark leaves the condition, also on Re-read; a new reply lifts it', async () => {
    const host = await start();
    try {
        await host.send('Look.', riot('+unrest', 'Deepmantle Hold'));
        const at = await unmarked(host, riot('-unrest@deep-hold'));
        assert.deepEqual(keys(host), ['unrest@Deepmantle Hold']);
        assert.equal((await host.turn.reread(at)).ok, true);
        assert.deepEqual(keys(host), ['unrest@Deepmantle Hold']);
        await host.send('Again.', riot('-unrest@deep-hold'));
        assert.deepEqual(keys(host), []);
    } finally { host.done(); }
});
