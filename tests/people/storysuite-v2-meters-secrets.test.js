import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID } from '../../modules/people/storysuite-v2.js';
import { MAX_GENERATED_SECRETS, MAX_SECRETS, normalizeGeneratedSecrets, normalizeSecrets, secretId, secretsFromLines, secretsToLines, validateNpcSlice } from '../../modules/people/meters/npc-meters.js';
import { assemble } from '../../core/prompt.js';
import { buildInjection, buildNarrationCapturePrompt, buildProfileRefreshPrompt, buildScannerPrompt } from '../../modules/people/core/core.js';
import { withoutDossiers } from './helpers/seed-people.js';
import { EVENT, EVENT_SECRET, HIDDEN, KNOWN, SECRET, SECRET_TWO, eventNote, fakeDelta, host, noCue, plain } from './storysuite-v2-meters.helpers.js';

test('secrets: unlocked at the threshold with a receipt; locked ones are sent only as hidden while present; kept unlocked after', async () => {
    const h = await host();
    // Where a locked note's text may never be: the static part, the state, the queries and the dossier. It IS in the tail (hidden wording).
    const leaks = () => {
        const statics = h.def.context.static();
        const state = JSON.stringify(withoutDossiers(h.store.head()));   // (the stored dossiers hold their notes since P2; the meters must not)
        const dossier = JSON.stringify(h.runQuery('npc.dossier', { name: 'Mira' }));
        const all = JSON.stringify(h.runQuery('npc.meters', {})) + JSON.stringify(h.runQuery('npc.cast'));
        return [statics, state, dossier, all].some(text => text.includes(SECRET) || text.includes(SECRET_TWO));
    };
    // (lean) Two or more locked notes: the wording once, on the nearest note; each note then reads "Mira (hidden): text".
    const ONCE = 'Lines marked (hidden) are secrets: never state or reveal them; let them shape how that person acts.';
    const hidden = (text, first = false) => `${first ? `${ONCE}\n` : ''}Mira (hidden): ${text}`;
    h.reply('Nice.', '~ npc Mira | trust: +15');
    assert.equal(h.npc('Mira').meters.trust, 25);
    assert.deepEqual(h.npc('Mira').unlocked, []);
    assert.equal(leaks(), false, 'locked: nowhere in the static part, the state or the queries');
    const locked = h.def.context.tail(h.view());
    assert.deepEqual(noCue(locked.optional), [hidden(SECRET, true), hidden(SECRET_TWO)], 'present and locked: sent as hidden, the nearer to opening first (trust 25 of 30; tension 0 of -20)');
    assert.equal(plain(locked.lines).some(line => line.includes(SECRET) || line.includes(SECRET_TWO)), false, 'never as a known line');
    // Delta's own prompts never carry the hidden notes.
    const record = h.delta.api.getNpc('npc_mira');
    const injection = buildInjection([record], 'Mira laughs.', 3, 3);
    assert.ok(injection.includes('Mira'), 'the injection has Mira');
    assert.equal(injection.includes(SECRET), false);
    const scan = buildScannerPrompt({ transcript: 'USER: hi\nASSISTANT: Mira laughs.', currentTranscript: 'Mira laughs.', existingNpcs: [record], userName: 'Ari', charName: 'Narrator' });
    assert.equal(scan.includes(SECRET) || scan.includes(SECRET_TWO), false);
    const refresh = buildProfileRefreshPrompt({ transcript: '[m1] Mira laughs.', userName: 'Ari', charName: 'Narrator', targetNpc: record });
    const oneShot = buildNarrationCapturePrompt({ transcript: 'Mira laughs.', existingNpcs: [record], userName: 'Ari', charName: 'Narrator' });
    for (const text of [refresh, JSON.stringify(oneShot)]) assert.equal(text.includes(SECRET) || text.includes(SECRET_TWO), false, 'not in Refresh or one-pass capture');

    const [result] = h.reply('Trusted.', '~ npc Mira | trust: +5').results;
    const id = secretId('trust', 30, SECRET);
    assert.deepEqual(h.npc('Mira').unlocked, [id]);
    assert.match(result.receipt.summary, /Mira: a hidden note opened \(trust 30\)/);
    assert.equal(JSON.stringify(withoutDossiers(h.store.head())).includes(SECRET), false, 'the text never enters the meters or any other part of the state');
    const opened = h.def.context.tail(h.view());
    assert.deepEqual(plain(opened.lines).filter(line => line.includes(SECRET)), [`Mira, known to the player now; may come out: ${SECRET}`]);
    assert.deepEqual(noCue(opened.optional), [hidden(SECRET_TWO, true)], 'the other note is still locked: hidden wording');
    assert.equal(leaks(), false);
    // Not present: not told, locked or opened.
    h.delta.records.npc_mira.present = false;
    const away = JSON.stringify(h.def.context.tail(h.view()));
    assert.equal(away.includes(SECRET) || away.includes(SECRET_TWO), false);
    h.delta.records.npc_mira.present = true;
    // Falling back under the threshold keeps it unlocked on this line of history.
    h.reply('Doubt.', '~ npc Mira | trust: -15');
    assert.deepEqual(h.npc('Mira').unlocked, [id]);
    // A negative rule opens at or below its threshold.
    for (let i = 0; i < 2; i += 1) h.reply('Calm.', '~ npc Mira | tension: -15');
    assert.deepEqual(h.npc('Mira').unlocked, [id, secretId('tension', -20, SECRET_TWO)]);
});

