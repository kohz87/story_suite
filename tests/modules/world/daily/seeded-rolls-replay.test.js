// The world-events engine's seeded rolls on the real host, through every replay path: a minor template and a recurring "possible" event
// with fractional chances (so the day-seeded draws decide what happens), the news of a code-fired happening by courier time, and the
// narrator's `! world` form under the one-world-line-with-conditions-per-reply rule. Swipe, swipe back, edited Re-reads (grown, shrunk),
// a middle delete, a rewind and a reload (a fresh host loading the chat) all agree with live.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, chronicle, dailyOf, dailyReceipts, newHost, reply, SPEC } from './daily-host.helpers.js';

const spec = {
    ...SPEC,
    templates: [{ template: 'stir', severity: 'minor', where: { kinds: ['village', 'town'] }, sets: ['unrest@place: 2 days'], chance: '40% per season', summary: 'A stir in {place}.' }],
    events: [
        ...SPEC.events,
        { id: 'fog', kind: 'recurring', certainty: 'possible', severity: 'minor', where: { kinds: ['town'] }, chance: '50% per season', ends_when: 'instant', summary: 'Fog over {place}.' },
    ],
};
// A condition a step sets carries the reply's revision, which a swipe moves on; everything else must be equal.
const same = host => JSON.stringify({ daily: chronicle(host).daily ?? null, conditions: chronicle(host).conditions ?? null }).replace(/"rev":\d+,?/g, '');
const check = async (host, label) => { assert.deepEqual(host.store.problems(), [], `${label}: no store problems`); await agrees(host, label); };
const day = (host, text) => host.send(text, reply(text, ['! time +1d']));

// Tempo 0.25: seasons a quarter as long, so the "per season" chances are rolls that often hit within a few weeks.
const FAST = { modules: { 'story-director': { 'tracker.maxJump': 60, 'chronicle.tempo': '0.25' } } };
const firedBy = host => dailyReceipts(host).flatMap(entry => entry.receipt.data?.fired ?? []);
const rolled = host => firedBy(host).some(id => !/levy/.test(id)) || (dailyOf(host)?.minors ?? []).length > 0;
const slot = host => JSON.stringify(dailyOf(host));
const recordedSlot = recorded => JSON.stringify(JSON.parse(recorded).daily[0]);
// Every raw entry is a live one: held by an Active event, or with no end, or an end still to come (the queries hide the rest).
const tidy = host => {
    const now = host.head().domains.director.time.minutes;
    return Object.values(chronicle(host).conditions ?? {}).every(entry => (entry.holds?.length ? entry.holds.some(id => dailyOf(host)?.events[id]?.state === 'active') : entry.fadesAt === null || entry.fadesAt > now));
};

async function play(host) {
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    for (let i = 0; i < 6; i += 1) await day(host, `Day ${i}.`);
    await host.send('The road.', reply('The road.', ['! time +12d']));
    await day(host, 'Last.');
}

// The seed is drawn per chat; a chat whose draws all missed proves less, so up to five chats are drawn until a fractional roll hit.
async function build() {
    for (let tries = 0; ; tries += 1) {
        const host = await newHost(true, spec, FAST);
        await play(host);
        if (rolled(host) || tries === 4) return host;
        host.done();
    }
}

