import test from 'node:test';
import assert from 'node:assert/strict';
import { suite, dossiers } from './helpers/pacing-suite.js';
import { normalizeSecrets } from '../../modules/people/meters/npc-meters.js';

// N5 secrets (NSD12): `~ reveal Name | opened: <note id> | quote: "..."` opens a hidden note whose story event the reply showed; the #361 quote check is the scan's own.
const EVENT = 'the duke is exposed as a traitor';
const records = () => {
    const all = dossiers();
    all.npc_oren.secrets = [{ title: 'The duke', text: 'He served the duke.', when: EVENT }, { title: 'Light', text: 'He likes tea.', meter: 'trust', at: 40 }];
    return all;
};
const [DUKE, LIGHT] = normalizeSecrets(records().npc_oren.secrets).map(note => note.id);
const STORY = 'Sister Temiwa tore the cloth away and the whole hall saw the duke exposed as a traitor before them all.';
const QUOTE = 'the whole hall saw the duke exposed as a traitor';
const line = (id = DUKE, quote = QUOTE) => `~ reveal Oren | opened: ${id} | quote: "${quote}"`;
const opened = s => s.host.head().domains.people.bonds.npcs.npc_oren?.unlocked ?? [];
const snap = s => JSON.stringify(s.host.head().domains.people);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };
const reply = (story, lines) => `${story}${lines.length ? `\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : ''}`;
const say = async (s, story, lines) => { await quiet(async () => { await s.host.send('And then?', reply(story, lines)); await s.adapter.ticked(); }); return s.host.store.headIndex(); };
const reread = async (s, at) => assert.equal((await quiet(() => s.host.sdk.reread(at))).ok, true);

test('a quote found in the reply opens the note, once; the line is the note\'s only way in', async () => {
    const s = await suite({ lines: true, records: records() });
    await say(s, STORY, [line()]);
    assert.deepEqual(opened(s), [DUKE]);
    same(s, 'replay equals live');
    await say(s, STORY, [line()]);
    assert.deepEqual(opened(s), [DUKE], 'a second line for an open note changes nothing');
});

test('no quote, a short quote, a quote not in the reply, or one only in the line itself: the note stays closed', async () => {
    const s = await suite({ lines: true, records: records() });
    await say(s, STORY, [`~ reveal Oren | opened: ${DUKE}`, line(DUKE, 'the duke'), line(DUKE, 'the duke fled the city by night')]);
    assert.deepEqual(opened(s), []);
    await say(s, 'The hall was quiet.', [line(DUKE, 'the duke is exposed as a traitor and fled')]);
    assert.deepEqual(opened(s), [], 'the quote written only in the line finds nothing: the <Changes> block is not the story');
});

test('a note that is not theirs, has no event, or is unknown is refused; a person with no record is refused', async () => {
    const s = await suite({ lines: true, records: records() });
    await say(s, STORY, [line(LIGHT), line('sec_00000000'), line(''), `~ reveal Nobody | opened: ${DUKE} | quote: "${QUOTE}"`, `~ reveal Sister Temiwa | opened: ${DUKE} | quote: "${QUOTE}"`]);
    assert.deepEqual(opened(s), []);
});

test('a swipe closes it and swiping back opens it again; an edited Re-read (grown, shrunk), a middle delete, a reload and a rewind equal live', async () => {
    const s = await suite({ lines: true, records: records() });
    const at = await say(s, STORY, [line()]);
    const first = snap(s);
    await quiet(async () => { await s.host.swipe(reply('Nothing happened.', [])); await s.adapter.ticked(); });
    assert.deepEqual(opened(s), []);
    same(s, 'swipe replay equals live');
    await s.host.st.swipeTo(at, 0);
    assert.equal(snap(s), first);
    await reread(s, at);
    await reread(s, at);
    assert.deepEqual(opened(s), [DUKE], 'a Re-read opens it once');
    s.host.ctx.chat[at].mes = reply('Nothing happened.', [line()]);
    await reread(s, at);
    assert.deepEqual(opened(s), [], 'an edit that takes the quote out of the story closes it');
    same(s, 'shrunk Re-read replay equals live');
    s.host.ctx.chat[at].mes = reply(STORY, [line(), '~ npc Oren | trust: +1']);
    await reread(s, at);
    assert.deepEqual(opened(s), [DUKE]);
    same(s, 'grown Re-read replay equals live');
    await s.say(['~ npc Oren | trust: +1']);
    await s.host.turn.onChatChanged();
    same(s, 'reload equals live');
    await quiet(async () => { const head = s.host.store.headIndex(); await s.host.st.deleteMessage(head); await s.host.st.deleteMessage(head - 1); });
    same(s, 'rewind equals live');
    await quiet(async () => { await s.host.st.deleteMessage(at); await s.host.st.deleteMessage(at - 1); });
    assert.deepEqual(opened(s), [], 'a middle delete takes the open with its reply');
    same(s, 'middle delete replay equals live');
});

test('switch off: a ~ reveal line opens nothing', async () => {
    const s = await suite({ lines: false, records: records() });
    await say(s, STORY, [line()]);
    assert.deepEqual(opened(s), []);
});

test('Continue: the quote may come in the continuation; the same line again in a later continuation opens nothing twice; rebuild equals live', async () => {
    const s = await suite({ lines: true, records: records() });
    const at = await say(s, 'The hall was quiet.', []);
    await quiet(async () => { await s.host.cont(`\n${STORY}\n\n<Changes>\n${line()}\n</Changes>`); await s.adapter.ticked(); });
    assert.deepEqual(opened(s), [DUKE], 'the line and its quote both came with the continuation');
    same(s, 'continue replay equals live');
    await quiet(async () => { await s.host.cont('\nThe doors closed.'); await s.adapter.ticked(); });
    assert.deepEqual(opened(s), [DUKE], 'a later continuation does not open it again');
    assert.equal(s.host.store.headIndex(), at);
    same(s, 'second continue replay equals live');
});

test('Continue: a line whose quote is not in the text so far is refused, and stays refused when the continuation only adds other words', async () => {
    const s = await suite({ lines: true, records: records() });
    await say(s, 'The hall was quiet.', [line()]);
    assert.deepEqual(opened(s), []);
    await quiet(async () => { await s.host.cont('\nShe turned away.'); await s.adapter.ticked(); });
    assert.deepEqual(opened(s), []);
    same(s, 'replay equals live');
});