test('secrets: a swipe of the unlocking reply locks it again, and nothing leaks', async () => {
    const h = await host();
    h.reply('Nice.', '~ npc Mira | trust: +15');
    const { index } = h.reply('Trusted.', '~ npc Mira | trust: +10');
    assert.equal(h.npc('Mira').unlocked.length, 1);
    h.swipe(index, '~ npc Mira | trust: +1');
    assert.deepEqual(h.npc('Mira').unlocked, []);
    const again = h.def.context.tail(h.view());
    assert.equal(plain(again.lines).some(line => line.includes(SECRET)), false, 'locked again: no longer told as known');
    assert.ok(again.optional.some(line => line.endsWith(`Mira (hidden): ${SECRET}`)), 'only as hidden');
    h.swipeTo(index, 0);
    assert.equal(h.npc('Mira').unlocked.length, 1, 'back on the first swipe, its unlock is back');
});

test('secrets: editor lines read back with stable ids; notes added later open on refresh', async () => {
    const lines = 'trust 40: The duke\'s daughter.\ntension >= -20: Hates the river.\nnot a note\ntrust 40: The duke\'s daughter.';
    const { secrets, problems } = secretsFromLines(lines);
    assert.deepEqual(secrets.map(({ meter, at }) => [meter, at]), [['trust', 40], ['tension', -20]]);
    assert.deepEqual(problems, ['not a note']);
    assert.deepEqual(secretsFromLines(secretsToLines(secrets), secrets).secrets, secrets, 'the round trip keeps ids');
    const h = await host();
    h.reply('Warm.', '~ npc Oren | trust: +15');
    h.delta.records.npc_oren.secrets = [{ meter: 'trust', at: 5, text: 'Owes the guild.' }];
    assert.equal((await h.adapter.refresh('Oren')).ok, true);
    assert.equal(h.npc('Oren').unlocked.length, 1);
    assert.equal((await h.adapter.refresh('Oren')).ok, false, 'nothing more to open');
});

test('secrets: a note may open on a story event (when, up to 120 characters), by a meter, or by whichever comes first', () => {
    const pack = normalizeSecrets([
        { title: 'A', text: 'Meter only.', meter: 'trust', at: 40 },
        { title: 'B', text: 'Event only.', when: ` ${EVENT} ` },
        { title: 'C', text: 'Both.', meter: 'affection', at: 30, when: 'She is told the truth' },
        { text: 'No rule at all.' },
        { text: 'Half a meter rule.', meter: 'trust' },
        { when: 'No text.' },
    ]);
    assert.deepEqual(pack.map(note => [note.title ?? null, note.meter ?? null, note.at ?? null, note.when ?? null]), [
        ['A', 'trust', 40, null], ['B', null, null, EVENT], ['C', 'affection', 30, 'She is told the truth'],
    ]);
    assert.equal(pack[0].id, secretId('trust', 40, 'Meter only.'), 'a meter note keeps the id it always had');
    assert.equal(normalizeSecrets([{ text: 'x', when: 'e'.repeat(300) }])[0].when.length, 120);
    // The pack's and the reader's limit stays 8.
    const many = Array.from({ length: 12 }, (_, i) => ({ text: `Note ${i}`, when: `Event ${i}` }));
    assert.equal(normalizeSecrets(many).length, MAX_SECRETS);
    assert.equal(MAX_SECRETS, 8);
});