test('a minor template and a recurring possible event (fractional chances): swipe, swipe back, a rewind, Re-reads, a middle delete and a reload keep the rolled world', async () => {
    const host = await build();
    try {
        const ws = dailyOf(host);
        assert.ok(ws && typeof ws.seed === 'string', 'the step ran with the campaign seed');
        assert.ok(rolled(host), `a fractional roll hit (fired: ${firedBy(host).join(', ')})`);
        await check(host, 'live');
        const recorded = same(host);
        // Swipes of the last crossing reply step the same day the same way (the same seed, day and key → the same draws).
        for (const text of ['Last, grey.', 'Last, red.']) {
            await host.swipe(reply(text, ['! time +1d']));
            assert.equal(same(host), recorded, `a swipe (${text}): the same rolls`);
            await check(host, `swipe ${text}`);
        }
        await host.st.swipeTo(host.ctx.chat.length - 1, 0);
        assert.equal(same(host), recorded, 'swiped back to the first swipe');
        await check(host, 'swiped back');
        // A rewind past the skip and the last day, then the same replies again: the same days roll the same way.
        const road = host.ctx.chat.findIndex(message => message.is_user && message.mes === 'The road.');
        for (let i = host.ctx.chat.length - 1; i >= road; i -= 1) await host.st.deleteMessage(i);
        await check(host, 'rewind');
        assert.notEqual(same(host), recorded, 'the rewind took the later days back');
        await host.send('The road.', reply('The road.', ['! time +12d']));
        await day(host, 'Last.');
        assert.equal(same(host), recorded, 'played again after the rewind: the same seeded world');
        await check(host, 'played on after the rewind');
        // Edited Re-reads of an early crossing (grown, shrunk) and a middle delete of the reply whose step ended the levy: the later
        // replies' recorded step state (every roll) stays, nothing is rolled again, replay == live. The conditions table is written as
        // patches, so a condition the edited or deleted step faded or released can come back on the raw table: one past its end is settled
        // before the next reply, one held by an ended event is not counted by the readers (live-holds.js) and is tidied by the next stepped
        // day; and one only that step set is gone (pinned, as in daily-host-replay).
        const early = host.ctx.chat.findIndex(message => message.mes.startsWith('Day 1.') && !message.is_user);
        await host.st.editMessage(early, reply('Day 1.', ['! time +3d']));
        assert.equal((await host.sdk.reread(early)).ok, true);
        assert.equal(slot(host), recordedSlot(recorded), 'grown Re-read: the recorded step state');
        await check(host, 'grown Re-read');
        await host.st.editMessage(early, reply('Day 1.', ['! time +1h']));
        assert.equal((await host.sdk.reread(early)).ok, true);
        assert.equal(slot(host), recordedSlot(recorded), 'shrunk Re-read: the recorded step state');
        await check(host, 'shrunk Re-read');
        const levyEnd = dailyOf(host).events.levy.ended;
        const ender = dailyReceipts(host).find(entry => entry.receipt.data?.from <= levyEnd && levyEnd <= entry.receipt.data?.to);
        assert.ok(ender && ender.index > 1, 'a reply after the first stepped the day the levy ended');
        await host.st.deleteMessage(ender.index);
        assert.equal(slot(host), recordedSlot(recorded), 'middle delete: the recorded step state');
        await check(host, 'middle delete');
        // On past the recorded last day (the shrunk Re-read and the delete put the clock behind it): that day's step tidies the table.
        const behind = JSON.parse(recorded).daily[0].day - Math.floor(host.head().domains.director.time.minutes / 1440);
        await host.send('After.', reply('After.', [`! time +${behind + 1}d`]));
        assert.ok(dailyOf(host).day > JSON.parse(recorded).daily[0].day, 'a new day was stepped');
        assert.ok(tidy(host), `the next stepped day tidies the table: ${JSON.stringify(chronicle(host).conditions)}`);
        await check(host, 'a day after the middle delete');
    } finally { host.done(); }
});

// Bluewatch hears of what happens at Highmark by courier time (no route here: the same-region tier) — a derived query, so a reload agrees.
const heard = (host, place) => JSON.stringify((host.sdk.query('world.heardHere', { place }) ?? []).map(entry => [entry.name, entry.since ?? null]));

test('news of a code-fired happening reaches another place by courier time; a reload, a swipe and a rewind give the same news', async () => {
    const host = await newHost(true, spec);
    let again = null;
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        await day(host, 'Day 0.');
        await day(host, 'Day 1.');
        await day(host, 'Day 2.');
        const levy = (host.sdk.query('chronicle.events', {}) ?? []).find(entry => /levy/i.test(entry.name ?? ''));
        assert.ok(levy, 'the set-in-motion levy fired and has its Journal entry');
        const at = host.sdk.query('world.newsAt', { entryId: levy.id, place: 'Bluewatch' });
        assert.ok(at && Number.isFinite(at.arrivesAt), JSON.stringify(at));
        assert.ok(at.arrivesAt >= levy.since, 'the news arrives at or after the happening');
        const live = { here: heard(host, 'Highmark'), there: heard(host, 'Bluewatch') };
        assert.match(live.there, /levy/i, 'Bluewatch has heard by now');
        // A reload: a fresh host loading the chat hears the same.
        again = await newHost(true, spec);
        await again.st.loadChat(structuredClone(host.ctx.chat));
        assert.deepEqual({ here: heard(again, 'Highmark'), there: heard(again, 'Bluewatch') }, live, 'a reload: the same news');
        assert.deepEqual(again.sdk.query('world.newsAt', { entryId: levy.id, place: 'Bluewatch' }), at, 'a reload: the same arrival');
        // A swipe of the last reply with the same line: the same news.
        await host.swipe(reply('Day 2, again.', ['! time +1d']));
        assert.deepEqual({ here: heard(host, 'Highmark'), there: heard(host, 'Bluewatch') }, live, 'a swipe: the same news');
        // A rewind to before the first crossing takes the happening (and its news) back; playing on brings both back the same.
        const last = host.ctx.chat.length - 1;
        for (let i = 0; i < 6; i += 1) await host.st.deleteMessage(last - i);
        assert.doesNotMatch(heard(host, 'Bluewatch'), /levy/i, 'rewound: no news of it');
        for (const text of ['Day 0.', 'Day 1.', 'Day 2.']) await day(host, text);
        assert.deepEqual({ here: heard(host, 'Highmark'), there: heard(host, 'Bluewatch') }, live, 'played on: the same news');
        await check(host, 'news after the rewind');
    } finally { again?.done(); host.done(); }
});

