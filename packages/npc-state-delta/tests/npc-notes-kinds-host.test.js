import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { NOTE_FIELDS } from '../src/npc-notes-kinds.js';
import { readTastes } from '../src/npc-notes-tastes.js';
import { suite } from './helpers/pacing-suite.js';
import { MODULE_ID } from '../src/storysuite-v2.js';
import { validateNpcSlice } from '../src/npc-meters.js';
import { FEATURE_NOTES, RECORD_FIELDS, readLeaf } from '../src/npc-meters-config.js';
import { ON, oren, cast, optional, shape } from './npc-notes-kinds.helpers.js';

test('notes host: the record fields are the kinds file\'s NOTE_FIELDS, and a lie told is one leaf in the line\'s own op, hidden in the tail', async () => {
    for (const field of NOTE_FIELDS) assert.ok(RECORD_FIELDS.includes(field), field);
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ lie Oren | to: Astra | said: I never sold the spell']);
    assert.equal(JSON.parse(oren(s).lies).length, 1);
    assert.ok(optional(s).some(line => /(^|\n)Oren \(hidden\): told Astra "I never sold the spell"/.test(line)), JSON.stringify(optional(s)));
    assert.deepEqual(validateNpcSlice(s.host.head().domains.npc), []);
    assert.equal((await cast(s)).notes.lies[0].said, null, 'the player\'s view of an uncaught lie has no words of it');
});

test('notes host: only a story line catches a lie: six trust, in the day\'s allowance, the mood cause, and a second catch with none left moves nothing', async () => {
    const s = await suite({ allowance: null, features: { ...ON, 'npc-state-delta.mood-pull': true } });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    await s.say(['~ lie Oren | to: Astra | said: I never sold the spell']);
    await s.say(['~ lie Oren | to: Astra | caught: yes']);
    assert.equal(s.npc('Oren').meters.trust, -5, 'trust 1 - 6');
    assert.match(readLeaf(oren(s).mood).cause, /caught lying to Astra/);
    assert.ok(JSON.parse(oren(s).lies)[0].caught);
    assert.equal((await cast(s)).notes.lies[0].said, 'I never sold the spell', 'a caught lie is shown');
    assert.deepEqual(validateNpcSlice(s.host.head().domains.npc), []);
    await s.say(['~ lie Oren | to: Astra | caught: yes']);
    assert.equal(s.npc('Oren').meters.trust, -5, 'no uncaught lie left: the line is refused and nothing moves');
});