test('secrets: editor lines carry event notes and "meter or when" notes, and round-trip with their ids', () => {
    const lines = ['trust 40: [Her past] The duke\'s daughter.', `when ${EVENT} => [The duke] ${EVENT_SECRET}`, 'affection 30 or when she is told => Both ways.', 'when => no event', 'when only words'].join('\n');
    const { secrets, problems } = secretsFromLines(lines);
    assert.deepEqual(secrets.map(note => [note.meter ?? null, note.at ?? null, note.when ?? null, note.title ?? null]), [
        ['trust', 40, null, 'Her past'], [null, null, EVENT, 'The duke'], ['affection', 30, 'she is told', null],
    ]);
    assert.deepEqual(problems, ['when => no event', 'when only words']);
    const written = secretsToLines(secrets);
    assert.match(written, new RegExp(`^when ${EVENT} => \\[The duke\\] `, 'm'));
    assert.match(written, /^affection 30 or when she is told => Both ways\.$/m);
    assert.deepEqual(secretsFromLines(written, secrets).secrets, secrets, 'ids and rules survive the round trip');
});

test('secrets: a scan writes up to 5 layers (light to deep); the pack and the reader keep 8; bad layers are dropped', () => {
    const layer = (i, extra = {}) => ({ title: `Layer ${i}`, text: `Secret ${i}.`, meter: 'trust', at: 10 * (i + 1), ...extra });
    const made = normalizeGeneratedSecrets([0, 1, 2, 3, 4, 5, 6].map(i => layer(i)));
    assert.equal(MAX_GENERATED_SECRETS, 5);
    assert.deepEqual(made.map(note => note.at), [10, 20, 30, 40, 50], 'five at most, in the order written (light to deep)');
    const mixed = normalizeGeneratedSecrets([
        layer(0, { id: 'sec_hacked01' }), layer(1, { meter: 'luck' }), layer(2, { at: 0 }), layer(3, { at: 500 }),
        layer(4, { meter: 'mood', at: 3, when: 'She is betrayed' }), { title: 'x', text: 'No rule.' }, 'junk', null,
    ]);
    assert.deepEqual(mixed.map(note => [note.meter ?? null, note.when ?? null]), [['trust', null], [null, 'She is betrayed']], 'only a built-in meter within range, else an event; the rest is dropped');
    assert.notEqual(mixed[0].id, 'sec_hacked01', 'the model never chooses an id');
    assert.deepEqual(normalizeGeneratedSecrets('nope'), []);
    assert.equal(normalizeSecrets(Array.from({ length: 12 }, (_, i) => layer(i))).length, 8);
});

test('secrets: a story event opens an event note; recorded on the reply, a swipe takes it back, replay and Re-read keep it', async () => {
    const h = await host();
    h.delta.records.npc_mira.secrets = [...h.delta.records.npc_mira.secrets, eventNote()];
    h.reply('Nice.', '~ npc Mira | trust: +5');
    const noteId = normalizeSecrets(h.delta.records.npc_mira.secrets).find(note => note.when).id;
    const watch = h.adapter.eventWatch(Object.values(h.delta.records));
    assert.deepEqual(watch.map(({ key, name, note, event }) => ({ key, name, note, event })), [{ key: 's1', name: 'Mira', note: noteId, event: EVENT }]);
    // Locked, an event note is sent as hidden while she is here; nothing is "known".
    assert.ok(h.def.context.tail(h.view()).optional.some(line => line.endsWith(HIDDEN(EVENT_SECRET))));

    const { index } = h.reply('The duke is dragged out in chains.', '');
    const out = await h.adapter.openByEvent({ name: 'Mira', ids: [noteId] });
    assert.equal(out.ok, true);
    assert.match(out.receipt.summary, /Mira: a hidden note opened \(the story\)/);
    assert.equal(out.receipt.narrate, false, 'the narrator is not told "a note opened"');
    assert.deepEqual(h.npc('Mira').unlocked, [noteId]);
    assert.deepEqual(h.sent.at(-1).payload, { name: 'Mira', open: [noteId], by: 'story' });
    assert.deepEqual(h.adapter.eventWatch(Object.values(h.delta.records)), [], 'opened: no longer watched');
    assert.ok(plain(h.def.context.tail(h.view()).lines).includes(KNOWN(EVENT_SECRET)));
    assert.equal(h.def.context.tail(h.view()).optional.some(line => line.endsWith(HIDDEN(EVENT_SECRET))), false);

    // Replay equals live; a Re-read of the reply's story lines keeps it (it is Delta's, not a story line).
    const live = JSON.stringify(h.store.head());
    h.store.rebuild();
    assert.equal(JSON.stringify(h.store.head()), live, 'rebuild == live');
    h.store.replaceStory(index, { ops: [], receipts: [] });
    assert.deepEqual(h.npc('Mira').unlocked, [noteId], 'a Re-read keeps it');
    // A swipe of the reply takes it back (the reply's own record goes with it).
    h.swipe(index, '');
    assert.deepEqual(h.npc('Mira').unlocked, [], 'swipe undoes');
    assert.equal(h.adapter.eventWatch(Object.values(h.delta.records)).length, 1, 'watched again');
    h.swipeTo(index, 0);
    assert.deepEqual(h.npc('Mira').unlocked, [noteId], 'back on the first swipe, it is open again');
});

