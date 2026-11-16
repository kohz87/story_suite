import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord } from '../core.js';
import { normalizeNpcRecord } from '../core-mechanics.js';
import { applyCastEntry, applyCastPortrait, castPortraitWanted, markCastPortraitRemoved, normalizeCast } from '../src/cast-dossier.js';
import { preserveUserNpcMetadata } from '../branch-core.js';
import { runHostScenario } from './helpers/host-scenario.js';
import { runtimeSource } from './helpers/runtime-source.js';
import { adapterSource } from './helpers/adapter-source.js';
import { FENNA_ENTRY, OLD_DEFAULTS, castRow, dateText, person, scenarioOutput, suite } from './cast-dossier.helpers.js';

const FILE_PORTRAIT = (hash = 'a'.repeat(64)) => ({ path: `/user/files/npc-state-delta-portrait-${hash.slice(0, 40)}.png`, type: 'image/png', hash, sourceName: 'fenna.webp', updatedAt: 1 });

test('a cast dossier may be given the pack\'s picture only while it has none of its own and the reader has not removed one; the removal is recorded in castFrom', () => {
    const [p] = normalizeCast([person()], dateText);
    const made = normalizeNpcRecord(applyCastEntry(createNpcRecord('Fenna', []), p, { packName: 'Ersveil' }));
    assert.equal(made.portrait, null, 'made without a picture');
    assert.equal(castPortraitWanted(made), true, 'a cast dossier with an empty portrait');
    const given = applyCastPortrait(made, FILE_PORTRAIT());
    assert.deepEqual(given.portrait, FILE_PORTRAIT());
    assert.equal(made.portrait, null, 'the dossier it was given to is not changed in place');
    assert.deepEqual({ ...given, portrait: null }, made, 'only the portrait differs');
    assert.equal(castPortraitWanted(given), false, 'once it has one it is not asked for again');
    assert.equal(applyCastPortrait(given, FILE_PORTRAIT('b'.repeat(64))), given, 'and one it has is never replaced');
    // An upload or a generated picture (held in the record) is the reader\'s own picture.
    const mine = { ...made, portrait: { dataUrl: 'data:image/png;base64,AAAA', mime: 'image/png' } };
    assert.equal(castPortraitWanted(mine), false);
    assert.equal(applyCastPortrait(mine, FILE_PORTRAIT()), mine);
    // Removed on purpose: nothing puts it back.
    const removed = markCastPortraitRemoved(made);
    assert.equal(removed.castFrom.portraitRemoved, true);
    assert.deepEqual({ ...removed.castFrom, portraitRemoved: undefined }, { ...made.castFrom, portraitRemoved: undefined }, 'the rest of castFrom is as it was');
    assert.equal(made.castFrom.portraitRemoved, undefined, 'not changed in place');
    assert.equal(castPortraitWanted(removed), false);
    assert.equal(applyCastPortrait(removed, FILE_PORTRAIT()), removed);
    // Not a cast dossier: never.
    const plain = createNpcRecord('Yunyun', []);
    assert.equal(castPortraitWanted(plain), false, 'a dossier a scan or the reader made');
    assert.equal(applyCastPortrait(plain, FILE_PORTRAIT()), plain);
    assert.equal(markCastPortraitRemoved(plain), plain, 'and a removal there records nothing');
    assert.equal(applyCastPortrait(made, { dataUrl: '' }), made, 'a record without a picture gives nothing');
    assert.equal(castPortraitWanted(null), false);
});