test('notes host: know lines of one reply are kept together, a secret reads as hidden until told, a bad line writes nothing', async () => {
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ know Oren | about: Astra | fact: copies the gate-logs | how: saw | secret: yes', '~ know Oren | about: Temiwa | fact: is ill | how: heard']);
    assert.equal(JSON.parse(oren(s).knows).length, 2);
    assert.equal((await cast(s)).notes.knows.find(item => item.about === 'Astra').hidden, true);
    assert.doesNotMatch(JSON.stringify((await cast(s)).notes), /gate-logs/);
    assert.ok(optional(s).some(line => /(^|\n)Oren \(hidden\): knows Astra's copies the gate-logs/.test(line)));
    await s.say(['~ know Oren | about: Astra | fact: copies the gate-logs | told: yes']);
    assert.equal((await cast(s)).notes.knows.find(item => item.about === 'Astra').hidden, false);
    const before = oren(s).knows;
    await s.say(['~ know Oren | about: Astra | how: saw']);
    assert.equal(oren(s).knows, before, 'a line with no fact is refused: the leaf is as it was');
});

test('notes host: a taste is fixed (a swap needs why:), an echo of the player\'s words is kept and flagged; ties keep several tags and drop one', async () => {
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.host.send('I love burnt toffee', 'Fine.\n\n<Changes>\n~ taste Oren | likes: burnt toffee\n</Changes>');
    await s.adapter.ticked();
    assert.equal(JSON.parse(oren(s).tastes)[0].mirrored, true);
    assert.ok(s.host.head().domains.npc.problems.some(item => /echoes/.test(item.text)));
    await s.say(['~ taste Oren | dislikes: stamped paperwork | from: the charter']);
    await s.say(['~ taste Oren | likes: stamped paperwork']);
    assert.equal(JSON.parse(oren(s).tastes).filter(item => item.sign === '+').length, 1, 'refused without why:');
    await s.say(['~ tie Oren | with: Sister Temiwa | tag: +ally, +owes']);
    assert.deepEqual(Object.values(JSON.parse(oren(s).ties)), [['ally', 'owes']]);
    await s.say(['~ tie Oren | with: Sister Temiwa | tag: -ally']);
    assert.deepEqual(Object.values(JSON.parse(oren(s).ties)), [['owes']]);
    assert.deepEqual(validateNpcSlice(s.host.head().domains.npc), []);
});

test('notes host: feature off: the note lines write nothing and the static text is the same', async () => {
    const off = await suite({ allowance: null, features: { [FEATURE_NOTES]: false } });
    await off.setDay(1);
    await off.say(['~ lie Oren | to: Astra | said: x']);
    assert.equal(oren(off), undefined);
    const on = await suite({ allowance: null, features: ON });
    const text = x => x.host.registry.module(MODULE_ID).context.static();
    assert.equal(text(off), text(on), 'the npc static line has no notes text: the grammar goes through the kinds, behind the feature');
});

test('notes host: replay equals live: rebuild, a swipe, a Re-read, a middle delete and a cold reload (the leaves are part of the reply\'s op)', async () => {
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ lie Oren | to: Astra | said: first']);
    const middle = await s.say(['~ know Oren | about: Astra | fact: a thing | how: saw', '~ tie Oren | with: Sister Temiwa | tag: +rival']);
    await s.say(['~ taste Oren | likes: tea']);
    await s.swipe(['~ taste Oren | likes: coffee']);
    const index = await s.say(['~ lie Oren | to: Astra | caught: yes']);
    assert.equal((await s.host.sdk.reread(index)).ok, true);
    let live = shape(s);
    s.host.store.rebuild();
    assert.equal(shape(s), live, 'rebuild equals live');
    await s.host.st.loadChat(s.host.ctx.chat);
    await s.adapter.ticked();
    assert.equal(shape(s), live, 'a cold reload equals live');
    await s.host.st.deleteMessage(middle);
    await s.host.st.deleteMessage(middle - 1);
    live = shape(s);
    s.host.store.rebuild();
    assert.equal(shape(s), live, 'rebuild equals live after the delete');
    assert.deepEqual(s.host.store.problems(), []);
    assert.deepEqual(validateNpcSlice(s.host.head().domains.npc), []);
});

test('notes host: long taste reasons and items survive Changes, Refresh, display, Re-read and replay', async () => {
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    const reason = 'beamed at the gift and ate her warm piece eagerly at the desk before asking for another slice';
    const item = 'warm honey oat cake with toasted almonds and candied orange peel from the guild kitchen';
    const index = await s.say([`~ taste Oren | likes: ${item} | from: ${reason}`]);
    const first = oren(s).tastes;
    const written = readTastes(first)[0];
    assert.equal(written.from, reason);
    assert.match(written.item, /…$/u);
    assert.deepEqual((await cast(s)).notes.tastes[0], { sign: '+', item: written.item, from: reason, mirrored: false });
    assert.equal((await s.host.sdk.reread(index)).ok, true);
    assert.equal(oren(s).tastes, first, 'Re-read keeps new rule and the same bytes');
    const duplicate = await s.say([`~ taste Oren | likes: ${item} | from: ${reason}`]);
    assert.equal(oren(s).tastes, first, 'a repeated long item is a no-op');
    assert.equal((await s.host.sdk.reread(duplicate)).ok, true);
    assert.equal(oren(s).tastes, first, 'Re-reading the no-op does not introduce a second truncated item');
    await s.adapter.tastes({ name: 'Oren', tastes: [{ sign: '-', item: 'cold tea', from: reason }], reply: s.host.store.headIndex() });
    assert.equal(readTastes(oren(s).tastes)[1].from, reason);
    const live = oren(s).tastes;
    s.host.store.rebuild();
    assert.equal(oren(s).tastes, live);
});

test('notes host: npc.flag stamps the first look once and the reader\'s button is refused', async () => {
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    assert.equal((await s.host.sdk.command('npc.flag', { name: 'Oren', lock: true })).ok, false, 'not from a button');
    await s.adapter.flag({ name: 'Oren', lock: true, reply: s.host.store.headIndex(), cue: 'Oren\'s look is fixed: grey hair.' });
    const stamp = oren(s).lookLockedAt;
    assert.ok(stamp && Number.isInteger(stamp.day));
    await s.adapter.flag({ name: 'Oren', lock: true, reply: s.host.store.headIndex() });
    assert.deepEqual(oren(s).lookLockedAt, stamp, 'kept once');
    assert.equal(await s.adapter.flag({ name: 'Sister Temiwa', lock: true, reply: s.host.store.headIndex() }), null, 'a person with no meters gets no entry made by a flag');
    assert.equal(s.npc('Sister Temiwa'), null);
    assert.deepEqual(validateNpcSlice(s.host.head().domains.npc), []);
});

test('locked look: the scan forwards a refused durable look as a flag (Problem + cue), and nothing when it is accepted or unchanged', async () => {
    // runtime-hosted.js imports the host's extensions.js: load a copy of the runtime beside a stub of it.
    const root = fileURLToPath(new URL('../', import.meta.url));
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'delta-look-flag-'));
    const ext = path.join(temp, 'a', 'b', 'ext');
    fs.mkdirSync(ext, { recursive: true });
    for (const file of fs.readdirSync(root).filter(name => name.endsWith('.js'))) fs.copyFileSync(path.join(root, file), path.join(ext, file));
    fs.cpSync(path.join(root, 'src'), path.join(ext, 'src'), { recursive: true });
    fs.writeFileSync(path.join(temp, 'extensions.js'), 'export const getContext = () => ({ chat: [] });\nexport const extension_settings = {};\n');
    globalThis.document = { documentElement: { dataset: { npcStateDeltaStoryBlockV2: '1' } } };
    const sent = [];
    try {
        const { createHostedPart } = await import(pathToFileURL(path.join(ext, 'runtime-hosted.js')).href);
        const adapter = { hosted: () => true, flag: async item => { sent.push(item); }, adjust: async () => {} };
        const part = createHostedPart({ storySuiteV2: adapter }, { chatHydrationStatus: () => ({}), getChatKey: () => 'k', getChatState: () => ({}), latestMessageId: () => 0, latestReplyIndex: () => 0 });
        const rika = overall => ({ id: 'n1', name: 'Rika', overallAppearance: overall });
        const held = 'White hair, yellow-green eyes.';
        const tick = () => new Promise(resolve => setTimeout(resolve, 5));
        part.forwardRelationshipChangesToHost([rika(held)], [rika(held)], 7, null, [{ id: 'n1', overallAppearance: 'Black hair, brown eyes.' }]);
        await tick();
        assert.equal(sent.length, 1);
        assert.equal(sent[0].name, 'Rika');
        assert.equal(sent[0].reply, 7);
        assert.deepEqual(sent[0].drift, { before: held, incoming: 'Black hair, brown eyes.', swaps: [{ trait: 'hair', said: 'black', kept: 'white' }, { trait: 'eyes', said: 'brown', kept: 'yellow green' }] });
        sent.length = 0;
        part.forwardRelationshipChangesToHost([rika(held)], [rika('Black hair, brown eyes.')], 8, null, [{ id: 'n1', overallAppearance: 'Black hair, brown eyes.' }]);
        part.forwardRelationshipChangesToHost([rika(held)], [rika(held)], 9, null, [{ id: 'n1', overallAppearance: held }]);
        part.forwardRelationshipChangesToHost([rika(held)], [rika(held)], 9, null, []);
        await tick();
        assert.deepEqual(sent, []);
    } finally { delete globalThis.document; fs.rmSync(temp, { recursive: true, force: true }); }
});

