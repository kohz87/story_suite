import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { runtimeSource } from './helpers/runtime-source.js';
import { dossierUiSource } from './helpers/dossier-ui-source.js';
import { adapterSource } from './helpers/adapter-source.js';
import { FEATURE_STAGES, validateNpcSlice } from '../src/npc-meters.js';
import { readLeaf } from '../src/npc-meters-config.js';
import { normalizeEntry } from '../src/cast-dossier.js';
import { MODULE_ID, createStorySuiteV2Adapter } from '../src/storysuite-v2.js';
import { ERSVEIL, FENNA_ENTRY, OLD_DEFAULTS, castRow, director, suite } from './cast-dossier.helpers.js';

test('a person\'s pack stages are reached by the numbers alone, in order, with the preset\'s meters from the first meeting', async () => {
    const tansy = ERSVEIL.find(entry => entry.id === 'tansy-millrace');
    const records = { npc_tansy: { id: 'npc_tansy', name: 'Tansy Millrace', aliases: [], present: true, archived: false, castFrom: { key: 'ersveil:tansy-millrace', stages: normalizeEntry(tansy).stages } } };
    const host = await createHost({ settings: { modules: { [MODULE_ID]: { presets: ['companion'] } }, features: { [FEATURE_STAGES]: true, ...OLD_DEFAULTS } }, modules: [director()] });
    const box = { ready: Promise.resolve(host.sdk), sdk: host.sdk };
    const api = {
        isEnabled: () => true, getNpc: id => (records[id] ? structuredClone(records[id]) : null),
        relationshipBaseline: () => ({ trust: 0, affection: 0, desire: 0, tension: 0 }), presentCastHtml: () => '', castEmptyReason: () => ({ text: '' }), fillPresentCast: () => {},
    };
    const adapter = createStorySuiteV2Adapter({
        suiteApi: { npcs: () => Object.values(records).map(({ id, name, aliases, present, archived }) => ({ id, name, aliases, present, archived })) },
        delta: () => api, version: 'test', host: () => box, headReply: () => host.store.headIndex(),
        doc: { documentElement: { dataset: {} }, getElementById: () => null, addEventListener() {}, dispatchEvent() { return true; } },
        timers: { setTimeout: () => 0, clearTimeout() {}, setInterval: () => ({ unref() {} }), clearInterval() {} },
        logger: { warn() {} }, loadEmptyCast: async () => null,
    });
    adapter.start();
    await adapter.settled();
    const rank = () => host.sdk.query('npc.meters', { name: 'Tansy Millrace' })?.rank;
    await host.send('Hi', 'Tansy binds a wound.\n\n<Changes>\n~ npc Tansy Millrace | trust: +15\n</Changes>');
    await adapter.ticked();
    assert.equal(rank(), undefined, 'trust 15 is short of the first stage (20)');
    await host.send('Hi', 'She stitches you.\n\n<Changes>\n~ npc Tansy Millrace | trust: +10\n</Changes>');
    await adapter.ticked();
    assert.equal(rank(), 'Known patient', 'reached on the numbers: no story milestone is needed for it');
    assert.match(host.sdk.query('npc.next', { name: 'Tansy Millrace' }).text, /Night-shift friend/);
});

test('Story Director\'s cast is read through the adapter: cleaned, entry for the met only; with none to ask (or no such query) it answers null', async () => {
    const s = await suite();
    assert.deepEqual(s.adapter.castPeople(), [], 'an empty world');
    await s.world([castRow(), castRow({ key: 'ersveil:sera', id: 'sera', name: 'Sera' })]);
    assert.deepEqual(s.adapter.castPeople().map(item => [item.key, item.met, item.entry]), [['ersveil:fenna', null, null], ['ersveil:sera', null, null]]);
    const plain = await suite({ modules: [] });
    assert.equal(plain.adapter.castPeople(), null, 'Story Block alone: no cast anywhere');
    assert.deepEqual(plain.adapter.castMade(), {});
    const old = await suite({ modules: [{ id: 'zz-old', name: 'Older director', domains: {}, commands: {}, queries: { 'director.time': () => ({ minutes: 0 }) } }] });
    assert.equal(old.adapter.castPeople(), null, 'an older Story Director without the query');
});

