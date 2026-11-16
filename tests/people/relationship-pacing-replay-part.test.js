import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNpcSlice, createNpcPart } from '../../modules/people/meters/npc-meters.js';
import { eventSummary, nextEvent, readEvent } from '../../modules/people/meters/npc-meters-pacing.js';
import { FEATURE_GATE, FEATURE_MOOD_PULL, CONTEXT_BUDGET, readLeaf } from '../../modules/people/meters/npc-meters-config.js';
import { applyEvents, eventsFromMoves, moodBars, moodWord, storedMoodWord } from '../../modules/people/meters/npc-mood.js';
import { stepPull } from '../../modules/people/meters/npc-instincts.js';
import { DAY, suite } from './helpers/pacing-suite.js';
import { MOOD_ON, moodSuite, noCue, plain, recordOf, toOld, world, worldModule } from './relationship-pacing.helpers.js';

test('the tail tells mood and pull for present people only; feature off: the tail and the static line are byte-identical to before', () => {
    const record = (name, extra) => ({ name, meters: { trust: 5, affection: 0, desire: 0, tension: 0 }, stages: {}, unlocked: [], turn: { reply: 2, from: {} }, day: 5, ...extra });
    const state = { domains: { people: { v: 1, order: [], npcs: {}, bonds: { problems: [], npcs: {
        npc_mira: record('Mira', { mood: { v: -2, a: 2, d: -2, day: 5, cause: 'betrayed: Astra lied' }, pull: { kind: 'closure', cause: 'the stolen letter', since: 2 }, inst: { belo: 0, clos: 2, awe: 0 } }),
        npc_oren: record('Oren', { mood: { v: 2, a: 0, d: 0, day: 5, cause: '' } }),
        npc_tomas: record('Tomas', { mood: { v: -3, a: 3, d: 0, day: 5, cause: 'x' }, pull: { kind: 'awe', cause: 'first time at the harbor', since: 5 } }),
    } } } } };
    const make = on => createNpcPart({ settings: () => ({}), present: () => ['Mira', 'Oren'], feature: id => (id === FEATURE_MOOD_PULL ? on : undefined) });
    const view = { state, chat: { length: 3 } };
    const off = make(false);
    const base = off.context.tail(view);
    assert.deepEqual(noCue(base.optional), [], 'off: no mood or pull line at all');
    const bare = JSON.parse(JSON.stringify(view));
    for (const person of Object.values(bare.state.domains.people.bonds.npcs)) { delete person.mood; delete person.pull; delete person.inst; }
    assert.equal(JSON.stringify(base), JSON.stringify(off.context.tail(bare)), 'off: the tail does not read mood or pull at all');
    const on = make(true);
    assert.equal(on.context.static(), off.context.static(), 'the static prompt never changes');
    const told = on.context.tail(view);
    // The cue stays where it was among the lines; Pull and Mood come after it (they take what the kept cap leaves).
    const cueAt = base.lines.length - 1;
    assert.deepEqual(told.lines.slice(0, cueAt + 1), base.lines.slice(0, cueAt + 1), 'the meter lines and the cue are untouched');
    // Kept lines (run 3: as optional lines the host's tail budget cut them): the first person's Pull, then Mood; the others are optional.
    const feltLines = told.lines.slice(cueAt + 1);
    const felt = feltLines.map(line => line.text);
    assert.ok(feltLines.every(line => line.keep === true));
    assert.deepEqual(felt, ['Pull: Mira: closure (the stolen letter, 3 days).', 'Mood: Mira alarmed, cornered.'], 'present people only: Tomas is not here');
    assert.deepEqual(noCue(told.optional), ['Mood: Oren content.'], 'the second person is an optional line, never a required one');
    const tokens = text => Math.ceil(text.length / 4);
    assert.ok(tokens(felt.join('\n')) <= 28, `the two lines stay small (${tokens(felt.join('\n'))} tokens, budget ${CONTEXT_BUDGET})`);
    assert.ok(felt.every(line => !/[<>]/.test(line)));
});

