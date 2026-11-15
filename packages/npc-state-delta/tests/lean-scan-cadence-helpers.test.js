import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { autoScanDue, replyMayChangeDossiers } from '../scan-context.js';
import { buildInjection, buildRelationshipPassPrompt, buildScannerPrompt } from '../core.js';
import { skippedExchangesWindow, useTranscriptSource } from '../src/transcript.js';
import { currentExchangeRelationshipRelevant } from '../src/relationship-pass.js';

test('lean: autoScanDue lets a reply that names someone scan at once; a quiet reply waits for the safety scan', () => {
    const due = (sinceScan, extra = {}) => autoScanDue({ autoScan: true, full: false, scanEvery: 5, sinceScan, ...extra });
    assert.equal(due(1), false, 'quiet, 1 of 5');
    assert.equal(due(4), false, 'quiet, 4 of 5');
    assert.equal(due(5), true, 'the safety scan');
    assert.equal(due(1, { replyChanges: true }), true, 'a name in the reply');
    assert.equal(due(1, { replyChanges: true, autoScan: false }), false, 'Auto scan off stays off');
    assert.equal(due(1, { everyReply: false, replyChanges: true }), false, 'Story Suite "every reply" off: the cadence alone, never earlier than 1.7.4');
    assert.equal(due(1, { everyReply: false }), false, 'Story Suite "every reply" off: a quiet reply keeps its own cadence');
    assert.equal(due(5, { everyReply: false }), true, 'Story Suite "every reply" off: the safety scan');
});

test('lean: the local check finds a new name, a tracked NPC or an NPC State line, and nothing in quiet prose', () => {
    const roster = [{ id: 'a', name: 'Yunyun Aldis', aliases: ['Yun'], role: 'adventurer' }];
    const check = (text, people = roster, ignore = ['Ari', 'Narrator']) => replyMayChangeDossiers({ texts: [text], roster: people, ignore,  });
    assert.equal(check('They walk down the road in silence. The wind is cold.'), false);
    assert.equal(check('Ari looks at the Narrator and sighs. "Well," he says.'), false, 'the player and the character are not new names');
    assert.equal(check('Rain falls on the road. The rain keeps falling.'), false, 'a capitalised common word that also shows in lower case');
    assert.equal(check('Then Mara Voss steps in.'), true, 'a new full name');
    assert.equal(check('He meets old Brannock at the gate.'), true, 'a new name mid-sentence');
    assert.equal(check('Kael nods and leaves.'), true, 'a new name opening a sentence');
    assert.equal(check('Yun waves.'), true, 'a tracked NPC by alias');
    assert.equal(check('NPC State: Mira is wary.'), true, 'an NPC State line');
    assert.equal(check('She sighs and looks away.', [{ id: 'm', name: 'Mira Vale', aliases: [], present: true }]), false, 'a present tracked NPC by pronoun only: the next scan reads it');
    assert.equal(check('Mira sighs and looks away.', [{ id: 'm', name: 'Mira Vale', aliases: [], present: true }]), true, 'a tracked NPC named');
    assert.equal(check('A boy runs up. "I am Bo," he says.'), true, 'a two-letter name');
    assert.equal(check('Will smiled. He will not be moved.'), true, 'a name that is also a common word, before a person verb');
    assert.equal(check('美咲という若い女性が微笑んで、こちらへ歩いてきた。'), true, 'a CJK name');
    assert.equal(check('ミラが扉を開けた。'), true, 'a katakana name');
    assert.equal(check('雨が降り続いている。'), false, 'quiet CJK prose');
    assert.equal(check('في الطريق مطر', ), true, 'text in a script without capitals is looked at');
    assert.equal(check('美咲がこちらを見た。', [{ id: 'c', name: '美咲', aliases: [], present: false }]), true, 'a tracked CJK name');
    assert.equal(check(''), false);
});

