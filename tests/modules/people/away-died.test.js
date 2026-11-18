// Someone who dies while away (people/away, REVAWAY item 3): the people store has them dead, so the narrator's [Elsewhere] tail, the away
// teaching and the World screen's Elsewhere rows leave them out, read at answer time with nothing stored; director.away still names them,
// marked removed. Swipe and swipe back, a middle delete, a rewind, an edited Re-read (grown and shrunk), a rebuild, a reload and a chat
// change agree, and a person matched by an alias counts too. Fails if the dead are kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OPENING, STATIC_KEY, TAIL_KEY, castHost, castSource, entry, said, sent } from '../cast/cast/helpers.js';
import { tables } from '../../../modules/people/away/away-domain.js';
import { awayTaught } from '../../../modules/people/away/away-prompt.js';

const caller = { id: 'x', name: 'X', commands: { 'x.died': (ctx, p) => { ctx.call('people.died', p); return { summary: 'died' }; } } };
const last = host => host.ctx.chat.length - 1;
const tailLines = host => (sent(host, TAIL_KEY).at(-1) ?? '').split('\n').filter(line => line.startsWith('[Elsewhere]') || line.includes(': away')).join(' | ');
const taughtSent = host => (sent(host, STATIC_KEY).at(-1) ?? '').includes('+ away Name');
const viewRows = host => host.sdk.query('director.away.view').people.map(row => [row.name, row.status]);
const removed = (host, name = 'Ren') => host.sdk.query('director.away').find(row => row.name === name)?.removed ?? null;
const snapshot = host => JSON.stringify([host.head().domains.away, host.head().domains.people.npcs.npc_f0.lifeState ?? null, viewRows(host), awayTaught(host.head())]);
const noProblems = host => assert.deepEqual(host.turn.problems().filter(problem => problem.code !== 'NO_CHANGES'), [], 'no Problem (a reply with no change block is a quiet note)');
const REN_DUE = /Ren: away, scouting the north road, due back/;

// Gives one person a dossier as npc_f0 on the head reply and the Follow star, as followPeople does, but with the aliases stored as a list
// (the people store's shape; followPeople writes them as one comma-joined string, which no alias reader takes).
async function follow(host, { name, aliases = [] }) {
    const source = host.store.sourceAt(host.store.headIndex());
    const view = { v: 1, order: ['npc_f0'], npcs: { npc_f0: { id: 'npc_f0', name, aliases, role: 'cast' } }, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {}, turn: 1 };
    assert.equal((await host.sdk.command('people.write', { v: 1, source: { sid: source.sid, swipeKey: source.swipeKey }, view })).ok, true);
    assert.equal((await host.sdk.command('people.follow', { id: 'npc_f0', on: true })).ok, true);
}

// Ren followed, sent away (back June 4), the clock at June 6, then killed on the reply `at` (the head).
async function deadWhileAway(t, { person = { name: 'Ren' }, called = 'Ren' } = {}) {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'warn', () => {});
    const host = await castHost({ source: castSource([entry('brom')]), extra: [caller] });
    await host.send('Hello.', said('Dawn.', OPENING));
    await follow(host, person);
    await host.send('Go.', said('Ren leaves.', [`+ away ${called} — scouting the north road | back: June 4`]));
    await host.send('Wait.', said('Days pass.', ['~ time June 6, 1200, 09:00 am']));
    await host.send('Next.', said('The road is quiet.'));
    assert.match(tailLines(host), new RegExp(`${called}: away, scouting the north road, due back`), 'alive and overdue: the tail asks for him');
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
        assert.equal(tailLines(host), '', 'the narrator is not asked to bring a dead man back');
        assert.equal(taughtSent(host), false, 'the away paragraph is no longer taught');
        assert.deepEqual(Object.keys(tables(host.head().domains.away).away), ['ren'], 'nothing is stored: the absence stays open');
        assert.equal(JSON.stringify(host.head().domains.away), record);
        noProblems(host);
        const live = snapshot(host);
        host.store.rebuild();
        assert.equal(snapshot(host), live, 'rebuild == live');
        await host.st.loadChat(structuredClone(host.ctx.chat));
        assert.equal(snapshot(host), live, 'reload == live');
        const chat = structuredClone(host.ctx.chat);
        await host.st.loadChat([structuredClone(chat[0])], 'other-chat');
        assert.deepEqual(viewRows(host), [], 'another chat has nobody away');
        await host.st.loadChat(chat, 'first-chat');
        assert.equal(snapshot(host), live, 'back to the first chat');
    } finally { host.close(); }
});