test('mood and pull: replay equals rebuild through swipes, a Re-read, a middle delete and a cold reload; the slice validates; a feature-off chat gets no new field', async t => {
    t.mock.method(console, 'warn', () => {});
    const s = await moodSuite();
    await s.setDay(1);
    await world(s, { party: [{ id: 'a', name: 'Oren' }], threads: [{ id: 'th_cccccccc', key: 'Old debt', status: 'active', fields: { people: 'Oren' } }] });
    await s.say(['~ npc Oren | trust: +1', '~ npc Sister Temiwa | trust: +1']);
    const setup = s.host.store.headIndex();
    for (const [day, line] of [[2, '~ npc Oren | trust: -2 | impact: meaningful | reason: a broken oath'], [4, '~ npc Sister Temiwa | trust: -6 | impact: extreme'], [6, '~ npc Oren | trust: +4']]) {
        await s.setDay(day);
        await s.say([line]);
        await s.swipe([line]);
        assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
        const head = JSON.stringify(s.host.head());
        s.host.store.rebuild();
        assert.equal(JSON.stringify(s.host.head()), head, `day ${day}: replay equals rebuild`);
    }
    const replies = s.host.ctx.chat.map((message, at) => (!message.is_user && at > setup && at < s.host.store.headIndex() ? at : -1)).filter(at => at >= 0);
    await s.host.st.deleteMessage(replies[0]);
    await s.host.st.deleteMessage(replies[0] - 1);
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
    const head = JSON.stringify(s.host.head());
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.head()), head, 'after the middle delete: replay equals rebuild');
    const off = await suite({ allowance: null, modules: [worldModule], features: { [FEATURE_MOOD_PULL]: false } });
    await off.setDay(2);
    await world(off, { threads: [{ id: 'th_dddddddd', key: 'Old debt', status: 'active', fields: { people: 'Oren' } }] });
    await off.say(['~ npc Oren | trust: -3 | impact: major']);
    await off.setDay(6);
    await off.say([]);
    assert.deepEqual(Object.keys(recordOf(off)).filter(key => ['mood', 'inst', 'pull', 'track'].includes(key)), [], 'feature off: no mood, pull or memory on a record');
});

test('validator: a malformed mood, instinct, pull or memory is refused; every old record shape stays valid', () => {
    const base = { name: 'Mira', meters: { trust: 0, affection: 0, desire: 0, tension: 0 }, stages: {}, unlocked: [] };
    const check = extra => validateNpcSlice({ npcs: { npc_mira: { ...base, ...extra } }, problems: [] });
    assert.deepEqual(check({}), []);
    assert.deepEqual(check({ mood: { v: 1, a: -3, d: 0, day: 4, cause: 'rested' }, inst: { belo: 1, clos: 0, awe: 3 }, pull: { kind: 'closure', cause: 'a letter', since: 2 }, track: { party: 1, join: 3, threads: { th_aaaaaaaa: 2 }, places: ['Harbor'] } }), []);
    for (const bad of [{ mood: { v: 9, a: 0, d: 0, day: 0, cause: '' } }, { mood: { v: 1, a: 0, d: 0 } }, { mood: 'sad' }, { inst: { belo: 4 } }, { inst: { fear: 1 } }, { pull: { kind: 'fear', cause: 'x', since: 1 } },
        { pull: { kind: 'awe', cause: 'x', since: -1 } }, { pull: { kind: 'awe', cause: 'x', since: 1, extra: 1 } }, { track: { party: 2 } }, { track: { places: new Array(7).fill('p') } }, { track: { other: 1 } }]) {
        assert.notDeepEqual(check(bad), [], JSON.stringify(bad));
    }
});

