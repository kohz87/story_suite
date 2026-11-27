import test from 'node:test';
import assert from 'node:assert/strict';
import { suite, dossiers } from './helpers/pacing-suite.js';
import { normalizeSecrets } from '../../modules/people/meters/npc-meters.js';
import { learnedAnchors } from '../../modules/world/chronicle/world-daily/learned.js';
import { redactSentOf, sentText } from '../../core/sent/sent.js';

// A secret the story earns (rule mark `revealNext`): a person's next pack secret not yet told comes out by a `~ reveal` line with a quote though
// its gate is closed; a deeper one does not, and a reply with no mark is judged as before. Swipes, Re-reads, rebuilds and reloads equal live.
const FEATURES = { 'story-director.world-events': true };
// A stand-in for Story Director: the world switch is its feature.
const stub = {
    id: 'story-director', name: 'Story Director stand-in',
    features: [{ id: 'story-director.world-events', label: 'World events', describe: 'The world switch (a stand-in).', default: false }],
};
const FIRST = 'He forged the last rite himself.';
const DEEP = 'The prior paid him for it.';
const STORY = 'Oren looked at the floor and said he forged the last rite himself, and that the prior paid him for it.';
const QUOTE = 'he forged the last rite himself';
const DEEP_QUOTE = 'the prior paid him for it';
const records = (gate = 'meter trust >= 90') => {
    const all = dossiers();
    all.npc_oren.secrets = [{ packId: 'rite', gate, text: FIRST, from: 'pack' }, { packId: 'paid', gate: 'meter trust >= 95', text: DEEP, from: 'pack' }];
    return all;
};
const [ID, DEEP_ID] = normalizeSecrets(records().npc_oren.secrets).map(note => note.id);
const reply = lines => `${STORY}${lines.length ? `\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : ''}`;
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };
const say = async (s, lines) => { await quiet(async () => { await s.host.send('And then?', reply(lines)); await s.adapter.ticked(); }); return s.host.store.headIndex(); };
const reveal = (id, quote = QUOTE) => `~ reveal Oren | opened: ${id} | quote: "${quote}"`;
const opened = s => s.host.head().domains.people.bonds.npcs.npc_oren?.unlocked ?? [];
const snap = s => JSON.stringify(s.host.head().domains.people);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const refusals = s => s.host.turn.problems().map(item => item.message);
const open = gate => suite({ lines: true, records: records(gate), features: FEATURES, modules: [stub] });
const tailText = s => s.host.turn.previewFit().parts.map(part => part.text).join('\n');
const tailIds = s => [...tailText(s).matchAll(/^Oren \(not yet told, ([^)]+)\): /gm)].map(match => match[1]);
const started = async gate => { const s = await open(gate); await say(s, ['~ npc Oren | trust: +1']); return s; };

test('the id the tail prints opens it under the mark; the world learns it; then the next one is told of', async () => {
    const s = await started();
    assert.deepEqual(tailIds(s), ['rite'], 'the real prompt has the line, with the pack\'s id');
    const copy = sentText(s.host.turn.previewFit().parts, [], { redact: redactSentOf(s.host.registry) }).copy;
    assert.ok(copy.includes('Oren: 1 hidden note') && !copy.includes(FIRST), 'What\'s sent and its copy hide it');
    const at = await say(s, [reveal(tailIds(s)[0])]);
    assert.ok(s.host.ctx.chat[at].extra.storySuite.rules.includes('revealNext'));
    assert.deepEqual(opened(s), [ID], 'kept by its sec_ id');
    const cast = [{ kind: 'companion', id: 'oren', name: 'Oren', secrets: [{ id: 'rite', gate: 'meter trust >= 90', text: FIRST, writes_fact: 'forgery' }] }];
    const people = structuredClone(s.host.head().domains.people);
    people.npcs.npc_oren = { ...people.npcs.npc_oren, castFrom: { id: 'oren' }, secrets: normalizeSecrets(records().npc_oren.secrets) };
    assert.deepEqual(learnedAnchors(people, cast), ['learned:oren/rite', 'fact:forgery']);
    assert.deepEqual(tailIds(s), ['paid']);
    await say(s, [reveal('rite')]);
    assert.deepEqual(opened(s), [ID]);
    assert.ok(refusals(s).some(text => text.includes('that note is already open') || text.includes('not ready to come out yet')), 'an open one is refused');
    await say(s, [reveal(DEEP_ID, DEEP_QUOTE)]);
    assert.deepEqual(opened(s), [ID, DEEP_ID], 'by the sec_ id too, now that it is next');
    same(s, 'replay equals live');
});

test('an open gate: the id its "(may come out, id)" line prints opens it; without the mark that pack id names no note', async () => {
    for (const marked of [true, false]) {
        const s = await started('meter trust >= 1');
        const ids = [...tailText(s).matchAll(/^Oren \(may come out, ([^)]+)\): /gm)].map(match => match[1]);
        assert.deepEqual(ids, ['rite']);
        if (!marked) s.host.store.setRuleMarks = () => { throw new Error('old reply'); };
        await say(s, [reveal(ids[0])]);
        assert.deepEqual(opened(s), marked ? [ID] : []);
        if (!marked) {
            assert.ok(refusals(s).some(text => text.includes('rite is not one of their hidden notes with a story event.')));
            await say(s, [reveal(ID)]);
            assert.deepEqual(opened(s), [ID], 'by its sec_ id the open gate works as before');
        }
        same(s, 'replay equals live');
    }
});

test('a deeper closed one is refused, and so is a missing quote', async () => {
    const s = await started();
    await say(s, [reveal('paid', DEEP_QUOTE)]);
    await say(s, [reveal(DEEP_ID, DEEP_QUOTE)]);
    assert.deepEqual(opened(s), []);
    assert.equal(refusals(s).filter(text => text.includes('is not ready to come out yet; the note stays closed.')).length, 2);
    await say(s, [reveal('rite', 'words that nobody in this reply ever said')]);
    assert.deepEqual(opened(s), [], 'the quote check still applies');
    same(s, 'refusals replay equal');
});

test('without the mark: today\'s behaviour (the sec_ id is refused as not ready, the pack id names no note), also on a Re-read', async () => {
    const s = await started();
    const setter = s.host.store.setRuleMarks;
    s.host.store.setRuleMarks = () => { throw new Error('old reply'); };
    const at = await say(s, [reveal(ID)]);
    assert.deepEqual(opened(s), []);
    assert.ok(refusals(s).some(text => text.includes(`${ID} is not ready to come out yet; the note stays closed.`)));
    await say(s, [reveal('rite')]);
    assert.deepEqual(opened(s), []);
    assert.ok(refusals(s).some(text => text.includes('rite is not one of their hidden notes with a story event.')));
    s.host.store.setRuleMarks = setter;
    assert.equal((await quiet(() => s.host.sdk.reread(at))).ok, true);
    assert.deepEqual(opened(s), [], 'a Re-read adds no mark');
    same(s, 'old replies replay equal');
});

test('a quote term is not skipped: the tail offers it as may come out, and the reveal still needs its words', async () => {
    const s = await started('quote:"the abbey bell"');
    assert.deepEqual(tailIds(s), ['paid']);
    await say(s, [reveal('rite')]);
    assert.deepEqual(opened(s), []);
});

test('the earned reveal: swipe, swipe back, edited Re-read, rebuild, chat change, middle delete and rewind equal live', async () => {
    const s = await started();
    const at = await say(s, [reveal('rite')]);
    assert.deepEqual(opened(s), [ID]);
    same(s, 'replay equals live');
    const first = snap(s);
    await quiet(async () => { await s.host.swipe(reply([])); await s.adapter.ticked(); });
    assert.deepEqual(opened(s), [], 'a swipe takes it back');
    same(s, 'swipe replay equals live');
    await s.host.st.swipeTo(at, 0);
    assert.equal(snap(s), first, 'swiping back restores it');
    assert.equal((await quiet(() => s.host.sdk.reread(at))).ok, true);
    assert.deepEqual(opened(s), [ID], 'an unchanged Re-read keeps it');
    same(s, 'Re-read equals live');
    s.host.ctx.chat[at].mes = reply([]);
    assert.equal((await quiet(() => s.host.sdk.reread(at))).ok, true);
    assert.deepEqual(opened(s), [], 'an edit that drops the line closes it');
    s.host.ctx.chat[at].mes = reply([reveal('rite'), '~ npc Oren | trust: +1']);
    assert.equal((await quiet(() => s.host.sdk.reread(at))).ok, true);
    assert.deepEqual(opened(s), [ID], 'a grown Re-read opens it');
    same(s, 'grown Re-read equals live');
    await s.host.turn.onChatChanged();
    same(s, 'chat change equals live');
    await say(s, []);
    await quiet(async () => { await s.host.st.deleteMessage(at); await s.host.st.deleteMessage(at - 1); });
    assert.deepEqual(opened(s), [], 'a middle delete takes the reveal with its reply');
    same(s, 'middle delete equals live');
    await say(s, [reveal('rite')]);
    await quiet(async () => { const head = s.host.store.headIndex(); await s.host.st.deleteMessage(head); await s.host.st.deleteMessage(head - 1); });
    assert.deepEqual(opened(s), [], 'a rewind past it closes it');
    same(s, 'rewind equals live');
});

test('a two-word name and a hyphenated pack id, as the prompt prints them', async () => {
    const all = dossiers();
    all.npc_temiwa.secrets = [{ packId: 'why-bluewatch', gate: 'meter trust >= 20', text: FIRST, from: 'pack' }];
    const s = await suite({ lines: true, records: all, features: FEATURES, modules: [stub] });
    await say(s, ['~ npc Sister Temiwa | trust: +1']);
    const [, id] = /^Sister Temiwa \(not yet told, ([^)]+)\): /m.exec(tailText(s));
    assert.equal(id, 'why-bluewatch');
    await say(s, [`~ reveal Sister Temiwa | opened: ${id} | quote: "${QUOTE}"`]);
    assert.deepEqual(s.host.head().domains.people.bonds.npcs.npc_temiwa.unlocked, [normalizeSecrets(all.npc_temiwa.secrets)[0].id]);
    same(s, 'replay equals live');
});

test('an earned reveal still needs a quote: term of its gate said in this exchange (an "and" gate whose other term is unmet)', async () => {
    const s = await started('meter trust >= 90 and quote:the abbey bell');
    assert.deepEqual(tailIds(s), ['rite'], 'still the next secret in the tail');
    await say(s, [reveal('rite')]);
    assert.deepEqual(opened(s), [], 'the abbey bell was never said: refused');
    assert.ok(refusals(s).some(text => /not ready to come out yet/.test(text)));
});