test('the meeting is recorded in the slice at the reply it is first seen: the first numbers, the problem line, the stage; unmet people leave no trace', async () => {
    const settings = { customMeters: [{ name: 'Loyalty', min: 0, max: 100, start: 20 }], ladder: [] };
    const s = await suite({ settings, features: { [FEATURE_STAGES]: true, ...OLD_DEFAULTS } });
    await s.world([castRow(), castRow({ key: 'ersveil:sera', id: 'sera', name: 'Sera' })]);
    await s.say();
    assert.deepEqual(s.made(), {}, 'nobody met: nothing recorded, nobody synced');
    assert.deepEqual(s.synced, []);
    assert.equal(s.meters('Fenna'), null);

    await s.say(['~ meet Fenna']);
    assert.deepEqual(s.made(), { 'ersveil:fenna': { name: 'Fenna', rungs: 2 } });
    assert.equal(s.made()['ersveil:sera'], undefined, 'the other is still hidden');
    const fenna = s.meters('Fenna');
    assert.equal(fenna.meters.trust, 10);
    assert.equal(fenna.meters.loyalty, 30, 'a meter this chat has takes the pack\'s first value');
    assert.equal(s.meters('Sera'), null);
    const slice = s.host.head().domains.people?.bonds;
    assert.deepEqual(validateNpcSlice(slice), []);
    assert.ok(slice.problems.some(problem => /nonsense/.test(problem.text)), 'a meter this chat does not have is a problem line, not an error');
    assert.deepEqual(s.synced.length, 1, 'and the dossier is made (once)');

    // Later replies change nothing about it.
    await s.say();
    assert.deepEqual(Object.keys(s.made()), ['ersveil:fenna']);
    assert.equal(s.meters('Fenna').meters.loyalty, 30);
});

test('a swipe of the meeting\'s reply takes the record with it, a re-meeting on the new swipe records it again, a reload keeps it; the first numbers are never overwritten', async () => {
    const s = await suite({ settings: { customMeters: [{ name: 'Loyalty', min: 0, max: 100, start: 20 }] } });
    await s.world([castRow()]);
    await s.say(['~ meet Fenna']);
    assert.deepEqual(Object.keys(s.made()), ['ersveil:fenna']);
    await s.say(['~ npc Fenna | trust: +5']);
    assert.equal(s.meters('Fenna').meters.trust, 15);

    // Swipe the later reply: the meeting stays (it belongs to the earlier reply), the story's +5 is gone.
    await s.swipe();
    assert.deepEqual(Object.keys(s.made()), ['ersveil:fenna']);
    assert.equal(s.meters('Fenna').meters.trust, 10);

    // Swipe the meeting's own reply: it never happened on this swipe.
    await s.say();
    const head = s.host.store.headIndex();
    assert.ok(head >= 2);
    await s.host.turn.onChatChanged();
    assert.deepEqual(Object.keys(s.made()), ['ersveil:fenna'], 'a reload keeps it (the host rebuilds its state from the chat)');

    const t = await suite({ settings: { customMeters: [{ name: 'Loyalty', min: 0, max: 100, start: 20 }] } });
    await t.world([castRow()]);
    await t.say(['~ meet Fenna']);
    assert.deepEqual(Object.keys(t.made()), ['ersveil:fenna']);
    await t.swipe();
    assert.deepEqual(t.made(), {}, 'the swipe did not carry the meeting line: unrecorded');
    assert.equal(t.meters('Fenna'), null, 'and the entry that came with it');
    await t.swipe(['~ meet Fenna']);
    assert.deepEqual(Object.keys(t.made()), ['ersveil:fenna'], 'met again on the new swipe: recorded again');
    assert.equal(t.meters('Fenna').meters.trust, 10);
});

