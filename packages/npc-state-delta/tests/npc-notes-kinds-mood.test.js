import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';
import { validateNpcSlice } from '../src/npc-meters.js';
import { readLeaf } from '../src/npc-meters-config.js';
import { ON, oren, cast } from './npc-notes-kinds.helpers.js';

test('mood words: the fixed lexicon gives the axes of a word or phrase, an unknown text gives none, a negated word does not count, and the numbers always settle toward rest', async () => {
    const { moodFromWord, applyWord, decayMood, restMood, nextMoodLog, readMoodLog } = await import('../npc-mood.js');
    assert.deepEqual(moodFromWord('mortified and flustered'), { v: -2, a: 2, d: -3, words: ['mortified', 'flustered'] }, 'the mean of the words found, rounded away from zero');
    assert.deepEqual(moodFromWord('Alarmed'), { v: -2, a: 3, d: -2, words: ['alarmed'] });
    assert.equal(moodFromWord('xyzzy plugh'), null, 'no known word: no numbers, never a guess');
    assert.equal(moodFromWord(''), null);
    const rest = restMood({}, 0);
    const moved = applyWord(rest, 600, moodFromWord('mortified and flustered'), 'mortified and flustered', 'the mishap');
    assert.deepEqual([moved.mood.v, moved.mood.a, moved.mood.d], [-2, 2, -3]);
    assert.deepEqual(moved.change, { v: -2, a: 2, d: -3 });
    assert.equal(moved.mood.cause, 'now mortified and flustered — the mishap');
    const later = decayMood(moved.mood, 600 + 1440 * 5);
    assert.ok(Math.abs(later.v) < 2 && Math.abs(later.d) <= 3, 'fades toward the resting mood');
    const text = nextMoodLog(null, { n: 4, date: 'Goldwane 21', change: moved.change, why: 'the mishap' });
    assert.deepEqual(readMoodLog(text), [{ n: 4, date: 'Goldwane 21', v: -2, a: 2, d: -3, why: 'the mishap' }]);
    assert.equal(nextMoodLog(text, { n: 5, change: { v: 0, a: 0, d: 0 } }), null, 'a reply that moved nothing writes no entry');
    assert.deepEqual(readMoodLog('{"e":[{"n":1}]}'), [], 'an unreadable entry is dropped');
});

test('notes host: npc.mood sets the three numbers from the scanner\'s word, logs the move with its reason, keeps the numbers for an unrated word, and rebuild equals live', async () => {
    const s = await suite({ allowance: null, features: { ...ON, 'npc-state-delta.mood-pull': true } });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    const slice = () => s.host.head().domains.people?.bonds;
    assert.equal((await s.host.sdk.command('npc.mood', { name: 'Oren', word: 'mortified' })).ok, false, 'not from a button');
    const head = s.host.store.headIndex();
    await s.adapter.mood({ name: 'Oren', word: 'mortified and flustered', reason: 'the wardrobe mishap', reply: head });
    const oren = slice().npcs.npc_oren;
    const mood = readLeaf(oren.mood);
    assert.deepEqual([mood.v, mood.a, mood.d], [-2, 2, -3]);
    const log = readLeaf(oren.moodLog).e;
    assert.equal(log.length, 1);
    assert.deepEqual([log[0].n, log[0].v, log[0].a, log[0].d, log[0].why], [head, -2, 2, -3, 'now mortified and flustered — the wardrobe mishap']);
    assert.deepEqual(validateNpcSlice(slice()), []);
    const view = (await cast(s)).mood;
    assert.deepEqual([view.valence, view.energy, view.control], [-2, 2, -3], 'the query carries the raw axes');
    assert.deepEqual(view.log.map(row => [row.n, row.v, row.a, row.d]), [[head, -2, 2, -3]], 'and the history');
    const before = JSON.stringify(slice());
    assert.equal((await s.adapter.mood({ name: 'Oren', word: 'mortified and flustered', again: true })).ok, false, 'a catch-up is refused when the mood already follows a move');
    assert.equal(JSON.stringify(slice()), before);
    // a word with no numbers and no known word keeps the numbers and says so (never silently nothing)
    assert.equal((await s.adapter.mood({ name: 'Oren', word: 'xyzzy', reply: head })).ok, true);
    const kept = readLeaf(slice().npcs.npc_oren.mood);
    assert.deepEqual([kept.v, kept.a, kept.d], [-2, 2, -3], 'the previous numbers stay');
    assert.equal(kept.cause, 'now xyzzy — mood word not rated');
    assert.equal(readLeaf(slice().npcs.npc_oren.moodLog).e.length, 1, 'no movement: no new history row');
    const after = JSON.stringify(slice());
    s.host.store.rebuild();
    assert.equal(JSON.stringify(slice()), after, 'rebuild equals live');
    assert.deepEqual(s.host.store.problems(), []);
});

