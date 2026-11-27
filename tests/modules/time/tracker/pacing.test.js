// The pacing prompt (note-parts/pacing.js and static.js): the breathe rule, and the tail's breather, wrap-up and quiet-scene
// cues, all read from the state, so a swipe, a Re-read and a rebuild send the same lines.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { GRAMMAR, staticText } from '../../../../modules/time/tracker/note.js';
import { LIVE_REPLIES, WRAP_BEATS, WRAP_REPLIES, pacingLines } from '../../../../modules/time/tracker/note-parts/pacing.js';

import { calendarOf, settingsDefaults } from '../../../../modules/time/tracker/time.js';

const TAIL_KEY = 'story_suite_tail_1';
const reply = lines => `The day goes on.\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const tailOf = host => host.st.promptLog.filter(entry => entry.key === TAIL_KEY && entry.value).map(entry => entry.value).at(-1) ?? '';
const pacingOf = text => text.split('\n').filter(line => /^(Breather|Wrap-up|Quiet scene):/.test(line)).map(line => line.split(':')[0]);
const beat = name => `+ beat ${name} — something stirs | reach: it is felt`;
const end = name => `! beat ${name} — it happened`;
const close = name => `- beat ${name} — settled`;

/**
 * A story on the real module. `say(lines)` sends a reply (a time line is added, so every reply is counted) and gives back the
 * pacing cues of the tail it was written under.
 */
async function story(t, run) {
    t.mock.method(console, 'warn', () => {});
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), chat: () => host?.ctx.chat ?? [] } });
    host = await createHost({ modules: [module] });
    let count = 0;
    const written = lines => reply([`~ time June 3, 1200, 08:${String(count++).padStart(2, '0')} am`, ...lines]);
    const say = async (lines = []) => { await host.send('Go on.', written(lines)); return pacingOf(tailOf(host)); };
    try {
        await run({ host, say });
    } finally {
        host.close();
    }
}

// The latest reply's tail after a swipe, a Re-read of the reply before it and a rebuild (each then a swipe of the latest reply,
// which is written under it).
// Compared from the Director note's header: the World pulse's line above it is rolled afresh for a swipe.
async function sameAfterReplay(host) {
    const note = () => tailOf(host).slice(tailOf(host).indexOf('[Story Director'));
    const sent = note();
    const again = host.ctx.chat.at(-1).mes;
    await host.swipe(again);
    assert.equal(note(), sent, 'swipe');
    assert.equal((await host.turn.reread(host.ctx.chat.length - 3)).ok, true);
    await host.swipe(again);
    assert.equal(note(), sent, 'Re-read');
    host.store.rebuild();
    await host.turn.onChatChanged();
    await host.swipe(again);
    assert.equal(note(), sent, 'rebuild');
    assert.deepEqual(host.store.problems(), []);
}

test('the static rule is sent with the threads feature on or off, and the grammar says not every reply', async t => {
    for (const threads of [true, false]) {
        assert.match(staticText({ threads }), /Let the story breathe: a chain of events builds to a resolution and then closes;/);
        assert.match(staticText({ threads }), /deadlines are days, not minutes, unless the danger is already in the scene\./);
    }
    assert.match(GRAMMAR.agenda, /Write one when the story sets something new moving \(not every reply does\), e\.g\./);
    await story(t, async ({ host, say }) => {
        await say();
        const sent = host.st.promptLog.filter(entry => entry.key.startsWith('story_suite_static') && entry.value).map(entry => entry.value).join('\n');
        assert.match(sent, /Let the story breathe: /);
    });
});

for (const [how, ending] of [['fired with !', end], ['closed with -', close]]) {
    test(`breather: the two replies after the last open beat is ${how}, not a third`, async t => {
        await story(t, async ({ host, say }) => {
            assert.deepEqual(await say(), [], 'no beat was ever open');
            assert.deepEqual(await say(), []);
            await say([beat('Ferry Row'), beat('Toll Man')]);
            assert.deepEqual(await say([ending('Ferry Row')]), [], 'one still open');
            assert.deepEqual(await say([ending('Toll Man')]), [], 'written under an open beat');
            assert.deepEqual(await say(), ['Breather'], 'first reply after');
            assert.match(tailOf(host), /\nBreather: the last pressing thread is settled\. Keep this reply calm \(aftermath, rest, travel, people\) unless \S+ starts something\./);
            await sameAfterReplay(host);
            assert.deepEqual(await say(), ['Breather'], 'second reply after');
            await sameAfterReplay(host);
            assert.deepEqual(await say(), [], 'no third');
        });
    });
}

test('breather: a Re-read of the reply that ended the beat keeps it; deleting that reply takes it away', async t => {
    await story(t, async ({ host, say }) => {
        await say([beat('Toll Man')]);
        await say([end('Toll Man')]);
        const ended = host.ctx.chat.length - 1;
        assert.deepEqual(await say(), ['Breather']);
        const latest = host.ctx.chat.at(-1).mes;
        assert.equal((await host.turn.reread(ended)).ok, true);
        await host.swipe(latest);
        assert.deepEqual(pacingOf(tailOf(host)), ['Breather']);
        // The reply and the reader's message before it, from the middle of the chat: the beat is open again.
        await host.st.deleteMessage(ended);
        await host.st.deleteMessage(ended - 1);
        await host.swipe(latest);
        assert.deepEqual(pacingOf(tailOf(host)), []);
        assert.match(tailOf(host), /Beats: Toll Man/);
        assert.deepEqual(host.store.problems(), []);
    });
});

test(`an open undated beat holds the chain only while it was touched in the last ${LIVE_REPLIES} replies`, () => {
    const made = (id, track, more = {}) => [id, { id, key: id, kind: 'beat', status: 'active', fields: {}, track, ...more }];
    const director = { turn: { n: 1 + LIVE_REPLIES }, threads: Object.fromEntries([made('th_old', { created: { turn: 1 } })]) };
    const labels = () => pacingLines({}, director, { state: {} }).map(entry => entry.label);
    assert.deepEqual(labels(), []);
    for (const name of ['changed', 'seen', 'engaged']) {
        director.threads.th_old.track = { created: { turn: 1 }, [name]: { turn: 2 } };
        assert.deepEqual(labels(), ['Wrap-up'], name);
    }
    director.threads.th_old.track = { created: { turn: 1 } };
    // A later chain that just ended gets its breather beside the forgotten beat.
    director.threads.th_new = { id: 'th_new', kind: 'beat', status: 'resolved', track: { created: { turn: 12 }, closed: { turn: 16 } } };
    assert.deepEqual(labels(), ['Breather']);
    // Nor does the forgotten beat count toward the beats opened in a chain.
    director.threads = Object.fromEntries([made('th_old', { created: { turn: 1 } }), ...Array.from({ length: WRAP_BEATS - 1 }, (_, i) => made(`th_${i}`, { created: { turn: 16 } }))]);
    assert.deepEqual(labels(), []);
    // An arc whose beats are open is not played out, however long they were quiet.
    director.threads = Object.fromEntries([made('th_arc', { created: { turn: 1 }, arc: 'arc_aaaaaaaa' })]);
    director.threads.th_done = { id: 'th_done', kind: 'beat', status: 'resolved', track: { created: { turn: 1 }, closed: { turn: 16 }, arc: 'arc_aaaaaaaa' } };
    assert.deepEqual(labels(), []);
});

test('a beat dated more than one story day ahead holds no chain; one dated tomorrow or past does, however quiet', () => {
    const calendar = calendarOf(settingsDefaults(), null);
    const minutes = calendar.parse('June 3, 1200, 08:00 am', {}).abs;
    const director = { turn: { n: 40 }, threads: { th_a: { id: 'th_a', key: 'Fair', kind: 'beat', status: 'active', fields: {}, track: { created: { turn: 1 } } } } };
    const labels = (on, clock = minutes) => { director.threads.th_a.fields = { on }; return pacingLines({}, director, { state: {}, calendar, minutes: clock }).map(entry => entry.label); };
    assert.deepEqual(labels('June 4, 1200'), ['Wrap-up'], 'tomorrow');
    assert.deepEqual(labels('June 1, 1200'), ['Wrap-up'], 'past');
    assert.deepEqual(labels('June 5, 1200'), [], 'two days ahead');
    director.threads.th_a.track.created.turn = 28;
    assert.deepEqual(labels('June 5, 1200'), [], 'two days ahead, newly made');
    assert.deepEqual(labels('June 5, 1200', null), ['Wrap-up'], 'no clock: judged as undated');
    assert.deepEqual(labels('when the tide turns'), ['Wrap-up'], 'unreadable date: judged as undated');
    director.threads.th_a.track.created.turn = 1;
    assert.deepEqual(labels('when the tide turns'), []);
});

test(`a forgotten beat: no wrap-up once it was quiet for ${LIVE_REPLIES} replies, and a later chain gets its breather`, async t => {
    await story(t, async ({ host, say }) => {
        await say([beat('Signal Wire')]);
        const cues = [];
        for (let n = 0; n < LIVE_REPLIES + 3; n += 1) cues.push(await say());
        // The tail of quiet reply `k` was written `k - 1` replies after the beat was made.
        assert.deepEqual(cues, cues.map((_, i) => (i + 1 >= WRAP_REPLIES && i < LIVE_REPLIES ? ['Wrap-up'] : [])));
        await sameAfterReplay(host);
        await say([beat('Toll Man')]);
        await say([end('Toll Man')]);
        assert.deepEqual(await say(), ['Breather']);
        await sameAfterReplay(host);
    });
});

test('the wrap-up names up to three open beats, the oldest first', async t => {
    await story(t, async ({ host, say }) => {
        await say([beat('One')]);
        await say([beat('Two'), beat('Three'), beat('Four'), beat('Five'), end('Two')]);
        assert.deepEqual(await say(), ['Wrap-up']);
        assert.match(tailOf(host), /close its open beats \(One, Three, Four\) with ! beat lines/);
        await sameAfterReplay(host);
    });
});

test('no breather while an arc beat is due now', async t => {
    await story(t, async ({ host, say }) => {
        await say();
        const plan = ['ARC: Toll War — the toll rises', ...[3, 20, 22].map((day, i) => `BEAT: Step ${i + 1} — something | on: June ${day}, 1200`)].join('\n');
        assert.equal((await host.sdk.command('director.arc.accept', { plan, reason: 'manual' }, { cause: 'ui' })).ok, true);
        await say([beat('Ferry Row')]);
        await say([end('Ferry Row')]);
        assert.deepEqual(await say(), []);
        assert.match(tailOf(host), /\nDue now: [^\n]*Step 1/);
        await sameAfterReplay(host);
    });
});

test('breather: a new beat ends it, even one that is over in the same reply; a beat that never stayed open starts none', async t => {
    await story(t, async ({ say }) => {
        await say([beat('Flash'), end('Flash')]);
        assert.deepEqual(await say(), [], 'opened and ended in one reply: no chain');
        await say([beat('Ferry Row')]);
        await say([end('Ferry Row')]);
        assert.deepEqual(await say([beat('Toll Man')]), ['Breather']);
        assert.deepEqual(await say([end('Toll Man')]), [], 'a new beat is open');
        assert.deepEqual(await say([beat('Spark'), end('Spark')]), ['Breather']);
        assert.deepEqual(await say(), [], 'opened since');
    });
});

test(`wrap-up: from ${WRAP_REPLIES} replies, gone when no beat is open (then the breather); same after replay`, async t => {
    await story(t, async ({ host, say }) => {
        await say();
        await say([beat('Ferry Row')]);
        for (let ran = 1; ran < WRAP_REPLIES - 1; ran += 1) assert.deepEqual(await say(), [], `${ran} replies`);
        // A chain relayed from one beat to the next is one chain.
        assert.deepEqual(await say([beat('Toll Man'), end('Ferry Row')]), [], `${WRAP_REPLIES - 1} replies`);
        assert.deepEqual(await say(), ['Wrap-up']);
        assert.match(tailOf(host), new RegExp(`\\nWrap-up: this chain of events has run for ${WRAP_REPLIES} replies\\. Steer toward resolving it: close its open beats \\(Toll Man\\) with ! beat lines, no new escalation, unless \\S+ pushes it further\\.`));
        await sameAfterReplay(host);
        assert.deepEqual(await say([end('Toll Man')]), ['Wrap-up']);
        assert.match(tailOf(host), new RegExp(`run for ${WRAP_REPLIES + 1} replies`));
        assert.deepEqual(await say(), ['Breather']);
        // The next chain counts from its own start.
        await say([beat('Night Watch')]);
        assert.deepEqual(await say(), []);
    });
});

test(`wrap-up: at ${WRAP_BEATS} beats opened in the chain, not before; an earlier chain's beats do not count`, async t => {
    await story(t, async ({ host, say }) => {
        await say([beat('Old One'), beat('Old Two')]);
        await say([end('Old One'), end('Old Two')]);
        await say();
        await say();
        await say([beat('One'), beat('Two'), beat('Three')]);
        await say([beat('Four'), end('One')]);
        assert.deepEqual(await say(), [], `${WRAP_BEATS - 1} beats`);
        await say([beat('Five')]);
        assert.deepEqual(await say(), ['Wrap-up']);
        assert.match(tailOf(host), /run for 4 replies/);
        await sameAfterReplay(host);
    });
});