test('the person\'s own stages work like a ladder: reached by the numbers, only while stage ladders are on', async () => {
    const own = [{ name: 'Wary', needs: 'trust 5' }, { name: 'Ally', needs: 'trust 40' }];
    const records = { npc_fenna: { id: 'npc_fenna', name: 'Fenna', aliases: [], present: true, archived: false, castFrom: { key: 'ersveil:fenna', stages: own } } };
    const host = await createHost({ settings: { modules: { [MODULE_ID]: {} }, features: { [FEATURE_STAGES]: true } }, modules: [director()] });
    const box = { ready: Promise.resolve(host.sdk), sdk: host.sdk };
    const api = {
        isEnabled: () => true, getNpc: id => (records[id] ? structuredClone(records[id]) : null),
        relationshipBaseline: () => ({ trust: 0, affection: 0, desire: 0, tension: 0 }), presentCastHtml: () => '', castEmptyReason: () => ({ text: '' }), fillPresentCast: () => {},
    };
    const adapter = createStorySuiteV2Adapter({
        suiteApi: { npcs: () => Object.values(records).map(({ id, name, aliases, present, archived }) => ({ id, name, aliases, present, archived })) },
        delta: () => api, version: 'test', host: () => box, headReply: () => host.store.headIndex(),
        doc: { documentElement: { dataset: {} }, getElementById: () => null, addEventListener() {}, dispatchEvent() { return true; } },
        timers: { setTimeout: () => 0, clearTimeout() {}, setInterval: () => ({ unref() {} }), clearInterval() {} },
        logger: { warn() {} }, loadEmptyCast: async () => null,
    });
    adapter.start();
    await adapter.settled();
    await host.send('Hi', 'Fenna smiles.\n\n<Changes>\n~ npc Fenna | trust: +10\n</Changes>');
    await adapter.ticked();
    assert.equal(host.sdk.query('npc.meters', { name: 'Fenna' }).rank, 'Wary');
    assert.match(host.sdk.query('npc.next', { name: 'Fenna' }).text, /Ally/);
    await host.send('Hi', 'Fenna nods.\n\n<Changes>\n~ npc Fenna | trust: +15\n</Changes>');
    await host.send('Hi', 'Fenna nods.\n\n<Changes>\n~ npc Fenna | trust: +15\n</Changes>');
    assert.equal(host.sdk.query('npc.meters', { name: 'Fenna' }).rank, 'Ally');
});

test('with no Story Director the per-reply step and the slice are exactly as before', async () => {
    const s = await suite({ modules: [], features: OLD_DEFAULTS });
    await s.say(['~ npc Ren | trust: +5']);
    assert.equal(s.host.head().domains.people?.bonds?.cast, undefined);
    assert.deepEqual(s.synced, []);
    assert.equal(s.meters('Ren').meters.trust, 5);
});