test('lean: the dossier text is short: preamble and rubric about 750 characters, and every field label the narrator reads is kept', () => {
    const one = buildInjection([{
        id: 'n1', name: 'Vrena', present: true, role: 'Guild clerk', species: 'Human', gender: 'female', age: '30', appearance: 'Slender, dark braid.',
        personality: 'Practical.', speech: 'Clipped.', mannerisms: ['Taps the desk'], mood: 'wary', status: 'on duty', goal: 'Finish the ledger',
        relationshipSummary: 'Cautiously warming.', relationship: { trust: 30, affection: 15, desire: 0, tension: 12 }, behaviorProfile: ['Disposition: guarded - slow to trust'],
        memories: ['Saw the rescue'], keyRelationships: ['Sister of Tolk'], background: 'Port city.', location: 'Guild hall',
    }], 'Vrena', 1, 3);
    const [preamble, ...rest] = one.split('\n- Vrena:');
    const rubric = one.slice(one.indexOf('RELATIONSHIP-TO-BEHAVIOR RUBRIC:'));
    assert.ok(preamble.length + rubric.length <= 850, `preamble + rubric ${preamble.length + rubric.length}`);
    for (const rule of [/never mention it or any numeric value/, /do not flatten distinct voices/, /durable identity changes gradually unless a time skip/]) assert.match(one, rule);
    assert.equal(rest.length, 1);
    assert.match(one, /^NPC STATE DELTA DOSSIER\. Only confirmed-present NPCs/);
    assert.match(one, /high scores never mean obedience, clinginess, jealousy, tsundere behavior/);
    for (const label of ['IDENTITY: personality:', 'behavioral profile:', 'speech:', 'mannerisms:', 'AGENCY/BONDS: role:', 'goal:', 'bonds:', 'STATE: mood:', 'status:', 'TOWARD PLAYER (secondary):', 'APPEARANCE (authoritative; species cannot override the form):', 'memories:', 'species:', 'gender:', 'age:', 'location:', 'background:']) {
        assert.ok(one.includes(label), `keeps ${label}`);
    }
});

test('lean: a low-standing NPC adds the "only them" rule to the dossier header', () => {
    const low = buildInjection([{ id: 'n1', name: 'Vrena', present: true, role: 'Guild clerk', personality: 'Practical.', relationship: { trust: -40, affection: -30, desire: 0, tension: 60 } }], 'Vrena', 1, 3);
    assert.match(low, /LOW SCORES: the player is not special to them; no obligation, fixation or "only them" thinking\./);
});

test('lean: the window covers every skipped reply (5 replies at Scan context 6 keep the first) and reports the true count', () => {
    const chat = [{ is_user: false, name: 'Nar', mes: 'Opening.' }];
    for (let k = 1; k <= 5; k += 1) { chat.push({ is_user: true, name: 'User', mes: `U${k}` }); chat.push({ is_user: false, name: 'Nar', mes: `R${k}` }); }
    useTranscriptSource({ context: () => ({ chat, name1: 'User', name2: 'Nar' }), scanDepth: () => 6 });
    const w = skippedExchangesWindow(10, { afterId: 0, replies: 5, limit: 6 });
    assert.ok(w.transcript.includes('R1') && w.transcript.includes('U1') && w.transcript.includes('R5'));
    assert.equal(w.replies, 5);
    assert.equal(w.latest, true);
    assert.equal(w.readThrough, 10);
});

// The walk of index.js's automatic scan: cadence, window, marker and the catch-up flag, over a chat of quiet replies.
function walk({ replies, everyReply, scanEvery = 5, scanDepth = 6, fail = () => false, initMarker = 0, fresh = false }) {
    const chat = [{ is_user: false, name: 'Nar', mes: 'R0 opening.' }];
    useTranscriptSource({ context: () => ({ chat, name1: 'User', name2: 'Nar' }), scanDepth: () => scanDepth });
    const roster = [{ name: 'Mira Vale', aliases: [], present: true }];
    let marker = initMarker; let since = 0; let behind = false;
    const reads = {}; const earlierOnly = [];
    for (let k = 1; k <= replies; k += 1) {
        chat.push({ is_user: true, name: 'User', mes: `U${k}` });
        chat.push({ is_user: false, name: 'Nar', mes: `R${k} she sighs.` });
        const id = chat.length - 1;
        since += 1;
        const changes = replyMayChangeDossiers({ texts: [chat[id - 1].mes, chat[id].mes], roster, ignore: ['User', 'Nar'] });
        if (!autoScanDue({ autoScan: true, full: false, sinceScan: since, scanEvery, everyReply, replyChanges: changes, catchUp: behind })) continue;
        if (fail(k)) continue;
        const w = skippedExchangesWindow(id, { afterId: marker, replies: since, limit: scanDepth, fresh: fresh && marker === null });
        const read = w ? [...w.transcript.matchAll(/Nar: R(\d+)/g)].map(m => +m[1]) : [k];
        for (const r of read) reads[r] = (reads[r] || 0) + 1;
        if (w && !w.latest) earlierOnly.push(read);
        marker = w ? w.readThrough : id;
        behind = Boolean(w && !w.latest);
        since = 0;
    }
    return { reads, earlierOnly, marker, behind, last: chat.length - 1 };
}
// Every reply up to the marker was read exactly once; none past it was read; what waits is shorter than the cadence.
const everyOnce = (result, scanEvery) => {
    const through = result.marker / 2;
    for (let r = 1; r <= through; r += 1) assert.equal(result.reads[r], 1, `reply ${r} read ${result.reads[r] || 0} times`);
    for (const r of Object.keys(result.reads)) assert.ok(Number(r) <= through, `reply ${r} read past the marker`);
    assert.ok((result.last - result.marker) / 2 < Math.max(scanEvery, 3) || result.behind, 'only a tail shorter than the cadence waits');
};