test('mood and pull cores: the 3x3 word table, the bars, decay that never passes 0, bad input is no signal', () => {
    assert.deepEqual([moodWord({ v: -3, a: 3, d: 0, day: 0, cause: '' }), moodWord({ v: 0, a: 0, d: 0, day: 0, cause: '' }), moodWord({ v: 3, a: -3, d: 0, day: 0, cause: '' })], ['Alarmed', 'Steady', 'Calm']);
    assert.deepEqual(moodBars({ v: 0, a: 3, d: -3, day: 0, cause: '' }), { energy: 6, control: 0, max: 6 });
    assert.deepEqual(plain(applyEvents({ v: -1, a: 1, d: 0, day: 2, cause: 'x' }, 9 * DAY, [])), { v: 0, a: 0, d: 0, day: 9, cause: 'x' });
    assert.deepEqual(plain(applyEvents(null, DAY, [{ kind: 'nonsense' }])), { v: 0, a: 0, d: 0, day: 1, cause: '' });
    assert.deepEqual(eventsFromMoves([{ meter: 'trust', change: -1 }]), [], 'one point is no drop');
    assert.equal(eventsFromMoves([{ meter: 'trust', change: -3 }], { impact: 'major' })[0].kind, 'betrayal');
    assert.equal(eventsFromMoves([{ meter: 'trust', change: -3 }], { impact: 'meaningful' })[0].kind, 'trust-drop');
    assert.deepEqual(stepPull({}, { day: null, threads: [{ id: 'x', title: 't' }] }).pull, null, 'no story day: no signal');
    assert.deepEqual(stepPull(undefined, { day: 3, party: null, here: '', present: true, threads: [] }), { track: {}, inst: { belo: 0, clos: 0, awe: 0 }, pull: null });
    const joined = stepPull({ party: 0 }, { day: 4, party: true, threads: [] });
    assert.deepEqual(joined.pull, { kind: 'belonging', cause: 'new to the party', since: 4 });
});

// ---- the new defaults (anti-lever gate, mood and pull, notes are on) against replies already written ----

test('defaults on: a chat written with the three features off (a ladder ticking every reply) replays unchanged after they are switched on, and every old reply, a trust drop included, is read again identically', async () => {
    const off = { [FEATURE_GATE]: false, [FEATURE_MOOD_PULL]: false, 'npc-state-delta.notes': false };
    const s = await suite({ allowance: null, features: off, settings: { ladder: [{ name: 'Friend', needs: 'trust 2' }] } });
    const bare = x => JSON.stringify(x.host.head().domains.people?.bonds).replace(/sw_[a-z0-9]+/g, 'sw');
    await s.setDay(1);
    const first = await s.say(['~ npc Oren | trust: +2 | impact: meaningful']);
    const dropAt = await s.say(['~ npc Oren | trust: -3 | impact: major | reason: a broken oath']);
    const calmAt = await s.say(['~ npc Sister Temiwa | affection: +1']);
    const last = await s.say(['~ npc Oren | trust: +4 | impact: major']);
    const written = bare(s);
    assert.ok(JSON.parse(written).npcs.npc_oren.rank, 'the old chat has a ladder rank (its ticks ran)');
    for (const id of Object.keys(off)) s.host.features.set(id, true);
    s.host.store.rebuild();
    assert.equal(bare(s), written, 'rebuild under the new defaults: the stored ops give the same state');
    await s.host.st.loadChat(s.host.ctx.chat);
    await s.adapter.ticked();
    assert.equal(bare(s), written, 'a cold reload under the new defaults: the same state');
    for (const index of [first, dropAt, calmAt, last]) {
        assert.equal((await s.host.sdk.reread(index)).ok, true);
        assert.equal(bare(s), written, `a Re-read of old reply ${index}: byte-identical`);
    }
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
    // A reply written with the feature on keeps its mood on a Re-read (the reply as it stood had one).
    await s.say(['~ npc Oren | trust: -3 | impact: major | reason: a second oath']);
    const fresh = await s.say(['~ npc Oren | trust: -3 | impact: major | reason: a third oath']);
    assert.ok(JSON.parse(bare(s)).npcs.npc_oren.mood, 'a new reply gets its mood');
    const moody = bare(s);
    assert.equal((await s.host.sdk.reread(fresh)).ok, true);
    assert.equal(bare(s), moody, 'and a Re-read of that reply keeps it, as it was');
});

