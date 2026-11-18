// People away (people/away, AWAYFOLLOW): the narrator's `+ away` / `~ away` / `! away` / `- away` lines on a real Story Block host with Story Director,
// the `[Elsewhere]` tail, the paragraph taught only while someone is followed or away, the queries, and the retired `- key` line dropped quietly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OPENING, STATIC_KEY, TAIL_KEY, castHost, castSource, entry, followPeople, said, sent, validatorErrors } from '../cast/cast/helpers.js';
import { tables } from '../../../modules/people/away/away-domain.js';

const quiet = t => { t.mock.method(console, 'log', () => {}); t.mock.method(console, 'warn', () => {}); };
const away = host => structuredClone(tables(host.head().domains.away));
const elsewhere = host => (sent(host, TAIL_KEY).at(-1) ?? '').split('\n').filter(line => line.startsWith('[Elsewhere]') || /^\w[^:]*: away/.test(line)).join('\n');
const taught = host => (sent(host, STATIC_KEY).at(-1) ?? '').includes('+ away Name — what they are doing | back: date');

async function start(t) {
    quiet(t);
    const host = await castHost({ source: castSource([entry('brom')]) });
    await host.send('Hello.', said('Dawn.', OPENING));
    return host;
}

test('away lines: + sends someone away (anyone, followed or not), ~ changes it, ! adds news, - brings them back; the tail tells it', async t => {
    const host = await start(t);
    try {
        assert.equal(taught(host), false, 'nobody followed or away: the lines are not taught (main\'s prompt)');
        await host.send('Go.', said('Ren leaves.', ['+ away Ren — scouting the north road | back: June 9']));
        assert.deepEqual(host.turn.problems(), []);
        assert.equal(away(host).away.ren.doing, 'scouting the north road');
        await host.send('On.', said('Days pass.', ['! away Ren — reached Wolfmere Outpost', '~ away Ren | back: June 11']));
        assert.deepEqual(away(host).away.ren.steps.map(step => step.text), ['reached Wolfmere Outpost']);
        assert.equal(taught(host), true, 'someone away: the paragraph and the grammar line are taught');
        await host.send('Wait.', said('Quiet.'));
        assert.equal(elsewhere(host), '[Elsewhere] Away from the scene:\nRen: away, scouting the north road, back June 11; latest: reached Wolfmere Outpost.');
        const view = host.sdk.query('director.away.view');
        assert.deepEqual(view.people.map(row => [row.name, row.away, row.status, row.step, row.back]), [['Ren', true, 'Away · back June 11', 'reached Wolfmere Outpost', 'June 11']]);
        assert.deepEqual(host.sdk.query('director.away').map(row => [row.name, row.away?.doing]), [['Ren', 'scouting the north road']]);
        await host.send('Back.', said('Ren rides in.', ['- away Ren']));
        assert.deepEqual(Object.keys(away(host).away), []);
        assert.equal(away(host).home.ren.doing, 'scouting the north road', 'the last absence is kept for NPC State\'s "While away"');
        assert.deepEqual(host.sdk.query('director.away').map(row => [row.name, row.away]), [['Ren', null]], 'back: listed with no absence');
        await host.send('Next.', said('Quiet.'));
        assert.equal(elsewhere(host), '', 'nobody away: no tail');
        assert.equal(taught(host), false, 'nobody followed or away any more: not taught');
        assert.deepEqual(validatorErrors(host), []);
    } finally { host.close(); }
});

test('the return date: a date or a stretch from now; one that cannot be read keeps the old one with a Problem; a date that passed says "due back"', async t => {
    const host = await start(t);
    try {
        await host.send('Go.', said('Ren leaves.', ['+ away Ren — on an errand | back: in 2 days']));
        assert.equal(host.sdk.query('director.away.view').people[0].back, 'June 5');
        await host.send('On.', said('Hm.', ['~ away Ren | back: Someday Soon']));
        assert.match(host.turn.problems().map(item => item.message).join(' '), /is not a date on this calendar/);
        assert.equal(host.sdk.query('director.away.view').people[0].back, 'June 5', 'kept as it was');
        await host.send('Later.', said('Days pass.', ['~ time June 6, 1200, 09:00 am']));
        await host.send('Wait.', said('Quiet.'));
        assert.match(elsewhere(host), /Ren: away, on an errand, due back \(June 5\)\./);
    } finally { host.close(); }
});

test('lines that name nobody away are Problems; `! away` needs news', async t => {
    const host = await start(t);
    try {
        await host.send('Go.', said('Hm.', ['- away Ren', '! away Ren — got far']));
        assert.deepEqual(host.turn.problems().map(item => item.code), ['NOT_FOUND', 'NOT_FOUND']);
        assert.deepEqual(host.head().domains.away, { away: {} });
    } finally { host.close(); }
});

test('the retired `- key Name | died` line is read and dropped quietly: no Problem live or after a rebuild, nothing changes', async t => {
    const host = await start(t);
    try {
        const before = structuredClone(host.head().domains.away);
        await host.send('He falls.', said('Ren falls.', ['- key Ren | died', '- key Ann | murdered']));
        assert.deepEqual(host.turn.problems(), [], 'no UNKNOWN_KIND');
        assert.deepEqual(host.head().domains.away, before);
        host.store.rebuild();
        assert.deepEqual(host.turn.problems(), [], 'and none on a rebuild');
        for (const text of sent(host, STATIC_KEY)) assert.equal(text.includes('- key'), false, 'never taught');
    } finally { host.close(); }
});

test('a followed person teaches the lines and shows in Elsewhere; unfollowing takes both away again', async t => {
    const host = await start(t);
    try {
        await followPeople(host, [{ name: 'Mara' }]);
        await host.send('On.', said('Quiet.'));
        assert.equal(taught(host), true);
        assert.deepEqual(host.sdk.query('director.away.view').people.map(row => [row.name, row.followed, row.away, row.status]), [['Mara', true, false, 'Not here']]);
        assert.deepEqual(host.sdk.query('director.away').map(row => [row.name, row.followed, row.away]), [['Mara', true, null]]);
        assert.equal((await host.sdk.command('people.follow', { id: 'npc_f0', on: false })).ok, true);
        await host.send('Next.', said('Quiet.'));
        assert.equal(taught(host), false);
        assert.deepEqual(host.sdk.query('director.away.view').people, []);
    } finally { host.close(); }
});