const BANG = '! world Bread Riots — crowds fill the square | state: ongoing | place: Highmark | conditions: +unrest';
const PLUS = '+ world Gate Talk — talk of the gate | state: looming | place: Bluewatch | conditions: +unrest';

test('the `! world` form with conditions counts as the reply\'s one world line: a second line with conditions is refused, either order; replay == live', async () => {
    const host = await newHost(true, spec);
    const names = () => (host.sdk.query('chronicle.events', {}) ?? []).map(entry => entry.name);
    const keys = () => Object.entries(chronicle(host).conditions ?? {}).filter(([, entry]) => entry.by === 'narrator').map(([key]) => key).sort();
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        await host.send('Look.', reply('The square fills.', [BANG, PLUS]));
        assert.deepEqual(keys(), ['unrest@Highmark'], 'the `! world` line set its condition');
        assert.ok(names().includes('Bread Riots'), 'the `! world` line made its entry');
        assert.ok(!names().includes('Gate Talk'), 'the second line with conditions is refused');
        assert.ok(host.turn.problems().some(item => /one world line with conditions; "Gate Talk" was not used/.test(item.message)), 'with a note');
        await check(host, '! then +');
        await host.swipe(reply('The square fills.', [PLUS, BANG]));
        assert.deepEqual(keys(), ['unrest@Bluewatch'], 'swiped, the other order: the first line wins');
        assert.ok(names().includes('Gate Talk') && !names().includes('Bread Riots'), 'the `! world` line is the refused one now');
        await check(host, '+ then !');
        await host.st.swipeTo(host.ctx.chat.length - 1, 0);
        assert.deepEqual(keys(), ['unrest@Highmark'], 'swiped back');
        await check(host, 'swiped back');
    } finally { host.done(); }
});

// Finding 1 of the WORLDEV report, fixed (WORLDEV2): a middle delete of the reply whose step ended the levy (plain SPEC, tempo 1: only the levy
// touches unrest@Highmark) brings back the levy's held condition on the raw table, but the readers count a hold only while the step says its event
// is Active (conditions/live-holds.js), so the condition stays gone in the queries; the next stepped day tidies the raw entry.
test('after a middle delete of the reply that ended an event, its held condition stays gone in the queries; the next stepped day tidies the table', async () => {
    const host = await newHost(true, SPEC);
    const unrest = () => (host.sdk.query('chronicle.conditions', { ref: 'Highmark' }) ?? []).some(row => row.name === 'unrest');
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        for (let i = 0; i < 6; i += 1) await day(host, `Day ${i}.`);
        const levy = dailyOf(host).events.levy;
        assert.equal(levy.state, 'ended');
        assert.equal(unrest(), false, 'live: the levy ended, its condition went with it');
        const recordedDay = dailyOf(host).day;
        const ender = dailyReceipts(host).find(entry => entry.receipt.data?.from <= levy.ended && levy.ended <= entry.receipt.data?.to);
        assert.ok(ender && ender.index > 1);
        await host.st.deleteMessage(ender.index);
        assert.deepEqual(chronicle(host).conditions['unrest@Highmark']?.holds, ['levy'], 'the raw entry is back, held by the levy');
        assert.equal(dailyOf(host).events.levy.state, 'ended', 'while the recorded step state says the levy ended');
        assert.equal(unrest(), false, 'the queries count no hold of an ended event');
        assert.equal((host.sdk.query('chronicle.conditions', { at: 'Highmark' }) ?? []).some(row => row.name === 'unrest'), false, 'nor does the scope walk');
        await check(host, 'middle delete');
        const behind = recordedDay - Math.floor(host.head().domains.director.time.minutes / 1440);
        await host.send('After.', reply('After.', [`! time +${behind + 1}d`]));
        assert.equal(unrest(), false, 'still gone after the next stepped day');
        assert.equal(chronicle(host).conditions['unrest@Highmark'], undefined, 'and the raw entry is tidied');
        await check(host, 'after the next stepped day');
    } finally { host.done(); }
});
