// The clockFace rule after a day jump (B1.1 fix): a time on the landing day is open, whatever the landing face; going back with no jump stays refused.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRESETS, makeCalendar } from '../../../src/calendar.js';
import { clockFaceAfter } from '../../../src/v2/tracker/time-parts/clock-face.js';
import { createHost } from '../../../../story-block/testkit/index.js';
import { createModule } from '../../../src/v2/module.js';
import { lastProblems, makeState, reply } from './helpers/fake-ctx.js';

const gregorian = makeCalendar(PRESETS.gregorian);
const at = text => gregorian.parse(text).abs;
const marked = { carrier: { rules: ['clockFace'] } };
const start = () => reply(makeState(), '~ time March 3, 2026, 05:30 pm', marked).state;
const clock = state => state.domains.director.time.minutes;
const timeProblems = state => lastProblems(state).filter(problem => problem.kind === 'time');
const play = (state, block) => reply(state, block, marked).state;

test('after `! time +3d` the new day takes 6:00 am, 6:30 am, 7:00 am, though the landing face is 5:30 pm', () => {
    let state = play(start(), '! time +3d');
    assert.equal(clock(state), at('March 6, 2026, 05:30 pm'));
    for (const face of ['6:00 am', '6:30 am', '7:00 am']) {
        state = play(state, `~ time ${face}`);
        assert.equal(clock(state), at(`March 6, 2026, ${face.replace(/^(\d)/, '0$1')}`));
    }
    assert.deepEqual(timeProblems(state), []);
});

test('the same reply may jump and then set the time of the new day', () => {
    const state = play(start(), '! time +3d\n~ time 6:00 am');
    assert.equal(clock(state), at('March 6, 2026, 06:00 am'));
    assert.deepEqual(timeProblems(state), []);
});

test('`! time next morning` then `~ time 6:30 am` is accepted; next morning alone lands at the morning default', () => {
    assert.equal(clock(play(start(), '! time next morning')), at('March 4, 2026, 09:00 am'));
    const state = play(start(), '! time next morning\n~ time 6:30 am');
    assert.equal(clock(state), at('March 4, 2026, 06:30 am'));
    assert.deepEqual(timeProblems(state), []);
});

test('only the first time line on the day is open: a second earlier face is refused', () => {
    const state = play(start(), '! time +3d\n~ time 6:00 am\n~ time 5:00 am');
    assert.equal(clock(state), at('March 6, 2026, 06:00 am'));
    assert.equal(timeProblems(state).length, 1);
});

test('going back with no jump is still refused; a jump that did not reach a later day opens nothing', () => {
    const back = play(start(), '~ time 4:45 pm');
    assert.equal(clock(back), at('March 3, 2026, 05:30 pm'));
    assert.match(timeProblems(back)[0].text, /never goes back/);
    const hours = play(start(), '! time +1h\n~ time 5:00 pm');
    assert.equal(clock(hours), at('March 3, 2026, 06:30 pm'));
    assert.equal(timeProblems(hours).length, 1);
});

test('the open day is read from the stored receipt: a different day, or none, refuses', () => {
    const now = at('March 6, 2026, 05:30 pm');
    const read = openDay => clockFaceAfter({ op: '~', kind: 'time', name: '6:00 am', text: '' }, now, gregorian, { openDay });
    assert.equal(read(String(Math.floor(now / 1440))).minutes, at('March 6, 2026, 06:00 am'));
    assert.ok(read(String(Math.floor(now / 1440) - 1)).error);
    assert.ok(read(null).error);
});

async function newHost() {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), chat: () => host?.ctx.chat ?? [] } });
    host = await createHost({ modules: [module] });
    return host;
}
const say = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;

test('Re-read of the jump reply, and swipe and delete of the reply after it, replay the same', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await newHost();
    t.after(() => host.close());
    await host.send('Begin.', say('The road.', ['~ time March 3, 1200, 05:30 pm']));
    await host.send('Days pass.', say('Three days on.', ['! time +3d']));
    await host.send('Dawn.', say('Morning.', ['~ time 6:00 am']));
    const clock = () => host.sdk.query('director.time').text;
    assert.equal(clock(), 'March 6, 1200, 06:00 am');
    const live = JSON.stringify(host.head());
    await host.turn.reread(4);
    assert.equal(JSON.stringify(host.head()), live);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
    await host.st.deleteMessage(6);
    await host.st.deleteMessage(5);
    await host.turn.onChatChanged();
    assert.equal(clock(), 'March 6, 1200, 05:30 pm');
    await host.send('Dawn again.', say('Morning.', ['~ time 6:00 am']));
    assert.equal(clock(), 'March 6, 1200, 06:00 am');
    await host.swipe(say('Morning.', ['~ time 7:00 am']));
    assert.equal(clock(), 'March 6, 1200, 07:00 am');
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.equal(clock(), 'March 6, 1200, 06:00 am');
    host.store.rebuild();
    assert.equal(clock(), 'March 6, 1200, 06:00 am');
});

test('swiping the jump reply to a no-jump variant closes the day; swiping back reopens it', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await newHost();
    t.after(() => host.close());
    const clock = () => host.sdk.query('director.time').text;
    await host.send('Begin.', say('The road.', ['~ time March 3, 1200, 05:30 pm']));
    await host.send('Days pass.', say('Three days on.', ['! time +3d']));
    await host.swipe(say('An hour on.', ['! time +1h']));
    assert.equal(clock(), 'March 3, 1200, 06:30 pm');
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.equal(clock(), 'March 6, 1200, 05:30 pm');
    await host.send('Dawn.', say('Morning.', ['~ time 6:00 am']));
    assert.equal(clock(), 'March 6, 1200, 06:00 am');
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
});

test('deleting the jump reply closes the day: a later ~ 6:00 am is refused, and rebuild matches live', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await newHost();
    t.after(() => host.close());
    const clock = () => host.sdk.query('director.time').text;
    await host.send('Begin.', say('The road.', ['~ time March 3, 1200, 05:30 pm']));
    await host.send('Days pass.', say('Three days on.', ['! time +3d']));
    await host.st.deleteMessage(4);
    await host.st.deleteMessage(3);
    await host.turn.onChatChanged();
    assert.equal(clock(), 'March 3, 1200, 05:30 pm');
    await host.send('Dawn.', say('Morning.', ['~ time 6:00 am']));
    assert.equal(clock(), 'March 3, 1200, 05:30 pm');
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
});