test('notes host: a caught lie (a trust drop) writes its move on the mood history with the cause', async () => {
    const s = await suite({ allowance: null, features: { ...ON, 'npc-state-delta.mood-pull': true } });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    await s.say(['~ lie Oren | to: Astra | said: I never sold the spell']);
    await s.say(['~ lie Oren | to: Astra | caught: yes']);
    const log = readLeaf(oren(s).moodLog)?.e ?? [];
    assert.equal(log.length, 1, 'the trust drop made one entry');
    assert.match(log[0].why, /caught lying to Astra/);
    assert.ok(log[0].v < 0 && log[0].a > 0, 'the axes moved the way the event says');
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
    const live = JSON.stringify(s.host.head().domains.people?.bonds);
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.head().domains.people?.bonds), live, 'rebuild equals live');
});

test('notes host: the reason a story line gave is kept on the reply\'s last event and read back by the card summary; a line without one keeps none', async () => {
    const { readEvent, eventSummary } = await import('../src/npc-meters-pacing.js');
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ npc Oren | affection: +2 | reason: Astra helped her cover up after the mishap']);
    assert.equal(eventSummary(readEvent(oren(s).lastEvent)).why, 'Astra helped her cover up after the mishap');
    await s.say(['~ npc Oren | affection: +1']);
    assert.equal(eventSummary(readEvent(oren(s).lastEvent)).why, undefined, 'no reason given: none kept');
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
    const live = JSON.stringify(s.host.head().domains.people?.bonds);
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.head().domains.people?.bonds), live, 'rebuild equals live');
});

test('replay: a Re-read of a reply the older code read writes no mood history and keeps no story reason; a first read and a read the new code made do', async () => {
    const { writeMood, reasonKept } = await import('../src/npc-meters-slice.js');
    const { restMood, applyEvents } = await import('../npc-mood.js');
    const prev = restMood({}, 0);
    const mood = applyEvents(prev, 100, [{ kind: 'trust-drop', reason: 'Astra lied' }]);
    const write = ctx => { const record = {}; writeMood(ctx, 'oren', record, { prev, mood, day: 100, n: 4, date: 'Goldwane 1' }); return record; };
    assert.ok(write({}).moodLog, 'a first read writes the history');
    assert.equal(write({ standing: { domains: { npc: { npcs: { oren: { mood: '{}' } } } } } }).moodLog, undefined, 'the earlier read had none: this one has none');
    assert.ok(write({ standing: { domains: { npc: { npcs: { oren: { moodLog: '{"e":[]}' } } } } } }).moodLog, 'the earlier read wrote it: so does this one');
    assert.equal(reasonKept({}, 'oren', 'because'), 'because');
    assert.equal(reasonKept({ standing: { domains: { npc: { npcs: { oren: { lastEvent: '{"at":1,"date":"","events":[]}' } } } } } }, 'oren', 'because'), '', 'the earlier read kept no reason');
    assert.equal(reasonKept({ standing: { domains: { npc: { npcs: { oren: { lastEvent: '{"events":[{"why":"x"}]}' } } } } } }, 'oren', 'because'), 'because');
});

