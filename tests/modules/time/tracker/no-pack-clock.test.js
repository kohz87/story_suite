// The story clock with no pack (F8W-4): the story's `~ time 9:30 am` / `! time next morning` start and move the clock from the calendar's
// default start, and every replay path (swipe, swipe back, Re-read edited, middle delete, reload, rebuild) reads the same as live.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../ui/legacy/director/module.js';
import { makeState, reply as run } from './helpers/fake-ctx.js';

const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const quiet = t => t.mock.method(console, 'warn', () => {});
const clock = host => host.sdk.query('director.time').text;
const minutes = host => host.sdk.query('director.time').minutes;
const problems = host => Object.values(host.head().domains.director.problems ?? {}).map(problem => problem.text).join(' ');

async function begun(t) {
    quiet(t);
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), chat: () => host?.ctx.chat ?? [] } });
    host = await createHost({ modules: [module] });
    t.after(() => host.close());
    await host.send('Begin.', reply('The road.', ['~ time 9:30 am']));
    await host.send('Sleep.', reply('Night.', ['~ time 9:00 pm']));
    await host.send('Rest.', reply('Morning.', ['! time next morning']));
    return host;
}

test('no pack: a bare clock time starts the story clock, and a skip moves it on (not "not used")', async t => {
    const host = await begun(t);
    assert.equal(problems(host), '');
    assert.match(clock(host), /^January 2, 1, 09:00 am$/);
    const state = run(makeState(), '~ time 9:30 am').state.domains.director.time.minutes;
    assert.equal(Number.isInteger(state), true, 'the fake-ctx reply path too');
});

test('no pack: a date the calendar cannot read is still refused; a real date after a bare time sets the clock, not held to 30 days', async t => {
    const unread = run(makeState(), '~ time 2026-11-17 9:30 am').state.domains.director;
    assert.equal(unread.time.minutes, null, 'no day to guess: still refused');
    assert.match(Object.values(unread.problems).map(problem => problem.text).join(' '), /2026-11-17/);
    const host = await begun(t);
    await host.send('Date.', reply('Years on.', ['~ time March 3, 1200, 08:00 am']));
    assert.equal(clock(host), 'March 3, 1200, 08:00 am');
});

test('no pack: swipe, swipe back, edited Re-read (grown, shrunk), middle delete, reload and rebuild equal live', async t => {
    const host = await begun(t);
    const last = host.ctx.chat.length - 1;
    const first = JSON.stringify(host.head());
    await host.swipe(reply('Noon.', ['! time +2h']));
    assert.equal(clock(host), 'January 1, 1, 11:00 pm');
    await host.st.swipeTo(last, 0);
    assert.equal(JSON.stringify(host.head()), first, 'swipe back equals the first state');
    // An edited Re-read: the line grows (a second line), then shrinks (no line).
    await host.st.editMessage(last, reply('Morning.', ['! time next morning', '! time +1h']));
    await host.turn.reread(last);
    const grown = minutes(host);
    assert.equal(grown, JSON.parse(first).domains.director.time.minutes + 60);
    host.store.rebuild();
    assert.equal(minutes(host), grown, 'rebuild equals live (grown)');
    await host.st.editMessage(last, reply('Morning.'));
    await host.turn.reread(last);
    assert.match(clock(host), /^January 1, 1, 09:00 pm$/, 'shrunk: the reply before it');
    const shrunk = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), shrunk);
    // A middle delete (the first reply: the clock restarts from the second reply's own bare time) and a reload.
    await host.st.deleteMessage(1);
    await host.turn.onChatChanged();
    const cut = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), cut);
    await host.st.loadChat(structuredClone(host.ctx.chat));
    assert.equal(JSON.stringify(host.head()), cut, 'reload equals live');
});