test('an arc plan\'s beats make no chain and no wrap-up; the arc played out starts the breather', async t => {
    await story(t, async ({ host, say }) => {
        await say();
        const names = Array.from({ length: WRAP_BEATS }, (_, i) => `Step ${i + 1}`);
        const plan = ['ARC: Toll War — the toll rises', ...names.map((name, i) => `BEAT: ${name} — something | on: June ${5 + 2 * i}, 1200`)].join('\n');
        const accepted = await host.sdk.command('director.arc.accept', { plan, reason: 'manual' }, { cause: 'ui' });
        assert.equal(accepted.ok, true, accepted.message);
        const planned = Object.values(host.head().domains.director.threads).filter(thread => thread.kind === 'beat');
        assert.equal(planned.length, WRAP_BEATS);
        assert.ok(planned.every(thread => thread.track.arc), 'each planned beat carries its arc');
        for (let n = 0; n < WRAP_REPLIES + 1; n += 1) assert.deepEqual(await say(), [], `reply ${n + 1} of the arc`);
        // A story beat beside the running arc has its own chain and its own breather.
        await say([beat('Ferry Row')]);
        await say([end('Ferry Row')]);
        assert.deepEqual(await say(), ['Breather']);
        await say();
        assert.deepEqual(await say(), []);
        assert.deepEqual(await say(names.slice(1).map(end)), [], 'one arc beat still open');
        assert.deepEqual(await say(), []);
        assert.deepEqual(await say([end(names[0])]), []);
        assert.deepEqual(await say(), ['Breather']);
        await sameAfterReplay(host);
        // The next arc, accepted at once, keeps the breather.
        const after = ['ARC: Salt Road — the road opens', ...names.slice(0, 3).map((name, i) => `BEAT: Road ${name} — something | on: June ${20 + i}, 1200`)].join('\n');
        const again = await host.sdk.command('director.arc.accept', { plan: after, reason: 'arc-end' }, { cause: 'ui' });
        assert.equal(again.ok, true, again.message);
        assert.deepEqual(await say(), ['Breather']);
        assert.deepEqual(await say(), []);
    });
});

