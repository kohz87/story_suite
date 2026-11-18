// Soak W11 and W12: a time line cut to the longest jump, and a refused time line, each give a Problems row with the reason (not only a "(not used)" receipt).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';

async function newHost() {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), chat: () => host?.ctx.chat ?? [] } });
    host = await createHost({ modules: [module] });
    return host;
}
const say = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const rows = (host, index) => host.turn.problems().filter(row => row.index === index && row.code === 'LIMITED');
const clock = host => host.sdk.query('director.time').text;

test('W11: `! time +6 weeks` is cut to the longest jump (30 days) and the Problems list says so', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await newHost();
    t.after(() => host.close());
    await host.send('Begin.', say('The road.', ['~ time October 26, 1200, 09:00 am']));
    await host.send('Winter.', say('Six weeks pass.', ['! time +6 weeks']));
    assert.equal(clock(host), 'November 25, 1200, 09:00 am');
    const found = rows(host, 4);
    assert.equal(found.length, 1);
    assert.match(found[0].message, /"\+6 weeks" moves the story time more than 30 days at once; it moved 30 days/);
    assert.equal(found[0].line, '! time +6 weeks');
    // The row is not stored in the receipt (Story Block keeps `problem` out of it); a rebuild gives the same state.
    const receipts = host.ctx.chat[4].extra.storySuite.receipts.filter(receipt => receipt.type === 'capture.time');
    assert.equal(receipts.length, 1);
    assert.equal(Object.hasOwn(receipts[0], 'problem'), false);
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
});

test('W12: `! time -3h`, a date before the story time and `~ time 25:00` each give a Problems row with the reason', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await newHost();
    t.after(() => host.close());
    await host.send('Begin.', say('The road.', ['~ time December 5, 1200, 09:00 am']));
    await host.send('Back?', say('Nothing moves.', ['! time -3h', '~ time December 1, 1200, 9:00 am', '~ time 25:00']));
    assert.equal(clock(host), 'December 5, 1200, 09:00 am');
    const found = rows(host, 4);
    assert.deepEqual(found.map(row => row.line), ['! time -3h', '~ time December 1, 1200, 9:00 am', '~ time 25:00']);
    assert.match(found[0].message, /not a date or a stretch of time|only moves forward/);
    assert.match(found[1].message, /names a date before the story time .*the clock never goes back/);
    assert.match(found[2].message, /^"25:00" is not a clock time/);
});

test('W12: a refused part of a joined line gives its row too', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await newHost();
    t.after(() => host.close());
    await host.send('Begin.', say('The road.', ['~ time December 5, 1200, 09:00 am']));
    await host.send('On.', say('Later.', ['~ time 25:00 · ! time +2h']));
    assert.equal(clock(host), 'December 5, 1200, 11:00 am');
    const found = rows(host, 4);
    assert.equal(found.length, 1);
    assert.match(found[0].message, /^"25:00" is not a clock time/);
});

test('S2PD B28: a time line with a bad clock inside a date names the clock once, not "has itself"', async t => {
    const { timeAfter } = await import('../../../../modules/time/tracker/time-parts/timeline.js');
    const calendar = { parse: () => null };
    assert.equal(timeAfter({ op: '~', text: '25:00' }, 0, calendar).error, '"25:00" is not a clock time; the story time is left as it was.');
    assert.equal(timeAfter({ op: '~', text: 'December 5, 25:00' }, 0, calendar).error, '"December 5, 25:00" has "25:00", which is not a clock time; the story time is left as it was.');
});
