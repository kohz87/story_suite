// createModule's learn() sets env.textRpg: true with Text RPG on and the RPG off (the roll line leaves the static text), false with the RPG on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newHost, reply, sent } from './helpers/host.js';

const CHECK = /^\? roll /m;

test('env.textRpg is true while Text RPG is on with the RPG off: the roll grammar line is left out', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await newHost();
    try {
        await host.send('Go.', reply('Fine.'));
        const [text] = sent(host, 'story_suite_static');
        assert.match(text, /^\? try Who /m);
        assert.doesNotMatch(text, CHECK);
    } finally {
        host.close();
    }
});

test('env.textRpg is false with the RPG on: the roll grammar line stays', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await newHost({ 'story-block.rpg': true });
    try {
        await host.send('Go.', reply('Fine.'));
        const [text] = sent(host, 'story_suite_static');
        assert.match(text, CHECK);
        assert.doesNotMatch(text, /^\? try Who /m);
    } finally {
        host.close();
    }
});