test('a wrap-up on a chain\'s first reply says "1 reply"', () => {
    const threads = Object.fromEntries(Array.from({ length: WRAP_BEATS }, (_, i) => [`th_${i}`, { id: `th_${i}`, kind: 'beat', status: 'active', track: { created: { turn: 3 } } }]));
    assert.match(pacingLines({}, { turn: { n: 3 }, threads }, { state: {} })[0].text, /has run for 1 reply\. /);
});

test('quiet scene: the switch adds its line and off removes it; none while the World pulse is off', async t => {
    await story(t, async ({ host, say }) => {
        assert.deepEqual(await say(), []);
        assert.equal((await host.sdk.command('director.pulse.quiet', { on: true })).ok, true);
        assert.deepEqual(await say(), ['Quiet scene']);
        assert.match(tailOf(host), /\nQuiet scene: no new beat, clock or agenda this reply unless \S+ starts one\./);
        await sameAfterReplay(host);
        // With a breather: both, the breather first.
        await say([beat('Ferry Row')]);
        await say([end('Ferry Row')]);
        assert.deepEqual(await say(), ['Breather', 'Quiet scene']);
        assert.equal((await host.sdk.command('director.pulse.quiet', { on: false })).ok, true);
        assert.deepEqual(await say(), ['Breather']);
        assert.equal((await host.sdk.command('director.pulse.quiet', { on: true })).ok, true);
        host.features.set('story-director.pulse', false);
        assert.deepEqual(await say(), [], 'the switch is not shown');
    });
});

test('no cue while the world-building threads are off: no beats are taught', () => {
    const director = { turn: { n: 14 }, threads: { th_aaaaaaaa: { id: 'th_aaaaaaaa', kind: 'beat', status: 'active', track: { created: { turn: 1 } } } } };
    const view = { query: () => ({ on: true }) };
    assert.deepEqual(pacingLines(view, director, { state: {} }).map(entry => entry.label), ['Wrap-up', 'Quiet scene']);
    assert.deepEqual(pacingLines(view, director, { state: {}, threads: false }), []);
});

test('the cues are plain lines of the tail, right under the header', async t => {
    const { directorTail } = await import('../../../../modules/time/tracker/note.js');
    await story(t, async ({ host, say }) => {
        await say([beat('Ferry Row')]);
        await say([end('Ferry Row')]);
        const { lines } = directorTail({ state: host.head(), settings: {}, chat: { length: 5, lastUser: '' } });
        const at = lines.findIndex(line => typeof line === 'string' && line.startsWith('Breather: '));
        assert.ok(at > 0, JSON.stringify(lines));
        assert.match(String(lines[at - 1]), /^\[Story Director/);
    });
});