test('the cast box sits in Right now, and the "Next:" line has its own space under the meters', () => {
    const ui = dossierUiSource();
    // The section bar is gone with the one long page: the cast and away blocks head the Right now section.
    assert.doesNotMatch(ui, /delta-section-nav/);
    assert.match(ui, /castFromHtml\(npc\.cast\)/, 'the cast block is drawn in Right now');
    assert.match(ui, /keyAwayHtml\(npc\.key\)/, 'so is the away block');
    // `.delta-section p { margin:0 }` outranks a bare class: the 6px of the rank, next and milestones lines never applied.
    assert.match(ui, /\.delta-section p\.delta-v2-next, [^\n]*\.delta-section p\.delta-v2-note \{ margin:6px 0 0;/);
    assert.doesNotMatch(ui, /#\$\{ROOT_ID\} \.delta-v2-next/, 'no bare-class rule for the lines (it loses to .delta-section p)');
    assert.match(ui, /\.delta-section \.delta-rel-grid \+ p \{ margin-top:12px; \}/, 'the first line under the meter grid gets 12px');
});

// ---- the opaque panel and section bar (a follow-up from the mockup) ----

test('the dossier panel is opaque: a floor under the tint, the tint over it', () => {
    const ui = dossierUiSource();
    assert.match(ui, /\.delta-panel \{[^}]*background-color:var\(--delta-floor\); background-image:linear-gradient\(var\(--delta-bg\),var\(--delta-bg\)\);/s);
    assert.doesNotMatch(ui, /\.delta-panel \{[^}]*background:var\(--delta-bg\)/s, 'the translucent tint alone is gone');
    assert.match(ui, /--delta-floor: var\(--ss-sheet-floor, #18191d\)/, 'a fixed floor where the host gives none');
    assert.match(ui, /@supports \(color: rgb\(from red r g b\)\)[\s\S]*--delta-floor: var\(--ss-sheet-floor, rgb\(from var\(--delta-bg\) r g b \/ 1\)\)/, 'the tint with its alpha dropped where relative colours exist');
});

test('index.js wiring: the cast reader, the checkpoint, the dismissal check, the views (source)', () => {
    const index = runtimeSource();
    assert.match(index, /commitBranchCheckpoint\(working, messageId, 'cast-dossier'\)/, 'a swipe takes the dossier back with its reply');
    assert.match(index, /castPersonDismissed\(state, person\)/, 'a dossier the reader removed is not made again');
    assert.match(index, /v2\.startStorySuiteV2\(\{[^}]*castSync/, 'the adapter calls the sync after the step');
    assert.match(index, /const castViews = dossierCastViews\(state\);/);
    const adapter = adapterSource();
    assert.doesNotMatch(adapter, /sdkRef\.command\(['"]director\./, 'Delta never writes to Story Director');
});

test('the adapter reads Story Block\'s own party.levels as it answers: an array with the RPG on, null with it off', async () => {
    const off = await suite({ features: { 'story-block.rpg': false } });
    assert.equal(off.adapter.partyLevelsAnswer(), null, 'RPG off: null');
    const on = await suite({ features: { 'story-block.rpg': true } });
    const answer = on.adapter.partyLevelsAnswer();
    assert.ok(answer === null || Array.isArray(answer), 'RPG on: the host\'s answer (an array, or null while no party exists)');
});

test('mood: a person met from the cast starts at the resting mood their pack personality gives (temperament, not 0), stored with the record', async () => {
    const calm = await suite({ features: { 'npc-state-delta.mood-pull': true } });
    await calm.world([castRow({ entry: { ...structuredClone(FENNA_ENTRY), personality: 'Calm, confident and unhurried.' } })]);
    await calm.say(['~ meet Fenna']);
    const raw = Object.values(calm.host.head().domains.people.bonds.npcs).find(record => record.name === 'Fenna')?.mood;
    const mood = readLeaf(raw);
    assert.equal(typeof raw, 'string', 'stored whole as one text leaf');
    assert.deepEqual([mood?.v, mood?.a, mood?.d, mood?.rest], [0, -2, 1, { v: 0, a: -2, d: 1 }]);
    assert.deepEqual(validateNpcSlice(calm.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
    const plain = await suite({ features: { 'npc-state-delta.mood-pull': true } });
    await plain.world([castRow({ entry: { ...structuredClone(FENNA_ENTRY), personality: 'Likes ferries.' } })]);
    await plain.say(['~ meet Fenna']);
    assert.equal(Object.values(plain.host.head().domains.people.bonds.npcs).find(record => record.name === 'Fenna')?.mood, undefined, 'no temperament words: no mood until an event');
});

test('defaults on: a meeting written with gate, mood and pull, and notes off is read again identically after they are switched on (the tick is kept, no tastes, drives or mood are added)', async () => {
    const s = await suite({ features: OLD_DEFAULTS });
    await s.world([castRow()]);
    await s.say();
    await s.say(['~ meet Fenna']);
    const meeting = s.host.store.headIndex();
    await s.say(['~ npc Fenna | trust: -3 | impact: major']);
    const bare = () => JSON.stringify(s.host.head().domains.people?.bonds).replace(/sw_[a-z0-9]+/g, 'sw');
    const written = bare();
    for (const id of Object.keys(OLD_DEFAULTS)) s.host.features.set(id, true);
    s.host.store.rebuild();
    assert.equal(bare(), written, 'rebuild under the new defaults');
    const again = await s.host.sdk.reread(meeting);
    assert.equal(again.ok, true, JSON.stringify(again));
    assert.equal(bare(), written, 'the meeting reply read again: the same state (no mood, tastes, drives, track or pull added)');
});