test('a restore from a checkpoint keeps the mark that the reader removed a cast dossier\'s picture, and adds none to anyone else', () => {
    const [p] = normalizeCast([person()], dateText);
    const made = normalizeNpcRecord(applyCastEntry(createNpcRecord('Fenna', []), p, { packName: 'Ersveil' }));
    const removed = markCastPortraitRemoved(made);
    const [restored] = preserveUserNpcMetadata([made], [removed]);
    assert.equal(restored.castFrom.portraitRemoved, true, 'the checkpoint was taken before the removal; the reader\'s removal stands');
    assert.equal(restored.portrait, null);
    const [other] = preserveUserNpcMetadata([made], [made]);
    assert.equal(other.castFrom.portraitRemoved, undefined, 'no mark where there was none');
    const stranger = { ...removed, castFrom: { ...removed.castFrom, key: 'ersveil:someone-else' } };
    assert.equal(preserveUserNpcMetadata([made], [stranger])[0].castFrom.portraitRemoved, undefined, 'only for the same person');
    const withPicture = { ...made, portrait: FILE_PORTRAIT() };
    assert.deepEqual(preserveUserNpcMetadata([made], [withPicture])[0].portrait, FILE_PORTRAIT(), 'a picture the dossier has now is kept, as before');
});

test('the adapter asks for the picture sync when the step has nothing to do, only when there is a picture to give', async () => {
    let due = false;
    const s = await suite({ castPortraitDue: () => due, features: OLD_DEFAULTS });
    await s.world([castRow({ entry: { ...structuredClone(FENNA_ENTRY), stages: [] } })]);
    await s.say(['~ meet Fenna']);
    assert.equal(s.synced.length, 1, 'the meeting: the sync runs for the new dossier, once');
    await s.say();
    await s.say();
    assert.equal(s.synced.length, 1, 'no picture to give: later replies leave the sync alone');
    due = true;
    await s.say();
    assert.ok(s.synced.length >= 2, 'a picture to give: the next reply runs the sync');
    const before = s.synced.length;
    due = false;
    await s.say();
    assert.equal(s.synced.length, before, 'and it stops when there is none');
    // Without the option (older callers) nothing is asked.
    const plain = await suite({ features: OLD_DEFAULTS });
    await plain.world([castRow({ entry: { ...structuredClone(FENNA_ENTRY), stages: [] } })]);
    await plain.say(['~ meet Fenna']);
    await plain.say();
    await plain.say();
    assert.equal(plain.synced.length, 1);
});

