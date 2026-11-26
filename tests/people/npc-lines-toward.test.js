import test from 'node:test';
import assert from 'node:assert/strict';
import { suite, dossiers } from './helpers/pacing-suite.js';
import { selectDossier } from '../../ui/select/dossier.js';
import { readRecord } from '../../core/persist.js';
import { buildLinesRules } from '../../modules/people/core/core-prompts-lines-parts/rules.js';
import { DURABLE_PROFILE_LIMITS } from '../../modules/people/core/core-relationship.js';
import { normalizeNpcRecord } from '../../modules/people/core/core.js';

// `~ npc Name | toward:` (lines mode, a reply with the `npcToward` rule mark): who the reader is to them now, stored as relationshipSummary ("Who you are to them").
const OLD = 'A stranger: she barely meets your eye';
const NEW = 'Her partner, and the one person she lets herself lean on.';
const records = (extra = {}) => ({ ...dossiers(), npc_temiwa: { ...dossiers().npc_temiwa, relationshipSummary: OLD, fieldChangeMessages: {}, ...extra } });
const temiwa = s => s.host.head().domains.people.npcs.npc_temiwa;
const toward = s => temiwa(s).relationshipSummary;
const viewOf = s => selectDossier({ dossier: temiwa(s) }).toward;
const problems = s => JSON.stringify(s.host.head().domains.people.bonds.problems);
const snap = s => JSON.stringify(s.host.head().domains.people);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const edit = (s, at, lines) => { s.host.ctx.chat[at].mes = `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`; };
const reread = async (s, at) => assert.equal((await s.host.sdk.reread(at)).ok, true);
const line = text => `~ npc Sister Temiwa | toward: ${text}`;

test('toward writes the summary, the dossier view shows it, the change is stamped with this reply and the receipt names it', async () => {
    const s = await suite({ lines: true, records: records() });
    const at = await s.say([line(NEW)]);
    assert.equal(toward(s), NEW);
    assert.equal(viewOf(s), NEW);
    assert.equal(temiwa(s).fieldChangeMessages.relationshipSummary, at);
    await s.say([line('Her partner.')]);
    const told = s.host.store.receipts().map(item => item.receipt.summary).join('\n');
    assert.match(told, /Sister Temiwa: nothing moved; who you are to them stored/);
    assert.equal(normalizeNpcRecord(structuredClone(temiwa(s))).relationshipSummary, 'Her partner.', 'the dossier normalizer keeps the sentence as written');
    assert.doesNotMatch(told, /relationshipSummary stored/);
    same(s, 'replay equals live');
});

test('with meters on the same line both apply; a long sentence is clipped to the dossier limit, never refused', async () => {
    const s = await suite({ lines: true, records: records() });
    await s.say([`${line(NEW)} | trust: up`]);
    assert.equal(toward(s), NEW);
    assert.equal(s.npc('Sister Temiwa').meters.trust, 1);
    for (const long of [`The friend ${'she trusts '.repeat(60)}`, `The friend ${'🌊'.repeat(400)}`]) {
        await s.say([line(long)]);
        assert.ok([...toward(s)].length <= DURABLE_PROFILE_LIMITS.relationshipSummary);
        assert.ok([...toward(s)].length > 300, 'the longer limit than other line fields');
        assert.ok(toward(s).startsWith('The friend '));
    }
    same(s, 'replay equals live');
});

test('a summary the reader edited by hand, or of a person who died, is not changed; the line\'s other labels still apply', async () => {
    const locked = await suite({ lines: true, records: records({ manualProfileFields: ['relationshipSummary'] }) });
    await locked.say([`${line(NEW)} | trust: up`]);
    assert.equal(toward(locked), OLD);
    assert.match(problems(locked), /toward is locked by you/);
    assert.equal(locked.npc('Sister Temiwa').meters.trust, 1);
    const dead = await suite({ lines: true, records: records({ lifeState: 'deceased' }) });
    await dead.say([line(NEW)]);
    assert.equal(toward(dead), OLD);
    assert.match(problems(dead), /has died; toward is not changed/);
});