test('lean: after failing scans the chat catches up, oldest first, every reply read exactly once (Lean and default)', () => {
    for (const everyReply of [false, true]) {
        const result = walk({ replies: 40, everyReply, fail: k => k >= 3 && k <= 15 });
        everyOnce(result, 5);
        assert.ok(result.marker / 2 >= 36, 'the scans reached the end of the chat');
        assert.ok(result.earlierOnly.length >= 1, 'a catch-up window was used');
        for (const read of result.earlierOnly) assert.ok(read.length <= 15, 'a window holds at most 15 replies');
        assert.equal(result.earlierOnly[0][0], 1, 'the oldest waiting reply is read first');
    }
});

test('lean: Scan every 20 over 60 replies reads every reply once (catch-up, oldest first)', () => {
    for (const everyReply of [false, true]) {
        const result = walk({ replies: 60, everyReply, scanEvery: 20 });
        everyOnce(result, 20);
        assert.ok(result.marker / 2 >= 40);
        assert.equal(result.earlierOnly.length, 2, 'two catch-up windows of 15 replies, each followed by a scan of the rest');
    }
});

test('lean: a catch-up window labels everything EARLIER and has no CURRENT; the scan is due at once while behind', () => {
    const prompt = buildScannerPrompt({ transcript: 'User: u1\nNar: r1\nUser: u2\nNar: r2', currentTranscript: 'User: u2\nNar: r2', earlierOnly: true, existingNpcs: [], candidates: [] });
    assert.match(prompt, /EARLIER exchanges[^]*durable facts and relationship changes[^]*never current presence, mood or location[^]*User: u1[^]*User: u2/);
    assert.doesNotMatch(prompt, /CURRENT exchange \(authoritative/);
    assert.equal(autoScanDue({ autoScan: true, full: false, sinceScan: 1, scanEvery: 20, everyReply: false, catchUp: true }), true);
    assert.equal(autoScanDue({ autoScan: false, full: false, sinceScan: 1, scanEvery: 20, everyReply: false, catchUp: true }), false, 'Auto scan off stays off');
});

test('lean: Lean mode (Scan after every reply off) scans no more often than every 3 replies, as in 1.7.4', () => {
    const due = (sinceScan, extra = {}) => autoScanDue({ autoScan: true, full: false, scanEvery: 1, sinceScan, everyReply: false, ...extra });
    assert.deepEqual([1, 2, 3].map(n => due(n, { replyChanges: true })), [false, false, true]);
    assert.deepEqual([1, 2, 3].map(n => due(n)), [false, false, true]);
});

test('lean: a scan of several exchanges labels the earlier ones and the latest CURRENT', () => {
    const prompt = buildScannerPrompt({ transcript: 'User: u1\nNar: r1\nUser: u2\nNar: r2', currentTranscript: 'User: u2\nNar: r2', existingNpcs: [], candidates: [] });
    assert.match(prompt, /EARLIER exchanges[^]*durable facts and relationship changes[^]*User: u1\nNar: r1\n\nCURRENT exchange[^]*User: u2\nNar: r2/);
    const single = buildScannerPrompt({ transcript: 'User: u2\nNar: r2', currentTranscript: 'User: u2\nNar: r2', existingNpcs: [], candidates: [] });
    assert.doesNotMatch(single, /EARLIER exchanges \(replies/);
});

test('lean: a window scan hands the relationship pass the story alone: an Off-Screen name is no target', () => {
    const chat = [{ is_user: false, name: 'Nar', mes: 'R0' }];
    const ws = '<World_State>Present: Bram\nOff-Screen: Mira Vale (at the guild)</World_State>';
    for (let k = 1; k <= 3; k += 1) { chat.push({ is_user: true, name: 'User', mes: `U${k}` }); chat.push({ is_user: false, name: 'Nar', mes: `R${k} Bram nods. ${ws}` }); }
    useTranscriptSource({ context: () => ({ chat, name1: 'User', name2: 'Nar' }), scanDepth: () => 6 });
    const w = skippedExchangesWindow(6, { afterId: 0, replies: 3 });
    const mira = { id: 'm', name: 'Mira Vale', aliases: [] };
    assert.match(w.transcript, /Off-Screen/, 'the scanner prompt still carries the World State');
    assert.doesNotMatch(w.prose, /Off-Screen|World_State|Mira/);
    assert.match(w.prose, /Bram nods/);
    assert.equal(currentExchangeRelationshipRelevant(mira, w.prose, null, {}), false);
});

test('lean: a new chat in Lean mode reads replies 1 to 5 once at the first scan; a null marker on a chat already scanned reads the latest only', () => {
    const fresh = walk({ replies: 5, everyReply: false, initMarker: null, fresh: true });
    for (let r = 1; r <= 5; r += 1) assert.equal(fresh.reads[r], 1, `reply ${r} read ${fresh.reads[r] || 0} times`);
    const lean40 = walk({ replies: 40, everyReply: false, initMarker: null, fresh: true });
    for (let r = 1; r <= lean40.marker / 2; r += 1) assert.equal(lean40.reads[r], 1, `reply ${r} read ${lean40.reads[r] || 0} times`);
    const chat = [{ is_user: false, name: 'Nar', mes: 'R0' }];
    for (let k = 1; k <= 6; k += 1) { chat.push({ is_user: true, name: 'User', mes: `U${k}` }); chat.push({ is_user: false, name: 'Nar', mes: `R${k}` }); }
    useTranscriptSource({ context: () => ({ chat, name1: 'User', name2: 'Nar' }), scanDepth: () => 6 });
    assert.equal(skippedExchangesWindow(12, { afterId: null, replies: 6, limit: 6 }), null, 'null marker, not a new chat: the latest reply only');
    const startOfChat = skippedExchangesWindow(12, { afterId: null, replies: 6, limit: 6, fresh: true });
    assert.ok(startOfChat.transcript.includes('R0') && startOfChat.transcript.includes('R6'), 'a new chat reads from the start');
});

test('lean: the prompt takes relationship evidence from CURRENT or any EARLIER exchange shown, and CURRENT claims authority only for presence, mood and location', () => {
    const cur = 'User: U3\nNar: R3';
    const windowPrompt = buildScannerPrompt({ existingNpcs: [], candidates: [], transcript: `User: U1\nNar: R1\n${cur}`, currentTranscript: cur });
    const earlierPrompt = buildScannerPrompt({ existingNpcs: [], candidates: [], transcript: `User: U1\nNar: R1\n${cur}`, currentTranscript: cur, earlierOnly: true });
    for (const prompt of [windowPrompt, earlierPrompt]) {
        assert.match(prompt, /grounded evidence from the CURRENT exchange or, when EARLIER exchanges are shown, from the EARLIER exchange it happened in/);
        assert.doesNotMatch(prompt, /EVERY non-zero axis needs grounded CURRENT-exchange evidence/);
        assert.doesNotMatch(prompt, /authoritative for [^)]*relationship deltas/);
    }
    assert.match(windowPrompt, /CURRENT exchange \(authoritative for presence, mood and location\):\nUser: U3/);
    assert.doesNotMatch(earlierPrompt, /CURRENT exchange \(authoritative/);
    assert.match(earlierPrompt, /EARLIER exchanges[^]*relationship changes[^]*never current presence, mood or location/);
});

test('lean: the relationship evaluator prompt scores a change in the exchange it happened in for a window, and is unchanged for one exchange', () => {
    const base = { transcript: 'User: u1\nNar: r1', targets: [{ id: 'n1', name: 'Mira' }], userName: 'User' };
    const single = buildRelationshipPassPrompt(base);
    assert.match(single, /because of the supplied CURRENT exchange\./);
    assert.match(single, /short CURRENT-exchange evidence/);
    assert.match(single, /grounded relationshipEvidence from CURRENT exchange/);
    assert.match(single, /\nCurrent exchange:\nUser: u1/);
    assert.equal(buildRelationshipPassPrompt({ ...base, window: false }), single, 'no window: byte-identical');
    const multi = buildRelationshipPassPrompt({ ...base, window: true });
    assert.match(multi, /because of the supplied exchanges\. They are in order, the latest last; each was read once/);
    assert.match(multi, /short evidence from the exchange it happened in/);
    assert.match(multi, /grounded relationshipEvidence from the exchange it happened in/);
    assert.match(multi, /\nExchanges:\nUser: u1/);
    assert.doesNotMatch(multi, /CURRENT/);
});

test('lean: the relationship evaluator system prompt says exchanges for a window and is unchanged otherwise', () => {
    const source = fs.readFileSync(new URL('../src/relationship-pass.js', import.meta.url), 'utf8');
    assert.match(source, /Use only the supplied targets and current exchange\. Return only the requested JSON object\."\.replace\(options\.window === true \? \/current exchange\/ : \/\(\?!\)\/, 'exchanges'\)/);
});