test('secrets: only Delta\'s own scan may say a story event happened; the scan cannot open a note without an event', async () => {
    const h = await host();
    h.delta.records.npc_mira.secrets = [...h.delta.records.npc_mira.secrets, eventNote()];
    h.reply('Nice.', '~ npc Mira | trust: +5');
    const notes = normalizeSecrets(h.delta.records.npc_mira.secrets);
    const eventId = notes.find(note => note.when).id;
    const meterId = notes.find(note => !note.when).id;
    const before = JSON.stringify(h.store.head());
    const forged = await h.sdk.command('npc.open', { name: 'Mira', open: [eventId], by: 'story' });
    assert.equal(forged.ok, false);
    assert.equal(forged.code, 'REFUSED', 'a button or pack cannot claim the story event happened');
    const noEvent = await h.adapter.openByEvent({ name: 'Mira', ids: [meterId] });
    assert.equal(noEvent.ok, false, 'a meter note has no event for the scan to see');
    assert.equal((await h.sdk.command('npc.open', { name: 'Mira' })).ok, false, 'it names nothing');
    assert.equal(JSON.stringify(h.store.head()), before, 'nothing saved');
    // Only present people are watched.
    h.delta.records.npc_mira.present = false;
    assert.deepEqual(h.adapter.eventWatch(Object.values(h.delta.records)), []);
});