test('mood, pull, inst, track are stored whole as one text leaf: a middle delete of the reply that made them leaves no skipped change', async () => {
    const s = await moodSuite();
    await s.setDay(2);
    await s.say(['~ npc Oren | trust: +3']);
    const made = await s.say(['~ npc Oren | trust: -2 | impact: meaningful | reason: Astra lied']);
    await s.say(['~ npc Oren | trust: -2 | impact: meaningful | reason: Astra lied again']);
    await s.setDay(3);
    await s.say(['~ npc Oren | trust: +1']);
    await world(s, { party: [{ id: 'a', name: 'Oren' }], threads: [{ id: 'th_aaaaaaaa', key: 'The stolen letter', status: 'active', fields: { people: 'Oren' } }] });
    await s.say([]);
    await s.setDay(6);
    await s.say([]);
    const raw = s.host.head().domains.people.bonds.npcs.npc_oren;
    for (const field of ['mood', 'inst', 'pull', 'track']) assert.equal(typeof raw[field], 'string', `${field} is one text leaf`);
    assert.equal(readLeaf(raw.pull).kind, 'closure');
    assert.equal(typeof raw.mood, 'string', 'the mood is one text leaf');
    assert.match(readLeaf(raw.mood).cause, /Astra lied/);
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
    await s.host.st.deleteMessage(made);
    const live = JSON.stringify(s.host.head().domains.people?.bonds);
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.head().domains.people?.bonds), live, 'rebuild equals live after the delete');
    assert.deepEqual(s.host.store.problems(), [], 'nothing was skipped');
    assert.equal(readLeaf('{"a":1}').a, 1);
    assert.deepEqual(readLeaf({ a: 1 }), { a: 1 }, 'an old stored object reads as it is');
    assert.equal(readLeaf('not json'), undefined);
});

test('an old 1.16.0 chat (object leaves, per-field ops): a Re-read of a middle reply is ok and stores the same ops; replay equals live', async t => {
    t.mock.method(console, 'warn', () => {});
    const s = await moodSuite();
    await s.setDay(2);
    await s.say(['~ npc Oren | trust: +3']);
    const made = await s.say(['~ npc Oren | trust: -2 | impact: meaningful | reason: Astra lied']);
    await s.setDay(3);
    const mid = await s.say(['~ npc Oren | trust: -3 | impact: meaningful | reason: Astra lied again']);
    await s.setDay(5);
    await s.say(['~ npc Oren | affection: +1']);
    await s.setDay(7);
    const last = await s.say(['~ npc Oren | trust: -3 | impact: meaningful | reason: a lie found out']);
    const chat = s.host.st.ctx.chat;
    toOld(chat);
    s.host.store.rebuild();
    assert.deepEqual(s.host.store.problems(), [], 'the rewritten chat is a clean old chat');
    assert.equal(typeof s.host.head().domains.people.bonds.npcs.npc_oren.mood, 'object', 'the old chat holds the mood as an object');
    const opsOf = at => JSON.stringify(chat[at].extra.storySuite.ops);
    for (const at of [made, mid, last]) {
        const head = JSON.stringify(s.host.head().domains.people?.bonds);
        const ops = opsOf(at);
        const out = await s.host.sdk.reread(at);
        assert.equal(out.ok, true, `a Re-read of old reply ${at} is ok: ${JSON.stringify(out)}`);
        assert.equal(opsOf(at), ops, `a Re-read of old reply ${at} stores the same ops`);
        assert.equal(JSON.stringify(s.host.head().domains.people?.bonds), head, `and the same head (reply ${at})`);
        s.host.store.rebuild();
        assert.equal(JSON.stringify(s.host.head().domains.people?.bonds), head, 'replay equals live');
        assert.deepEqual(s.host.store.problems(), []);
    }
});