test('notes host: the catch-up (again) gives a mood word kept from before the numbers existed its numbers, once', async () => {
    const s = await suite({ allowance: null, features: { ...ON, 'npc-state-delta.mood-pull': true } });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    await s.adapter.meet({ name: 'Oren', personality: 'quiet' });
    const slice = () => s.host.head().domains.people?.bonds;
    assert.deepEqual([readLeaf(slice().npcs.npc_oren.mood).v, readLeaf(slice().npcs.npc_oren.mood).a], [0, 0], 'at rest, no cause');
    assert.equal((await s.adapter.mood({ name: 'Oren', word: 'wary', again: true })).ok, true);
    assert.deepEqual([readLeaf(slice().npcs.npc_oren.mood).v, readLeaf(slice().npcs.npc_oren.mood).a, readLeaf(slice().npcs.npc_oren.mood).d], [-1, 1, 0]);
    assert.equal((await s.adapter.mood({ name: 'Oren', word: 'wary', again: true })).ok, false, 'the second catch-up finds a mood that already follows a move');
    assert.deepEqual(validateNpcSlice(slice()), []);
});

test('display: a person with a scanner word and the numbers the command wrote shows the scanner\'s word', async () => {
    const { moodTile } = await import('../dossier-ui-view-model.js');
    const { v2MetersProjection } = await import('../dossier-ui-meters.js');
    const view = { mood: { word: 'Alarmed', valence: -2, energy: 2, control: -3, bars: { energy: 5, control: 0, max: 6 }, cause: 'now mortified and flustered', log: [] }, bars: [], secrets: [] };
    const tile = moodTile({ mood: 'Mortified and flustered', v2Meters: v2MetersProjection(view) }, 4);
    assert.equal(tile.text, 'Mortified and flustered');
    assert.deepEqual(tile.rows.map(row => row.value), [-2, 2, -3], 'the three rows hold the numbers');
});

// ---- VADFIX2: numbers from the scan, the widened word list, negation, history keyed by reply id, the entry-less mood ----
// Every mood text the scanner wrote in the live runs of 11-12 Nov (liverun2, liverun3), one per line.
const REAL_MOODS = `quietly relieved
wary and desperate
relieved and winded
bored and mechanical
transactional and shrewd
brisk and dry
wry, guarded, indifferent
withdrawn, anxious, guarded.
cynical and indifferent
quietly cynical, wary of newcomers
furious and fed up
irritable, spiteful, stubborn
gruff, pragmatic
alarmed, hurried
curt, vigilant, indifferent
stressed, urgent
cautious, calculating, watchful.
brisk and impatient
brisk, bureaucratic
flustered and irritable
suspicious and sharp
observant, measured
in shock and agony
indifferent, weary, routine.
suspicious and blunt
dry, businesslike
methodical and pedantic
direct and procedural
stunned and nervous
withdrawn, mildly anxious
terrified and urgent
distrustful and inquisitive
impassive and dry
hurried and self-important
pragmatic and wry
crisp and dismissive
irritated and blunt
indifferent, bureaucratic, dismissive.
impassive and dismissive
brisk, bureaucratic, impatient
furious and mortified by patron ridicule
rattled and contrite
terrified and skittish
irritable and blunt
urgent and hurried
violent and pragmatic
nervous and sore
conspiratorial and hurried
guarded and hurried
startled and aggressive
blunt and skeptical
blunt, dryly amused, practical
pragmatic and dry
businesslike, watchful
suspicious, irritated, blunt
eager and nervous, eyeing the table and taps for ale
gruff and businesslike
brisk and dismissive
dry, guarded, observant
eager and self-important
opportunistic and calculating
hurried and guarded
wary and mistrustful of unearned charity
suspicious, dismissive
stunned, wary, and quietly grateful
businesslike and mildly observant
impressed and businesslike
furious, embarrassed, hostile
anxious and urgent
calculating and discreet
frightened and defensive
defensive, nervous, hostile
terrified of being overheard
terrified and guarded
exasperated and sharp
hostile, vigilant, and aggressive
frantic and urgent
defensive and embarrassed
flustered but rigid
relieved but weary
embarrassed, flustered, irritable
eager, alert for coin or ale
terrified and secretive
frightened, suspicious, overwhelmed by high coin
bewildered and hungry
flustered, caught out
hostile, violent, aggressive
bureaucratic
anxious and fearful of discovery
bewildered and subdued`.split('\n');