test('runtime: a cast dossier made without its picture gets it when Story Block has it; a reader\'s own or removed picture, a dossier a scan made and a second pass are left alone; a swipe keeps it exact', () => {
    const png1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const png2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const mine = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const scenario = async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        const sdk = mockState.sdk;
        const say = async text => {
            mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'And then?' });
            const userId = mockState.context.chat.length - 1;
            await Promise.all((mockState.listeners.get('message_sent') || []).map(fn => fn(userId)));
            mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: text, swipe_id: 0, swipes: [text] });
            const id = mockState.context.chat.length - 1;
            await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
            await Promise.all((mockState.listeners.get('character_message_rendered') || []).map(fn => fn(id)));
            await sleep(150);
            return id;
        };
        const turn = async () => { await sdk.turn({ type: 'normal' }); await sleep(300); };
        const row = (name, extra = {}) => ({ name, present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipReason: '', ...extra });
        const plainFetch = globalThis.fetch;
        const uploads = [];
        globalThis.fetch = async (url, options = {}) => {
            if (url === '/api/files/verify') return { ok: true, status: 200, json: async () => Object.fromEntries(JSON.parse(options.body).urls.map(path => [path, mockState.files.has(path)])) };
            if (url === '/api/files/upload' && JSON.parse(options.body).name.startsWith('npc-state-delta-portrait-')) uploads.push(JSON.parse(options.body).name);
            return plainFetch(url, options);
        };
        const byName = name => api.getState().npcs.find(npc => npc.name === name);
        const shape = name => { const npc = byName(name); return npc ? { has: Boolean(npc.portrait), path: npc.portrait?.path ?? null, dataUrl: Boolean(npc.portrait?.dataUrl), sourceName: npc.portrait?.sourceName ?? null, fingerprint: Boolean(npc.portrait?.appearanceFingerprint), removed: npc.castFrom?.portraitRemoved === true, cast: Boolean(npc.castFrom) } : null; };
        const out = {};

        // Yunyun has a dossier a scan made; the pack lists her too (and will have her picture).
        mockState.quietResponder = async () => JSON.stringify({ npcs: [row('Yunyun', { personality: 'Shy and loud at once.', role: 'sorceress' })] });
        await say('Yunyun waves from the gate.');
        await sleep(300);
        const meet = (name, id) => ({ key: `ersveil:${id}`, pack: 'ersveil', id, name, aliases: [], met: { on: 0, where: 'the gate' }, alive: true, entry: { id, name, about: 'From the pack.', look: `${name} pack look.`, personality: 'Pack personality.', portrait: `${id}.webp`, start: { place: 'gate', goal: 'pack goal' } } });
        sdk.people = [meet('Yunyun', 'yunyun'), meet('Fenna', 'fenna'), meet('Tansy', 'tansy'), meet('Orrin', 'orrin'), meet('Maro', 'maro')];
        // Only Tansy's picture is there at the meeting: the pack was imported without the others.
        sdk.pics = { 'tansy.webp': 'PNG1' };
        const metAt = await say('They are all at the gate.');
        await turn();
        await sleep(300);
        out.afterMeeting = Object.fromEntries(['Yunyun', 'Fenna', 'Tansy', 'Orrin', 'Maro'].map(name => [name, shape(name)]));
        out.uploadsAtMeeting = uploads.length;

        // The reader sets Orrin's own picture and removes Tansy's.
        const state = api.getState();
        const orrin = state.npcs.find(npc => npc.name === 'Orrin');
        orrin.portrait = { dataUrl: 'MINE', mime: 'image/png', sourceName: 'mine.png', updatedAt: 5 };
        state.portraitAssets = { ...state.portraitAssets, [orrin.id]: structuredClone(orrin.portrait) };
        await api.installState(state);
        await sleep(200);
        out.removeTansy = await api.removePortrait(byName('Tansy').id, { chatKey: api.uiStatus().chatKey });
        await sleep(200);

        // Nothing has changed in the pack: a later reply fills nobody (and does not try).
        await say('The gate is quiet.');
        await turn();
        out.beforePictures = Object.fromEntries(['Fenna', 'Orrin', 'Tansy'].map(name => [name, shape(name)]));
        out.uploadsBefore = uploads.length;

        // The pictures are imported into the pack (Story Block now answers), no new chat: the next reply gives them.
        sdk.pics = { 'tansy.webp': 'PNG1', 'fenna.webp': 'PNG2', 'orrin.webp': 'PNG2', 'yunyun.webp': 'PNG2' };
        const fillAt = await say('Fenna nods at the gate.');
        await turn();
        await sleep(300);
        out.afterPictures = Object.fromEntries(['Yunyun', 'Fenna', 'Tansy', 'Orrin', 'Maro'].map(name => [name, shape(name)]));
        out.fillUploads = uploads.slice();
        out.checkpointReasons = (api.getState().checkpoints || []).map(item => item.reason);
        out.sidecarHoldsImage = [...mockState.files.entries()].some(([path, text]) => /\/npc-state-delta-[a-z0-9]+\.json$/.test(path) && text.includes('ChwGA60e6kg') || text.includes('EhQGAhKmMIQ'));
        out.fennaFilled = byName('Fenna').portrait;
        out.countAfterFill = api.getState().npcs.length;

        // A swipe of the very reply the picture was given at leaves it exact: the same record, nothing written again.
        const stamp = JSON.stringify(byName('Fenna').portrait);
        const chat = mockState.context.chat;
        const head = chat.length - 1;
        chat[head] = { is_user: false, is_system: false, name: 'Megumin', swipe_id: 1, mes: 'Fenna looks away.', swipes: [chat[head].mes, 'Fenna looks away.'] };
        mockState.swipeState = 'swiping';
        eventSource.emit('message_swiped', head);
        await sleep(200);
        eventSource.emit('message_received', head);
        await sleep(300);
        mockState.swipeState = 'none';
        await sleep(300);
        await turn();
        out.afterSwipe = { Fenna: shape('Fenna'), Tansy: shape('Tansy'), Orrin: shape('Orrin'), count: api.getState().npcs.length, uploads: uploads.length, same: JSON.stringify(byName('Fenna').portrait) === stamp };

        // Once only: another reply neither reads nor writes anything.
        await say('Nothing happens.');
        await turn();
        out.again = { uploads: uploads.length, same: JSON.stringify(byName('Fenna').portrait) === stamp };

        // Maro's picture is imported while nothing is said: the host's head event (a chat reopened, the head moving) is enough.
        out.maroBefore = shape('Maro');
        sdk.pics = { ...sdk.pics, 'maro.webp': 'PNG1' };
        out.maroStill = shape('Maro');
        await sdk.handlers.head?.({ index: head });
        await sleep(400);
        out.maroAfter = shape('Maro');
        out.uploadsEnd = uploads.length;
        out.fillAt = fillAt; out.metAt = metAt;
        console.log('RESULT ' + JSON.stringify(out));
    };
    const prelude = async () => {
        const sdk = {
            registered: [], people: [], made: {}, handlers: {}, present: [], pics: {},
            registerModule(def) { sdk.registered.push(def); },
            on(name, fn) { sdk.handlers[name] = fn; return () => {}; },
            turn: async turn => { await sdk.handlers.turn?.(turn); },
            command: async type => {
                if (type === 'npc.tick') for (const person of sdk.people) if (person.met && person.entry) sdk.made[person.key] = { name: person.name };
                return { ok: true, receipt: { summary: '' } };
            },
            query: (name, args) => (name === 'director.cast' ? structuredClone(sdk.people)
                : name === 'npc.castMade' ? structuredClone(sdk.made)
                : name === 'packs.list' ? [{ id: 'ersveil', name: 'Ersveil', version: '1.0.0' }]
                : name === 'packs.portrait' ? (args?.pack === 'ersveil' ? ({ PNG1: 'PNG1DATA', PNG2: 'PNG2DATA' }[sdk.pics[args.file]] ?? null) : null)
                : name === 'scene.present' ? [] : null),
            settings: () => ({}),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    };
    const source = scenario.toString().replace("'MINE'", JSON.stringify(mine).replaceAll('"', "'"));
    const preludeSource = prelude.toString().replace("'PNG1DATA'", JSON.stringify(png1)).replace("'PNG2DATA'", JSON.stringify(png2));
    const hosted = scenarioOutput(runHostScenario('cast-portrait-backfill', { toString: () => preludeSource }, { toString: () => source }));
    const none = { has: false, path: null, dataUrl: false, sourceName: null, fingerprint: false, removed: false, cast: true };
    // At the meeting: only the person whose picture was there has it; the others are made without.
    assert.equal(hosted.afterMeeting.Tansy.has, true, 'Tansy was made with her picture');
    assert.deepEqual(hosted.afterMeeting.Fenna, none, 'Fenna was made while her picture was missing');
    assert.deepEqual(hosted.afterMeeting.Maro, none);
    assert.deepEqual(hosted.afterMeeting.Yunyun, { ...none, cast: false }, 'a dossier a scan made is not a cast dossier');
    assert.equal(hosted.uploadsAtMeeting, 1);
    // The reader's own and removed pictures.
    assert.equal(hosted.removeTansy, true);
    assert.deepEqual(hosted.beforePictures.Fenna, none, 'nothing in the pack yet: nothing is filled');
    assert.equal(hosted.uploadsBefore, 1);
    assert.deepEqual(hosted.beforePictures.Tansy, { ...none, removed: true }, 'Tansy\'s removal is recorded');
    // The pictures arrive.
    const fenna = hosted.afterPictures.Fenna;
    assert.match(fenna.path, /^\/user\/files\/npc-state-delta-portrait-[a-f0-9]{40}\.png$/, 'Fenna now has her picture, as a file named by its content');
    assert.deepEqual([fenna.dataUrl, fenna.sourceName, fenna.fingerprint], [false, 'fenna.webp', true]);
    assert.deepEqual(hosted.afterPictures.Maro, none, 'Maro\'s picture is still not in the pack');
    assert.equal(hosted.afterPictures.Orrin.dataUrl, true, 'Orrin keeps the picture the reader set');
    assert.equal(hosted.afterPictures.Orrin.sourceName, 'mine.png');
    assert.equal(hosted.afterPictures.Orrin.path, null);
    assert.deepEqual(hosted.afterPictures.Tansy, { ...none, removed: true }, 'Tansy\'s removed picture is not put back');
    assert.deepEqual(hosted.afterPictures.Yunyun, { ...none, cast: false }, 'Yunyun\'s dossier is not a cast dossier: no picture, though the pack has one for her');
    assert.equal(hosted.fillUploads.length, 2, 'the first picture was written at the meeting; Fenna\'s is the second file');
    assert.equal(hosted.sidecarHoldsImage, false, 'the chat\'s saved state holds none of the pack\'s pictures (the reader\'s own stays as it always was)');
    assert.equal(hosted.countAfterFill, 5, 'no dossier was made or lost');
    assert.ok(hosted.checkpointReasons.includes('cast-portrait'), 'the change is checkpointed at its reply like any dossier change');
    // Once only; a swipe is exact.
    assert.equal(hosted.afterSwipe.Fenna.path, fenna.path, 'a swipe of its reply keeps the picture');
    assert.equal(hosted.afterSwipe.same, true, 'the very same record');
    assert.equal(hosted.afterSwipe.uploads, 2, 'and nothing is written again');
    assert.equal(hosted.afterSwipe.count, 5);
    assert.equal(hosted.afterSwipe.Orrin.dataUrl, true);
    assert.equal(hosted.afterSwipe.Tansy.removed, true, 'the removal is still recorded after the swipe');
    assert.deepEqual(hosted.again, { uploads: 2, same: true }, 'a later reply reads and writes nothing');
    // The head event gives a picture imported later without a reply.
    assert.deepEqual(hosted.maroBefore, none);
    assert.deepEqual(hosted.maroStill, none, 'the pack alone changes nothing until the host says something happened');
    assert.equal(hosted.maroAfter.sourceName, 'maro.webp');
    assert.equal(hosted.maroAfter.has, true);
    assert.equal(hosted.uploadsEnd, 2, 'Maro\'s picture is the first one again: its file already stands');
});

test('index.js wiring: the picture sync is asked for by the adapter, runs when a chat opens, and a removal is recorded (source)', () => {
    const index = runtimeSource();
    assert.match(index, /v2\.startStorySuiteV2\(\{[^}]*castSync, castPortraitDue/, 'the adapter can ask whether there is a picture to give');
    assert.match(index, /commitBranchCheckpoint\(working, messageId, 'cast-portrait'\)/, 'the picture is checkpointed at its reply');
    assert.match(index, /castPortraitDue\(\)\) castSync\(\)/, 'a chat opened gives the picture too');
    assert.match(index, /markCastPortraitRemoved\(npc\)/, 'the reader\'s removal is recorded');
    const adapter = adapterSource();
    assert.match(adapter, /sdk\.on\('head', portraitFill(, \{ module: MODULE \})?\)/, 'and so does the host\'s head event');
    assert.doesNotMatch(adapter, /sdkRef\.command\(['"]director\./, 'Delta never writes to Story Director');
});