test('notes host: a refused look reaches npc.flag as a Problem, written once; the same look sends nothing', async () => {
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    const drift = { before: 'Grey hair, grey eyes.', incoming: 'Black hair.' };
    const head = () => s.host.store.headIndex();
    const done = await s.adapter.flag({ name: 'Oren', drift, reply: head() });
    assert.ok(done);
    const problems = s.host.store.problems().concat(s.host.head().domains.npc.problems ?? []);
    assert.ok(problems.some(item => /Look drift refused: "Black hair\." does not match the fixed look "Grey hair, grey eyes\."/.test(item?.text ?? item)));
    const count = () => (s.host.head().domains.npc.problems ?? []).length;
    const once = count();
    await s.adapter.flag({ name: 'Oren', drift, reply: head() });
    assert.equal(count(), once, 'the same text is not written twice');
    assert.equal(await s.adapter.flag({ name: 'Oren', drift: { before: 'Grey hair.', incoming: 'grey hair' }, reply: head() }), null, 'the same look sends nothing');
    assert.deepEqual(validateNpcSlice(s.host.head().domains.npc), []);
});

test('notes host (review fixes): npc.cast hides an uncaught lie\'s words and id; the lie tail line carries the (hidden) wording when no locked meter note does; a caught lie held by the day\'s allowance is still recorded as caught', async () => {
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ lie Oren | to: Astra | said: I never sold the spell']);
    const lies = (await cast(s)).notes.lies;
    assert.equal(lies.length, 1);
    assert.doesNotMatch(JSON.stringify(lies), /never sold/);
    const lines = optional(s);
    const at = lines.findIndex(line => /\nOren \(hidden\): told Astra/.test(line));
    assert.ok(at >= 0, JSON.stringify(lines));
    assert.match(lines[at], /^Lines marked \(hidden\) are secrets: never state or reveal them/);
    const held = await suite({ allowance: { ordinary: 0, meaningful: 0, major: 0, extreme: 0 }, features: ON });
    await held.setDay(1);
    await held.say(['~ npc Oren | trust: +1']);
    await held.say(['~ lie Oren | to: Astra | said: I never sold the spell']);
    const trust = held.npc('Oren').meters.trust;
    await held.say(['~ lie Oren | to: Astra | caught: yes']);
    assert.ok(JSON.parse(oren(held).lies)[0].caught, 'the player caught it, so it is recorded as caught even when the day holds the drop');
    assert.equal(held.npc('Oren').meters.trust, trust, 'the allowance held the trust drop');
});