test('a toward that says nothing is not used', async () => {
    const s = await suite({ lines: true, records: records() });
    for (const bad of ['', 'unknown', 'keep', 'clear']) {
        await s.say([line(bad)]);
        assert.equal(toward(s), OLD, `"${bad}"`);
        assert.match(problems(s), /says nothing/);
    }
});

test('lines mode off: toward is an unknown label as before', async () => {
    const s = await suite({ lines: false, records: records() });
    await s.say([`${line(NEW)} | trust: up`]);
    assert.equal(toward(s), OLD);
    assert.match(problems(s), /\\"toward\\" is not a meter/);
});

test('a Re-read of a reply without the npcToward mark never writes it; with the mark it equals live', async () => {
    const s = await suite({ lines: true, records: records() });
    const at = await s.say([`${line(NEW)} | trust: up`]);
    const live = snap(s);
    await reread(s, at);
    assert.equal(snap(s), live, 'with the mark, a Re-read equals live');
    // The record as an older version left it: no `npcToward` mark.
    const record = readRecord(s.host.ctx.chat[at]);
    assert.ok(record.rules.includes('npcToward'));
    record.rules.splice(record.rules.indexOf('npcToward'), 1);
    await reread(s, at);
    assert.equal(readRecord(s.host.ctx.chat[at]).rules.includes('npcToward'), false);
    assert.equal(toward(s), OLD);
    assert.match(problems(s), /\\"toward\\" is not a meter/);
    assert.equal(temiwa(s).fieldChangeMessages.relationshipSummary, undefined);
    assert.equal(s.npc('Sister Temiwa').meters.trust, 1, 'the line\'s meters still apply');
    same(s, 'unmarked Re-read replay equals live');
});

test('swipe, swipe back, an edited Re-read, a middle delete, a reload and a rewind equal live', async () => {
    const s = await suite({ lines: true, records: records() });
    const first = await s.say([line('A friend she is learning to trust.')]);
    const withFriend = snap(s);
    await s.swipe([line(NEW)]);
    assert.equal(toward(s), NEW);
    same(s, 'swipe replay equals live');
    await s.host.st.swipeTo(first, 0);
    assert.equal(snap(s), withFriend, 'swiping back restores the first answer exactly');
    same(s, 'swipe back replay equals live');
    const second = await s.say(['~ npc Oren | trust: up']);
    edit(s, second, [line(NEW)]);
    await reread(s, second);
    assert.equal(toward(s), NEW, 'a Re-read of a marked reply writes an added line');
    same(s, 'edited Re-read replay equals live');
    await s.say([line('The woman she means to marry.')]);
    await s.host.st.deleteMessage(second);
    await s.host.st.deleteMessage(second - 1);
    assert.equal(toward(s), 'The woman she means to marry.', 'a middle delete keeps a later reply\'s sentence');
    same(s, 'middle delete replay equals live');
    await s.host.turn.onChatChanged();
    same(s, 'chat change / reload equals live');
    const head = s.host.store.headIndex();
    await s.host.st.deleteMessage(head);
    await s.host.st.deleteMessage(head - 1);
    assert.equal(toward(s), 'A friend she is learning to trust.');
    same(s, 'rewind replay equals live');
});

test('the owner-approved rule is sent with the ~ npc rules, with the reader\'s name left to the host\'s {{user}} macro', () => {
    const sentence = 'How they see {{user}}: when this reply changes what a person thinks of {{user}} (a milestone, a betrayal, growing close, a falling-out), write ~ npc Name | toward: who {{user}} is to them now, one sentence in their eyes (e.g. ~ npc Mira | toward: The one person she trusts to watch her back). Not for small shifts.';
    for (const options of [{}, { moodWord: true, levelOn: true }]) assert.ok(buildLinesRules(options).split('\n').includes(sentence));
});
