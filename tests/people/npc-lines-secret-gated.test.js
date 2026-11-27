import test from 'node:test';
import assert from 'node:assert/strict';
import { suite, dossiers } from './helpers/pacing-suite.js';
import { normalizeSecrets } from '../../modules/people/meters/npc-meters.js';
import { gateHolds } from '../../modules/people/meters/npc-meters-secrets-parts/gate-eval.js';

// A pack's spec secret ({ id, gate, text }) in NPC State (world-events switch): closed = absent from the narrator's prompt; the gate opening makes it
// revealable; a `~ reveal` line with a quote learns it. Swipes, Re-reads, deletes, rewinds and reloads equal live.
const FEATURES = { 'story-director.world-events': true };
const TEXT = 'He forged the last rite himself.';
const STORY = 'Oren looked at the floor and said he forged the last rite himself, and the whole room heard it.';
const QUOTE = 'he forged the last rite himself';
// A stand-in for the world's recorded anchors: they live in a domain a `~ anchor fact:x` line writes, so a reply's state has the anchors of that reply (like the chronicle's).
const stub = {
    id: 'story-director', name: 'Story Director stand-in',
    features: [{ id: 'story-director.world-events', label: 'World events', describe: 'The world switch (a stand-in).', default: false }],
    domains: { anchors: { initial: () => ({ list: [] }) } },
    capture: { kinds: { anchor: { grammar: '~ anchor KEY' } }, apply: (ctx, line) => { ctx.draft('anchors').list.push(String(line.name)); return { summary: 'anchor' }; } },
    queries: { 'chronicle.world.anchors': state => [...(state?.domains?.anchors?.list ?? [])] },
};
const records = (gate = 'meter trust >= 40') => {
    const all = dossiers();
    // An earlier secret that never opens stands first, so `rite` is never the next one a reply could earn (npc-lines-secret-earned): only its gate opens it here.
    all.npc_oren.secrets = [{ packId: 'first', gate: 'fact:never', text: 'Something older.', from: 'pack' }, { packId: 'rite', gate, text: TEXT, from: 'pack' }, { title: 'Old', text: 'He likes tea.', meter: 'trust', at: 90 }];
    return all;
};
const ID = normalizeSecrets(records().npc_oren.secrets)[1].id;
const reply = (story, lines) => `${story}${lines.length ? `\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : ''}`;
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };
const say = async (s, story, lines) => { await quiet(async () => { await s.host.send('And then?', reply(story, lines)); await s.adapter.ticked(); }); return s.host.store.headIndex(); };
const reveal = (id = ID, quote = QUOTE) => `~ reveal Oren | opened: ${id} | quote: "${quote}"`;
const opened = s => s.host.head().domains.people.bonds.npcs.npc_oren?.unlocked ?? [];
const snap = s => JSON.stringify(s.host.head().domains.people);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const open = (gate, features = FEATURES) => suite({ lines: true, records: records(gate), features, modules: [stub] });

test('a gate reads stage, meter, anchors, place and quote; and binds tighter than or; an unreadable term is false', () => {
    const known = { stage: 2, stageOf: name => ({ Trusted: 2 })[name] ?? 0, meter: id => (id === 'trust' ? 50 : null), anchors: new Set(['fact:vault']), place: 'Auvoth', quote: () => true };
    assert.equal(gateHolds('meter trust >= 40', known), true);
    assert.equal(gateHolds('meter trust >= 60', known), false);
    assert.equal(gateHolds('stage >= "Trusted"', known), true);
    assert.equal(gateHolds('stage >= 3', known), false);
    assert.equal(gateHolds('meter trust >= 60 or fact:vault', known), true);
    assert.equal(gateHolds('meter trust >= 60 and fact:vault or place:Auvoth', known), true);
    assert.equal(gateHolds('fact:vault and place:Elsewhere', known), false);
    assert.equal(gateHolds('place:auvoth', { ...known, place: 'Lower Auvoth' }), false, 'a place is matched whole, not by a part of its name');
    assert.equal(gateHolds('place:bluewatch-reach', { ...known, place: 'Bluewatch Reach' }), true, 'by name or id');
    assert.equal(gateHolds('learned:x/y', known), false);
    assert.equal(gateHolds('meter nosuch >= 1', known), false);
    assert.equal(gateHolds('', known), false);
});

test('a closed gate: the reveal is refused; the gate open: the quote opens it once; no quote, no reveal', async () => {
    const s = await open('meter trust >= 3');
    await say(s, STORY, [reveal()]);
    assert.deepEqual(opened(s), [], 'closed gate: refused');
    await say(s, 'Nothing.', ['~ npc Oren | trust: +9 | impact: major']);
    await say(s, 'He wrote it.', [reveal(ID, 'he forged the last rite himself and more')]);
    assert.deepEqual(opened(s), [], 'no quote found: stays closed');
    await say(s, STORY, [reveal()]);
    assert.deepEqual(opened(s), [ID], 'opened only once the gate holds');
});

test('an anchor gate opens from the world anchors; swipe, edited Re-read, reload and rewind equal live', async () => {
    const s = await open('fact:vault-opened');
    await say(s, STORY, [reveal()]);
    assert.deepEqual(opened(s), [], 'anchor not recorded: closed');
    await say(s, 'The vault opened.', ['~ anchor fact:vault-opened']);
    const at = await say(s, STORY, [reveal()]);
    assert.deepEqual(opened(s), [ID]);
    same(s, 'replay equals live');
    const first = snap(s);
    await quiet(async () => { await s.host.swipe(reply('Nothing happened.', [])); await s.adapter.ticked(); });
    assert.deepEqual(opened(s), [], 'a swipe takes the reveal back');
    same(s, 'swipe replay equals live');
    await s.host.st.swipeTo(at, 0);
    assert.equal(snap(s), first, 'swiping back restores it');
    s.host.ctx.chat[at].mes = reply('Nothing happened.', [reveal()]);
    assert.equal((await quiet(() => s.host.sdk.reread(at))).ok, true);
    assert.deepEqual(opened(s), [], 'an edit that drops the quote closes it');
    same(s, 'shrunk Re-read equals live');
    s.host.ctx.chat[at].mes = reply(STORY, [reveal(), '~ npc Oren | trust: +1']);
    assert.equal((await quiet(() => s.host.sdk.reread(at))).ok, true);
    assert.deepEqual(opened(s), [ID]);
    same(s, 'grown Re-read equals live');
    await s.host.turn.onChatChanged();
    same(s, 'chat change equals live');
});

test('switch off: the note is not read at all (no reveal, no rule), as main', async () => {
    const s = await open('fact:vault-opened', {});
    await say(s, 'The vault opened.', ['~ anchor fact:vault-opened']);
    await say(s, STORY, [reveal()]);
    assert.deepEqual(opened(s), []);
    assert.deepEqual(s.host.sdk.query('npc.meters', { name: 'Oren' })?.unlocked ?? [], []);
});

test('the gate is read as of the reply: an anchor recorded later does not open an earlier reveal on a Re-read; a middle delete and a rewind equal live', async () => {
    const s = await open('fact:vault-opened');
    const at = await say(s, STORY, [reveal()]);
    assert.deepEqual(opened(s), [], 'closed when written');
    await say(s, 'The vault opened.', ['~ anchor fact:vault-opened']);
    assert.deepEqual(s.host.head().domains.anchors.list, ['fact:vault-opened']);
    s.host.ctx.chat[at].mes = reply(STORY, [reveal(), '~ npc Oren | trust: +1']);
    assert.equal((await quiet(() => s.host.sdk.reread(at))).ok, true);
    assert.deepEqual(opened(s), [], 'a Re-read of the earlier reply reads the world as it was then, not the head');
    same(s, 'Re-read of an earlier reply equals live');
    const next = await say(s, STORY, [reveal()]);
    assert.deepEqual(opened(s), [ID], 'now open');
    await say(s, 'More.', []);
    await quiet(async () => { await s.host.st.deleteMessage(next); await s.host.st.deleteMessage(next - 1); });
    assert.deepEqual(opened(s), [], 'a middle delete takes the reveal with its reply');
    same(s, 'middle delete replay equals live');
    await say(s, STORY, [reveal()]);
    assert.deepEqual(opened(s), [ID]);
    await quiet(async () => { const head = s.host.store.headIndex(); await s.host.st.deleteMessage(head); await s.host.st.deleteMessage(head - 1); });
    assert.deepEqual(opened(s), [], 'a rewind past the reveal closes it again');
    same(s, 'rewind equals live');
});

test('an `of <id>` term that names someone other than the secret\'s owner is false; the owner\'s own id reads as before', () => {
    const known = { stage: 2, stageOf: () => 0, meter: () => 50, anchors: new Set(), place: '', owners: new Set(['mira', 'mira-vale']) };
    assert.equal(gateHolds('meter trust of mira >= 3', known), true);
    assert.equal(gateHolds('meter trust of oren >= 3', known), false, 'another person\'s meter never opens this secret');
    assert.equal(gateHolds('stage of oren >= 1', known), false);
    assert.equal(gateHolds('stage of mira >= 1', known), true);
    assert.equal(gateHolds('meter trust of oren >= 3', { ...known, owners: undefined }), true, 'no owner known: read as before');
});