test('a fifth event on one reply is recorded: a spent one after four held ones is not hidden', () => {
    const base = { reply: 'r1', date: '', src: 'story', tier: 'ordinary', note: 'held today' };
    let text = null;
    for (let at = 0; at < 4; at += 1) text = nextEvent(text, { ...base, ask: { trust: 1 }, held: true });
    assert.equal(readEvent(text).events.length, 4);
    text = nextEvent(text, { ...base, src: 'scan', ask: { trust: 1 }, held: false, tier: 'meaningful' });
    const kept = readEvent(text);
    assert.equal(kept.events.length, 4, 'still at most four');
    assert.equal(eventSummary(kept).held, false, 'the card no longer says nothing moved');
    // An unfilled list just grows.
    assert.equal(readEvent(nextEvent(null, { ...base, ask: { trust: 1 }, held: true })).events.length, 1);
});

test('a fifth event keeps the gate event: the next prompt\'s gate cue reads it', () => {
    const base = { reply: 'r1', date: '', src: 'story', tier: 'ordinary', note: 'x', ask: { trust: 1 } };
    let text = nextEvent(null, { ...base, held: false, via: 'flirt', gate: { mode: 'less', n: 1, span: 3 } });
    for (let at = 0; at < 3; at += 1) text = nextEvent(text, { ...base, held: true });
    text = nextEvent(text, { ...base, src: 'scan', held: false });
    const kept = readEvent(text);
    assert.equal(kept.events.length, 4);
    assert.ok(kept.events.some(item => item.gate), 'the gate event is not the one dropped');
});

test('mood line: the person\'s stored word is printed as is (small numbers never turn it into a generic band word); the table word only when none is stored', () => {
    const record = (name, mood) => ({ name, meters: { trust: 5, affection: 0, desire: 0, tension: 0 }, stages: {}, unlocked: [], turn: { reply: 2, from: {} }, day: 5, mood });
    const make = names => createNpcPart({ settings: () => ({}), present: () => names, feature: id => (id === FEATURE_MOOD_PULL ? true : undefined) });
    const lineFor = mood => {
        const state = { domains: { people: { v: 1, order: [], npcs: {}, bonds: { problems: [], npcs: { npc_hanne: record('Hanne', mood) } } } } };
        return make(['Hanne']).context.tail({ state, chat: { length: 3 } }).lines.map(line => line.text).find(text => /^Mood: /.test(text));
    };
    // The same small numbers (+-1, table word "steady"/"calm") with six different stored words: the line follows the word.
    for (const word of ['pragmatic/amused', 'dry/watchful', 'blunt/exasperated', 'curt', 'brusque', 'grumpy']) {
        assert.equal(lineFor({ v: 0, a: 0, d: 1, day: 5, cause: `now ${word} — she counts coins` }), `Mood: Hanne ${word}.`);
    }
    // Strong control (the numbers' only say) keeps the hint after the word.
    assert.equal(lineFor({ v: -1, a: 1, d: -2, day: 5, cause: 'now Wary' }), 'Mood: Hanne wary, cornered.');
    // No stored word (an event cause, or none): the table word as before.
    assert.equal(lineFor({ v: 0, a: 0, d: 1, day: 5, cause: 'betrayed: Astra lied' }), 'Mood: Hanne steady.');
    assert.equal(lineFor({ v: 0, a: 0, d: 1, day: 5, cause: 'now mood word not rated' }), 'Mood: Hanne steady.');
    assert.equal(lineFor({ v: 0, a: 0, d: 0, day: 5, cause: 'now curt' }), undefined, 'all zeros still says nothing');
    assert.equal(storedMoodWord({ cause: 'now ' + 'x'.repeat(80) }).length, 30);
    assert.equal(storedMoodWord(null), '');
});