test('secrets: the reader opens or shuts a note by hand; a shut note stays shut while its meter is past it, until opened by hand', async () => {
    const h = await host();
    h.reply('Nice.', '~ npc Mira | trust: +25');
    const id = secretId('trust', 30, SECRET);
    h.reply('Trusted.', '~ npc Mira | trust: +10');
    assert.deepEqual(h.npc('Mira').unlocked, [id]);
    assert.equal((await h.sdk.command('npc.open', { name: 'Mira', close: [id] })).ok, true);
    assert.deepEqual(h.npc('Mira').unlocked, []);
    assert.deepEqual(h.npc('Mira').held, [id]);
    h.reply('More.', '~ npc Mira | trust: +5');
    assert.deepEqual(h.npc('Mira').unlocked, [], 'the meter is past 30 and the note stays shut');
    assert.ok(h.def.context.tail(h.view()).optional.some(line => line.endsWith(HIDDEN(SECRET))), 'shut: hidden wording again');
    assert.equal((await h.sdk.command('npc.open', { name: 'Mira', open: [id, 'sec_nonexistent'] })).ok, true);
    assert.deepEqual(h.npc('Mira').unlocked, [id]);
    assert.equal(h.npc('Mira').held, undefined);
    assert.equal((await h.sdk.command('npc.open', { name: 'Mira', open: [id] })).ok, false, 'already open: nothing to do');
    // Opening the tension note by hand, though its meter is nowhere near.
    const two = secretId('tension', -20, SECRET_TWO);
    await h.sdk.command('npc.open', { name: 'Mira', open: [two] });
    assert.deepEqual(h.npc('Mira').unlocked, [id, two]);
    assert.deepEqual(h.runQuery('npc.cast').find(entry => entry.key === 'npc_mira').opened.map(note => note.text), ['Opened · Trust 30', 'Opened · by you'], 'a meter past its rule says so; a note opened by hand says "by you"');
    assert.deepEqual(validateNpcSlice(h.store.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
    const live = JSON.stringify(h.store.head());
    h.store.rebuild();
    assert.equal(JSON.stringify(h.store.head()), live, 'rebuild == live');
});

test('secrets: five layers over a small budget: the nearest to opening are sent, the deep ones wait until the person gets close', async () => {
    const layers = [10, 25, 40, 60, 80].map((at, i) => ({ title: `Layer ${i + 1}`, meter: 'trust', at, text: `Layer ${i + 1} of her past, about ${at}: ${'x'.repeat(130)}` }));
    const delta = fakeDelta();
    delta.records.npc_mira.secrets = layers;
    delta.records.npc_mira.relationship.trust = 0;
    const h = await host({ delta });
    h.reply('Nice.', '~ npc Mira | trust: +12');
    assert.deepEqual(h.npc('Mira').unlocked, [secretId('trust', 10, layers[0].text)], 'the lightest layer opened at 10');
    const tail = h.def.context.tail(h.view());
    assert.equal(noCue(tail.optional).length, 4);
    assert.deepEqual(noCue(tail.optional).map(line => /Layer (\d)/.exec(line)[1]), ['2', '3', '4', '5'], 'nearest to opening first');
    const sentFor = () => assemble({ registry: h.registry, view: h.view(), settings: { tailBudget: 1500 } });
    let sent = sentFor();
    const part = () => sent.parts.find(item => item.module === MODULE_ID && item.place === 'tail');
    // 305 tokens for the module (250 and the kept Changes cue): the opened line and the nearest layers fit, the deepest is dropped first.
    assert.ok(part().text.includes('Layer 1 of her past'), 'the opened layer is told');
    assert.ok(part().text.includes('Layer 2 of her past'), 'the nearest locked layer is told');
    assert.equal(part().text.includes('Layer 5 of her past'), false, 'the deepest waits');
    assert.ok(part().dropped >= 1, 'the host says it dropped lines');
    assert.ok(part().tokens <= 305 + 10, `within the module's budget (${part().tokens})`);
    // Three layers in, the next locked one (60) is close and is sent; the deepest (80) still waits.
    for (let i = 0; i < 3; i += 1) h.reply('Closer.', '~ npc Mira | trust: +15');
    assert.equal(h.npc('Mira').meters.trust, 57);
    assert.equal(h.npc('Mira').unlocked.length, 3);
    assert.deepEqual(noCue(h.def.context.tail(h.view()).optional).map(line => /Layer (\d)/.exec(line)[1]), ['4', '5']);
    sent = sentFor();
    assert.ok(part().text.includes('Layer 4 of her past'), 'the layer about to open is told');
    assert.equal(part().text.includes('Layer 5 of her past'), false, 'the deepest still waits');
});

test('secrets: "What\'s sent" shows a locked note as "1 hidden note" (redactSent); an opened note and the rest are as sent', async () => {
    const h = await host();
    h.reply('Nice.', '~ npc Mira | trust: +25');
    const sent = assemble({ registry: h.registry, view: h.view(), settings: { tailBudget: 1500 } });
    const text = sent.parts.find(item => item.module === MODULE_ID && item.place === 'tail').text;
    assert.ok(text.includes(SECRET) && text.includes(SECRET_TWO), 'what is really sent has the locked texts (the narrator must know them)');
    const shown = h.def.hooks.redactSent(text);
    assert.equal(shown.includes(SECRET) || shown.includes(SECRET_TWO), false);
    assert.equal(shown.split('\n').filter(line => line === 'Mira: 1 hidden note').length, 2);
    assert.match(shown, /^NPC meters now: Mira /m, 'the meter line is untouched');
    h.reply('Trusted.', '~ npc Mira | trust: +10');
    const after = h.def.hooks.redactSent(assemble({ registry: h.registry, view: h.view(), settings: { tailBudget: 1500 } }).parts.find(item => item.module === MODULE_ID && item.place === 'tail').text);
    assert.ok(after.includes(KNOWN(SECRET)), 'an opened note is shown as sent');
    assert.equal(after.includes(SECRET_TWO), false);
    assert.equal(h.def.hooks.redactSent('Nothing hidden here.'), 'Nothing hidden here.');
    assert.equal(h.def.hooks.redactSent(undefined), '');
});

test('secrets: NPCs with no notes get exactly the tail they had before (no hidden or known lines)', async () => {
    const h = await host();
    h.reply('Warm.', '~ npc Oren | trust: +15');
    h.delta.records.npc_oren.present = true;
    h.delta.records.npc_mira.present = false;
    const tail = h.def.context.tail(h.view());
    assert.deepEqual(noCue(tail.optional), []);
    assert.match(plain(tail.lines)[0], /^NPC meters now: Oren /);
    assert.equal(plain(tail.lines).length, 1);
});
