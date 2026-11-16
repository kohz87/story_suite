// The clockFace rule on a whole Story Block host (batch 1, R0-R5): a marked reply reads its time lines by the clock-face rules and comes out the same
// after Re-read, swipe, edit, Continue and a rebuild; a reply without the mark keeps its old reading; the tail reminds after three quiet replies.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../vendor/story-block/testkit/index.js';
import { createModule } from '../../../src/v2/module.js';

const TAIL_KEY = 'story_suite_tail_1';
const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const quiet = t => t.mock.method(console, 'warn', () => {});
const clock = host => host.sdk.query('director.time').text;
const recordOf = (host, index = host.ctx.chat.length - 1) => host.ctx.chat[index].extra.storySuite;
const problems = host => Object.values(host.head().domains.director.problems ?? {}).map(problem => problem.text).join(' ');
const tails = host => host.st.promptLog.filter(entry => entry.key === TAIL_KEY && entry.value).map(entry => entry.value);

async function newHost() {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), chat: () => host?.ctx.chat ?? [] } });
    host = await createHost({ modules: [module] });
    return host;
}

async function marked(t) {
    quiet(t);
    const host = await newHost();
    t.after(() => host.close());
    await host.send('Begin.', reply('The road.', ['~ time March 3, 1200, 04:50 pm']));
    await host.send('We wait.', reply('Dusk.', ['~ time 4:45 pm']));
    return host;
}

test('a reply written now carries the mark; a clock face that goes back is refused with a Problem and the clock stays', async t => {
    const host = await marked(t);
    assert.ok(recordOf(host).rules.includes('clockFace'));
    assert.equal(clock(host), 'March 3, 1200, 04:50 pm');
    assert.match(problems(host), /"~ time 4:45 pm" is earlier than the story time \(March 3, 1200, 04:50 pm\); the clock never goes back/);
    await host.send('Later.', reply('Night.', ['~ time 8:00 pm']));
    assert.equal(clock(host), 'March 3, 1200, 08:00 pm');
    await host.send('Sleep.', reply('Morning.', ['! time next morning']));
    assert.equal(clock(host), 'March 4, 1200, 09:00 am');
});

test('R0: a reply whose record lacks the mark reads the line as before (the next day), the same on every Re-read', async t => {
    const host = await marked(t);
    const index = host.ctx.chat.length - 1;
    recordOf(host).rules = recordOf(host).rules.filter(rule => rule !== 'clockFace');
    const result = await host.turn.reread(index);
    assert.equal(result.ok, true, result.message);
    const first = JSON.stringify(host.head());
    assert.equal(clock(host), 'March 4, 1200, 04:45 pm');
    await host.turn.reread(index);
    assert.equal(JSON.stringify(host.head()), first);
});

test('R1: Re-read gives the same head and the same Problem', async t => {
    const host = await marked(t);
    const head = JSON.stringify(host.head()), seen = problems(host);
    await host.turn.reread(host.ctx.chat.length - 1);
    assert.equal(JSON.stringify(host.head()), head);
    assert.equal(problems(host), seen);
});

test('R2: a swipe reads its own line, and going back to the first swipe restores its state', async t => {
    const host = await marked(t);
    const index = host.ctx.chat.length - 1, first = JSON.stringify(host.head());
    await host.swipe(reply('Dusk again.', ['~ time 6:00 pm']));
    assert.equal(clock(host), 'March 3, 1200, 06:00 pm');
    const second = JSON.stringify(host.head());
    await host.st.swipeTo(index, 0);
    assert.equal(JSON.stringify(host.head()), first);
    await host.st.swipeTo(index, 1);
    assert.equal(JSON.stringify(host.head()), second);
});

test('R3: a prose edit changes nothing; an edit of the line is read once from the new line', async t => {
    const host = await marked(t);
    const index = host.ctx.chat.length - 1, head = JSON.stringify(host.head());
    await host.st.editMessage(index, reply('Other words.', ['~ time 4:45 pm']));
    await host.turn.reread(index);
    assert.equal(JSON.stringify(host.head()), head);
    await host.st.editMessage(index, reply('Dusk.', ['~ time 5:15 pm']));
    await host.turn.reread(index);
    assert.equal(clock(host), 'March 3, 1200, 05:15 pm');
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
});

test('R4: Continue applies nothing twice', async t => {
    const host = await marked(t);
    await host.cont('\n\nMore words.');
    assert.equal(clock(host), 'March 3, 1200, 04:50 pm');
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
});

test('R5: deleting an earlier message and reloading gives the hash built live', async t => {
    const host = await marked(t);
    await host.send('Later.', reply('Night.', ['~ time 8:00 pm']));
    await host.st.deleteMessage(1);
    await host.turn.onChatChanged();
    const rebuilt = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), rebuilt);
    await host.st.loadChat(structuredClone(host.ctx.chat));
    assert.equal(JSON.stringify(host.head()), rebuilt);
});

test('the tail reminds after three replies without a time line, and the reminder goes away when the story writes one', async t => {
    quiet(t);
    const host = await newHost();
    t.after(() => host.close());
    const CUE = /Story time: no time line for \d+ replies; if time has passed, write ~ time <clock> or ! time \+<how long>\./;
    await host.send('Begin.', reply('The road.', ['~ time March 3, 1200, 04:50 pm']));
    for (const n of [1, 2, 3]) await host.send(`Step ${n}.`, reply(`Walk ${n}.`));
    await host.send('Step 4.', reply('Walk 4.'));
    const sent = tails(host);
    assert.doesNotMatch(sent.at(-4), CUE, 'two quiet replies: no cue yet');
    assert.match(sent.at(-1), CUE);
    await host.send('Rest.', reply('Rest.', ['! time +1h']));
    await host.send('Next.', reply('Next.'));
    assert.doesNotMatch(tails(host).at(-1), CUE);
});