test('mood words (real runs): every mood text the scanner really wrote maps to numbers, none is left unread', async () => {
    const { moodFromWord } = await import('../npc-mood.js');
    assert.equal(REAL_MOODS.length, 90);
    const unread = REAL_MOODS.filter(text => !moodFromWord(text));
    assert.deepEqual(unread, [], 'no real mood text is left without numbers');
    assert.deepEqual(moodFromWord('gruff, pragmatic'), { v: -1, a: 1, d: 2, words: ['gruff', 'pragmatic'] }, 'a word the first list missed (Gruff) now reads');
    assert.deepEqual(moodFromWord('Wary and desperate'), { v: -2, a: 2, d: -1, words: ['wary', 'desperate'] });
    assert.ok(moodFromWord('Breathless') && moodFromWord('Impatient') && moodFromWord('curt and bureaucratic'), 'the words the review named');
});

test('mood words: a negated word does not count (not / no longer / never / less / n\'t), only in its own clause', async () => {
    const { moodFromWord } = await import('../npc-mood.js');
    assert.equal(moodFromWord('not angry'), null);
    assert.equal(moodFromWord('never afraid'), null);
    assert.equal(moodFromWord('less angry'), null);
    assert.equal(moodFromWord("isn't angry"), null);
    assert.deepEqual(moodFromWord('calm but not happy')?.words, ['calm']);
    assert.deepEqual(moodFromWord('no longer scared, calm')?.words, ['calm'], 'the clause after the comma stands on its own');
    assert.deepEqual(moodFromWord('not angry, furious')?.words, ['furious']);
    assert.deepEqual(moodFromWord('angry and furious')?.words, ['angry', 'furious'], 'no negator: both count');
});

test('mood numbers the scanner gives: whole numbers clamped to -3..3, all three or none', async () => {
    const { moodNumbers } = await import('../npc-mood.js');
    assert.deepEqual(moodNumbers({ moodV: 2, moodA: '-1', moodD: 0 }), { v: 2, a: -1, d: 0 });
    assert.deepEqual(moodNumbers({ moodV: 9, moodA: -9, moodD: 1.6 }), { v: 3, a: -3, d: 2 }, 'clamped and whole');
    assert.deepEqual(moodNumbers({ v: 1, a: 1, d: -1 }), { v: 1, a: 1, d: -1 }, 'the command\'s own shape');
    assert.equal(moodNumbers({ moodV: 1, moodA: 1 }), null, 'one missing: none');
    assert.equal(moodNumbers({ moodV: 'high', moodA: 1, moodD: 1 }), null);
    assert.equal(moodNumbers(null), null);
    assert.equal(moodNumbers({ moodV: null, moodA: '', moodD: 1 }), null);
});