test('notes host (review fix 5/9): a swipe of the reply whose scan sent npc.flag takes back the look stamp and the Problem', async () => {
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    await s.say(['~ npc Oren | trust: +1']);
    const head = () => s.host.store.headIndex();
    await s.adapter.flag({ name: 'Oren', lock: true, reply: head() });
    await s.adapter.flag({ name: 'Oren', drift: { before: 'Grey hair, grey eyes.', incoming: 'Black hair.' }, reply: head() });
    assert.ok(oren(s).lookLockedAt, 'stamped');
    assert.ok((s.host.head().domains.npc.problems ?? []).some(item => /Look drift refused/.test(item?.text ?? '')), 'flagged');
    await s.swipe(['~ npc Oren | trust: +1']);
    assert.equal(oren(s).lookLockedAt, undefined, 'the swiped reply\'s stamp is gone');
    assert.ok(!(s.host.head().domains.npc.problems ?? []).some(item => /Look drift refused/.test(item?.text ?? '')), 'and its Problem');
    assert.deepEqual(validateNpcSlice(s.host.head().domains.npc), []);
});

test('notes host: npc.meet gives a scan-admitted person an entry with the dossier\'s mood and drives; a button, a repeat and a swipe-free rebuild all hold', async () => {
    const s = await suite({ allowance: null, features: { ...ON, 'npc-state-delta.mood-pull': true } });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    assert.equal((await s.host.sdk.command('npc.meet', { name: 'Mara' })).ok, false, 'not from a button');
    const slice = () => s.host.head().domains.npc;
    assert.equal(slice().npcs.mara, undefined, 'a person the scan admitted has no entry yet');
    await s.adapter.meet({ name: 'Mara', personality: 'cheerful, warm and kind; confident and bold', about: 'a caravan guard' });
    const mara = slice().npcs.mara;
    assert.ok(mara && mara.meters, 'the entry exists with meters');
    assert.ok(mara.mood && mara.mood.v > 0 && mara.mood.d > 0, 'a resting mood from the temperament words');
    assert.deepEqual(validateNpcSlice(slice()), []);
    const live = JSON.stringify(slice());
    await s.adapter.meet({ name: 'Mara', personality: 'cheerful, warm and kind' });   // refused: nothing to add
    assert.equal(JSON.stringify(slice()), live, 'a second meeting changes nothing');
    s.host.store.rebuild();
    assert.equal(JSON.stringify(slice()), live, 'rebuild equals live');
    assert.deepEqual(s.host.store.problems(), []);
});

test('notes host: npc.meet gives a scan-admitted person with no temperament words a mood at rest (0/0/0) and a pull entry, once', async () => {
    const s = await suite({ allowance: null, features: { ...ON, 'npc-state-delta.mood-pull': true } });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    await s.adapter.meet({ name: 'Corren', personality: 'quiet', about: 'a clerk' });
    const slice = () => s.host.head().domains.npc;
    const mood = slice().npcs.corren.mood;
    assert.ok(mood && mood.v === 0 && mood.a === 0 && mood.d === 0, 'a mood with all three fields at rest');
    assert.deepEqual(validateNpcSlice(slice()), []);
    await s.say(['~ npc Oren | trust: +1']);
    assert.ok(slice().npcs.corren.mood, 'the tick keeps stepping it');
    const live = JSON.stringify(slice());
    s.host.store.rebuild();
    assert.equal(JSON.stringify(slice()), live, 'rebuild equals live');
});

