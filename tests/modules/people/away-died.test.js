// Someone who dies while away (people/away, AWAYREVIEW item 3): the people store has them dead, so the narrator's [Elsewhere] tail, the
// away teaching and the World screen's Elsewhere rows leave them out, read at answer time with nothing stored; director.away still names
// them, marked removed. Swipe and swipe back, a rebuild, a reload and a delete of the death's reply agree. Fails if the dead are kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OPENING, STATIC_KEY, TAIL_KEY, castHost, castSource, entry, followPeople, said, sent } from '../cast/cast/helpers.js';
import { tables } from '../../../modules/people/away/away-domain.js';
import { awayTaught } from '../../../modules/people/away/away-prompt.js';

const caller = { id: 'x', name: 'X', commands: { 'x.died': (ctx, p) => { ctx.call('people.died', p); return { summary: 'died' }; } } };
const last = host => host.ctx.chat.length - 1;
const tailLine = host => (sent(host, TAIL_KEY).at(-1) ?? '').split('\n').filter(line => line.startsWith('[Elsewhere]') || line.startsWith('Ren: away')).join(' | ');
const taughtSent = host => (sent(host, STATIC_KEY).at(-1) ?? '').includes('+ away Name');
const viewRows = host => host.sdk.query('director.away.view').people.map(row => [row.name, row.status]);
const removed = host => host.sdk.query('director.away').find(row => row.name === 'Ren')?.removed ?? null;
const snapshot = host => JSON.stringify([host.head().domains.away, host.head().domains.people.npcs.npc_f0.lifeState ?? null, viewRows(host), awayTaught(host.head())]);

async function deadWhileAway(t) {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'warn', () => {});
    const host = await castHost({ source: castSource([entry('brom')]), extra: [caller] });
    await host.send('Hello.', said('Dawn.', OPENING));
    await followPeople(host, [{ name: 'Ren' }]);
    await host.send('Go.', said('Ren leaves.', ['+ away Ren — scouting the north road | back: June 4']));
    await host.send('Wait.', said('Days pass.', ['~ time June 6, 1200, 09:00 am']));
    await host.send('Next.', said('The road is quiet.'));
    assert.match(tailLine(host), /Ren: away, scouting the north road, due back/, 'alive and overdue: the tail asks for him');
    assert.equal(taughtSent(host), true);
    assert.deepEqual(viewRows(host), [['Ren', 'Away · due back']]);
    await host.send('Ambush.', said('Riders on the north road.'));
    const at = last(host);
    const { sid } = host.store.sourceAt(host.store.headIndex());
    assert.equal((await host.sdk.command('x.died', { id: 'npc_f0', reason: 'killed on the north road', sid })).ok, true);
    return { host, at };
}

test('dead while away: no tail line, not taught, no Elsewhere row; director.away marks him removed; the record stays as it was', async t => {
    const { host } = await deadWhileAway(t);
    try {
        const record = JSON.stringify(host.head().domains.away);
        assert.deepEqual(removed(host), { reason: 'died' });
        assert.deepEqual(viewRows(host), [], 'no Elsewhere row for the dead');
        assert.equal(host.sdk.query('director.away.view').hasPeople, false);
        assert.equal(awayTaught(host.head()), false, 'nobody alive is away or followed');
        await host.send('On.', said('Quiet.'));
        await host.send('On.', said('Quiet again.'));
        assert.equal(tailLine(host), '', 'the narrator is not asked to bring a dead man back');
        assert.equal(taughtSent(host), false, 'the away paragraph is no longer taught');
        assert.deepEqual(Object.keys(tables(host.head().domains.away).away), ['ren'], 'nothing is stored: the absence stays open');
        assert.equal(JSON.stringify(host.head().domains.away), record);
        assert.deepEqual(host.turn.problems().filter(problem => problem.code !== 'NO_CHANGES'), [], 'no Problem (a reply with no change block is a quiet note)');
        const live = snapshot(host);
        host.store.rebuild();
        assert.equal(snapshot(host), live, 'rebuild == live');
        await host.st.loadChat(structuredClone(host.ctx.chat));
        assert.equal(snapshot(host), live, 'reload == live');
    } finally { host.close(); }
});

test('a swipe takes the death away and the away line comes back; swiping back drops it again; deleting the death\'s reply brings him back', async t => {
    const { host, at } = await deadWhileAway(t);
    try {
        const dead = snapshot(host);
        await host.swipe(said('The riders pass by.'));
        assert.equal(removed(host), null, 'the other swipe has no death');
        assert.deepEqual(viewRows(host), [['Ren', 'Away · due back']]);
        assert.equal(awayTaught(host.head()), true);
        await host.send('On.', said('Quiet.'));
        assert.match(tailLine(host), /Ren: away, scouting the north road, due back/);
        await host.st.deleteMessage(last(host));
        await host.st.deleteMessage(last(host));
        await host.st.swipeTo(at, 0);
        assert.equal(snapshot(host), dead, 'swiping back is the dead state');
        await host.st.deleteMessage(at);
        await host.st.deleteMessage(at - 1);
        assert.deepEqual(viewRows(host), [['Ren', 'Away · due back']], 'the death went with its reply');
        await host.send('On.', said('Quiet.'));
        assert.match(tailLine(host), /Ren: away, scouting the north road, due back/);
        assert.equal(taughtSent(host), true);
    } finally { host.close(); }
});