test('a swipe takes the death away and the away line comes back; swiping back drops it again; a rewind past the death brings him back', async t => {
    const { host, at } = await deadWhileAway(t);
    try {
        const dead = snapshot(host);
        await host.swipe(said('The riders pass by.'));
        assert.equal(removed(host), null, 'the other swipe has no death');
        assert.deepEqual(viewRows(host), [['Ren', 'Away · due back']]);
        assert.equal(awayTaught(host.head()), true);
        await host.send('On.', said('Quiet.'));
        assert.match(tailLines(host), REN_DUE);
        await host.st.deleteMessage(last(host));
        await host.st.deleteMessage(last(host));
        await host.st.swipeTo(at, 0);
        assert.equal(snapshot(host), dead, 'swiping back is the dead state');
        await host.st.deleteMessage(at);
        await host.st.deleteMessage(at - 1);
        assert.deepEqual(viewRows(host), [['Ren', 'Away · due back']], 'a rewind takes the death with its reply');
        await host.send('On.', said('Quiet.'));
        assert.match(tailLines(host), REN_DUE);
        assert.equal(taughtSent(host), true);
    } finally { host.close(); }
});

test('a middle delete of the death\'s reply: the later replies stand and Ren is away again; rebuild == live', async t => {
    const { host, at } = await deadWhileAway(t);
    try {
        await host.send('On.', said('Quiet.'));
        await host.send('On.', said('Quiet again.', ['! away Ren — seen at the ford']));
        const length = host.ctx.chat.length;
        await host.st.deleteMessage(at);
        await host.st.deleteMessage(at - 1);
        assert.equal(host.ctx.chat.length, length - 2, 'only the death\'s pair went');
        assert.equal(removed(host), null);
        assert.deepEqual(viewRows(host), [['Ren', 'Away · due back']]);
        assert.deepEqual(tables(host.head().domains.away).away.ren.steps.map(step => step.text), ['seen at the ford'], 'the later news stands');
        assert.equal(awayTaught(host.head()), true);
        noProblems(host);
        const live = snapshot(host);
        host.store.rebuild();
        assert.equal(snapshot(host), live, 'rebuild == live');
        await host.send('On.', said('Quiet.'));
        assert.match(tailLines(host), /Ren: away, scouting the north road, due back \([^)]*\); latest: seen at the ford\./);
    } finally { host.close(); }
});

test('an edited Re-read after the death: grown (Ann sent away) gives Ann alone; shrunk (none) gives nobody; rebuild == live each time', async t => {
    const { host } = await deadWhileAway(t);
    try {
        await host.send('On.', said('Quiet.'));
        const edited = last(host);
        await host.st.editMessage(edited, said('Ann rides out.', ['+ away Ann — to the coast']));
        assert.equal((await host.turn.reread(edited)).ok, true);
        assert.deepEqual(viewRows(host), [['Ann', 'Away']], 'grown: Ann alone, not the dead');
        assert.equal(awayTaught(host.head()), true);
        let live = snapshot(host);
        host.store.rebuild();
        assert.equal(snapshot(host), live, 'rebuild == live after the grown Re-read');
        await host.send('On.', said('Quiet.'));
        assert.equal(tailLines(host), '[Elsewhere] Away from the scene: | Ann: away, to the coast.');
        assert.equal(taughtSent(host), true);
        await host.st.editMessage(edited, said('Quiet.'));
        assert.equal((await host.turn.reread(edited)).ok, true);
        assert.deepEqual(viewRows(host), [], 'shrunk: nobody');
        assert.equal(awayTaught(host.head()), false);
        live = snapshot(host);
        host.store.rebuild();
        assert.equal(snapshot(host), live, 'rebuild == live after the shrunk Re-read');
        await host.send('On.', said('Quiet.'));
        assert.equal(tailLines(host), '');
        assert.equal(taughtSent(host), false);
    } finally { host.close(); }
});

test('sent away by an alias ("the scout"): the death is matched by the alias in the tail, the teaching, the view and director.away', async t => {
    const { host } = await deadWhileAway(t, { person: { name: 'Ren', aliases: ['the scout'] }, called: 'the scout' });
    try {
        assert.deepEqual(host.head().domains.people.npcs.npc_f0.aliases, ['the scout'], 'the store keeps the alias as a list');
        assert.deepEqual(removed(host, 'the scout'), { reason: 'died' });
        assert.deepEqual(viewRows(host), []);
        assert.equal(awayTaught(host.head()), false);
        await host.send('On.', said('Quiet.'));
        assert.equal(tailLines(host), '');
        assert.equal(taughtSent(host), false);
    } finally { host.close(); }
});