test('notes host: npc.meet takes the reply the scan read (as npc.adjust does); rebuild equals live', async () => {
    const s = await suite({ allowance: null, features: { ...ON, 'npc-state-delta.mood-pull': true } });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    const older = s.host.store.headIndex();
    await s.say(['~ npc Oren | trust: +1']);
    await s.adapter.meet({ name: 'Mara', personality: 'cheerful, warm and kind', reply: older });   // a scan of the older reply admitted her
    const slice = () => s.host.head().domains.npc;
    assert.ok(slice().npcs.mara && slice().npcs.mara.meters, 'met');
    assert.deepEqual(validateNpcSlice(slice()), []);
    const live = JSON.stringify(slice());
    s.host.store.rebuild();
    assert.equal(JSON.stringify(slice()), live, 'rebuild equals live');
});

test('scan-admitted people: the scan sends npc.meet for a dossier it just made, not for a known or archived one, and an older host without meet gets nothing', async () => {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'delta-meet-'));
    const ext = path.join(temp, 'a', 'b', 'ext');
    fs.mkdirSync(ext, { recursive: true });
    for (const file of fs.readdirSync(root).filter(name => name.endsWith('.js'))) fs.copyFileSync(path.join(root, file), path.join(ext, file));
    fs.cpSync(path.join(root, 'src'), path.join(ext, 'src'), { recursive: true });
    fs.writeFileSync(path.join(temp, 'extensions.js'), 'export const getContext = () => ({ chat: [] });\nexport const extension_settings = {};\n');
    globalThis.document = { documentElement: { dataset: { npcStateDeltaStoryBlockV2: '1' } } };
    const sent = [];
    try {
        const { createHostedPart } = await import(pathToFileURL(path.join(ext, 'runtime-hosted.js')).href);
        const deps = { chatHydrationStatus: () => ({}), getChatKey: () => 'k', getChatState: () => ({}), latestMessageId: () => 0, latestReplyIndex: () => 0 };
        const order = [];
        const adapter = { hosted: () => true, flag: async () => { order.push('flag'); }, adjust: async () => { order.push('adjust'); }, meet: async ({ guard, ...item }) => { order.push('meet'); assert.equal(typeof guard, 'function', 'the meeting carries its guard (held while a native change finishes, dropped if its reply is taken back)'); sent.push(item); } };
        const part = createHostedPart({ storySuiteV2: adapter }, deps);
        const old = { id: 'o1', name: 'Oren' };
        const fresh = { id: 'n2', name: 'Coram', personality: 'calm and stoic', background: 'a ferryman' };
        const tick = () => new Promise(resolve => setTimeout(resolve, 5));
        part.forwardRelationshipChangesToHost([old], [old, fresh, { id: 'n3', name: 'Gone', archived: true }], 4, null, []);
        await tick();
        assert.deepEqual(sent, [{ name: 'Coram', personality: 'calm and stoic', about: 'a ferryman', reply: 4 }], 'the meeting names the reply the scan read');
        sent.length = 0;
        // Not the dead and not incidental extras (the slice holds 80 people); an ordinary, living, meaningful one is met.
        const extras = [{ id: 'd1', name: 'Raider', lifeState: 'deceased' }, { id: 'd2', name: 'Raider Two', lifeState: 'dead' }, { id: 'i1', name: 'Passer-by', dossierSignal: 'incidental' }, { id: 'm1', name: 'Wren', dossierSignal: 'meaningful', lifeState: 'alive' }];
        part.forwardRelationshipChangesToHost([old], [old, ...extras], 4, null, []);
        await tick();
        assert.deepEqual(sent.map(item => item.name), ['Wren']);
        sent.length = 0;
        // Order: the slice entry first (adjust, else meet), then the look lock, which never makes an entry itself.
        order.length = 0;
        const moved = { id: 'n4', name: 'Tarn', relationship: { trust: 5 }, overallAppearance: 'a tall man in grey' };
        part.forwardRelationshipChangesToHost([old], [old, moved, { id: 'n5', name: 'Lis', overallAppearance: 'a short woman' }], 4, null, []);
        await tick();
        assert.deepEqual(order, ['adjust', 'meet', 'meet', 'flag', 'flag'], 'meters and meetings before the look flags');
        sent.length = 0;
        part.forwardRelationshipChangesToHost([old, fresh], [old, fresh], 5, null, []);
        await tick();
        assert.deepEqual(sent, [], 'a known person is not met again');
        const older = createHostedPart({ storySuiteV2: { hosted: () => true, flag: async () => {}, adjust: async () => {} } }, deps);
        older.forwardRelationshipChangesToHost([old], [old, fresh], 6, null, []);
        await tick();
        assert.deepEqual(sent, [], 'an adapter without meet: as before');
    } finally { delete globalThis.document; fs.rmSync(temp, { recursive: true, force: true }); }
});