test('mood history: the same reply is the same record id, a netted-out move drops its row', async () => {
    const { nextMoodLog, readMoodLog } = await import('../npc-mood.js');
    const one = nextMoodLog(null, { n: 4, s: 'r-a', date: 'D1', change: { v: -1, a: 2, d: 0 }, why: 'first' });
    assert.deepEqual(readMoodLog(one).map(row => [row.n, row.s]), [[4, 'r-a']]);
    // the same index but another record id (a delete in the middle shifted the chat): another reply, another row
    const two = nextMoodLog(one, { n: 4, s: 'r-b', date: 'D1', change: { v: 1, a: 0, d: 0 }, why: 'other' });
    assert.deepEqual(readMoodLog(two).map(row => [row.s, row.v]), [['r-b', 1], ['r-a', -1]]);
    // the same record id at another index: the same reply, its moves add
    const three = nextMoodLog(two, { n: 3, s: 'r-b', date: 'D1', change: { v: 1, a: 0, d: 0 }, why: 'again' });
    assert.deepEqual(readMoodLog(three).map(row => [row.s, row.v, row.why]), [['r-b', 2, 'other; again'], ['r-a', -1, 'first']]);
    // a move that cancels the reply's earlier one: the row goes, the older rows stay
    const four = nextMoodLog(two, { n: 4, s: 'r-b', date: 'D1', change: { v: -1, a: 0, d: 0 }, why: 'undo' });
    assert.deepEqual(readMoodLog(four).map(row => row.s), ['r-a'], 'the net-zero reply has no row');
    // no record id on either side: the index decides, as before
    const old = nextMoodLog(null, { n: 7, date: 'D', change: { v: 1, a: 0, d: 0 } });
    assert.equal(readMoodLog(nextMoodLog(old, { n: 7, date: 'D', change: { v: 1, a: 0, d: 0 } }))[0].v, 2);
    assert.equal(nextMoodLog(null, { n: 1, s: 'x', change: { v: 0, a: 0, d: 0 } }), null, 'nothing moved, nothing before: nothing written');
});

test('notes host: npc.mood takes the three numbers the scan gave over the word list, writes the reply id on the history, and an unrated word keeps them', async () => {
    const s = await suite({ allowance: null, features: { ...ON, 'npc-state-delta.mood-pull': true } });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    const slice = () => s.host.head().domains.people?.bonds;
    const head = s.host.store.headIndex();
    // 'Impatient' is on the list too, but the scan's own numbers win
    assert.equal((await s.adapter.mood({ name: 'Oren', word: 'Impatient', vad: { v: 2, a: -2, d: 3 }, reply: head })).ok, true);
    let mood = readLeaf(slice().npcs.npc_oren.mood);
    assert.deepEqual([mood.v, mood.a, mood.d], [2, -2, 3], 'the numbers the scan gave');
    const row = readLeaf(slice().npcs.npc_oren.moodLog).e[0];
    assert.equal(row.n, head);
    assert.equal(typeof row.s, 'string', 'the history names the reply by its record id');
    // an unknown word without numbers: the numbers stay and the reason says so
    await s.adapter.mood({ name: 'Oren', word: 'Zonked', reply: head });
    mood = readLeaf(slice().npcs.npc_oren.mood);
    assert.deepEqual([mood.v, mood.a, mood.d], [2, -2, 3]);
    assert.match(mood.cause, /mood word not rated/);
    assert.deepEqual(validateNpcSlice(slice()), []);
    const live = JSON.stringify(slice());
    s.host.store.rebuild();
    assert.equal(JSON.stringify(slice()), live, 'rebuild equals live');
    // the fallback: no numbers, a known word with a negation
    await s.say(['~ npc Oren | trust: +1']);
    await s.adapter.mood({ name: 'Oren', word: 'not angry, wary', reply: s.host.store.headIndex() });
    mood = readLeaf(slice().npcs.npc_oren.mood);
    assert.deepEqual([mood.v, mood.a, mood.d], [-1, 1, 0], 'only "wary" counts');
});

test('notes host: npc.mood for a person the meeting has not made (it was refused) rests at their temperament, not at 0/0/0', async () => {
    const s = await suite({ allowance: null, features: { ...ON, 'npc-state-delta.mood-pull': true } });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    const slice = () => s.host.head().domains.people?.bonds;
    assert.equal(slice().npcs.npc_pell, undefined);
    assert.equal((await s.adapter.mood({ name: 'Pell', word: 'Zonked', personality: 'cheerful, warm and kind', about: '', reply: s.host.store.headIndex() })).ok, true);
    const mood = readLeaf(slice().npcs.npc_pell.mood);
    assert.deepEqual([mood.v, mood.a, mood.d], [2, 0, 0], 'the mood sits at the resting mood the words give');
    assert.deepEqual(mood.rest, { v: 2, a: 0, d: 0 }, 'so it fades toward the person\'s calm');
    assert.deepEqual(validateNpcSlice(slice()), []);
});
