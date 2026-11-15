import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runHostScenario } from './helpers/host-scenario.js';
import { FENNA_ENTRY, scenarioOutput } from './cast-dossier.helpers.js';

test('runtime: the dossier is made at the first meeting from the pack entry, with portrait and badge; swipe undoes it; delete is final; a standing dossier is left alone', () => {
    const entry = { ...FENNA_ENTRY, wears: 'A sou\'wester hat and a coil of rope over one shoulder.' };
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
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
        const turn = async () => { await sdk.turn({ type: 'normal' }); await sleep(250); };
        mockState.quietResponder = async () => JSON.stringify({ npcs: [] });
        const out = {};
        const fenna = () => api.getState().npcs.find(npc => npc.name === 'Fenna');
        // SillyTavern's file routes the way the server answers them: verify says what exists (so a present file is not written again).
        const plainFetch = globalThis.fetch;
        let portraitUploads = 0;
        globalThis.fetch = async (url, options = {}) => {
            if (url === '/api/files/verify') return { ok: true, status: 200, json: async () => Object.fromEntries(JSON.parse(options.body).urls.map(path => [path, mockState.files.has(path)])) };
            if (url === '/api/files/upload' && JSON.parse(options.body).name.startsWith('npc-state-delta-portrait-')) portraitUploads += 1;
            return plainFetch(url, options);
        };

        // Nobody met: Story Director lists her unmet (no entry).
        sdk.people = [{ key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', name: 'Fenna', aliases: [], met: null, alive: true }];
        await say('The docks are quiet at dusk.');
        await turn();
        out.unmet = { npcs: api.getState().npcs.length, ticks: sdk.ticks };

        // The first meeting: the step records it, then the dossier is made at once.
        sdk.people = [{ key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', name: 'Fenna', aliases: [], met: { on: 11 * 1440, where: 'Bluewatch docks' }, where: 'Bluewatch docks', doing: 'running the ferry', lastHeard: { text: 'took the ferry upriver to Ashford', on: 14 * 1440 }, alive: true, entry: __ENTRY__ }];
        sdk.present = ['Fenna'];
        const metAt = await say('Fenna looks up from her rope as you reach the ferry.');
        await turn();
        await sleep(300);
        const made = fenna();
        out.made = made ? {
            role: made.role, appearance: made.appearance, overallAppearance: made.overallAppearance, speech: made.speech, personality: made.personality, background: made.background,
            homeBase: made.homeBase, goal: made.goal, location: made.location, aliases: made.aliases, customFields: made.customFields,
            trust: made.relationship.trust, meterSetup: made.meterSetup, secrets: made.secrets.length, portrait: made.portrait ?? null, files: [...mockState.files.keys()].filter(path => path.includes('npc-state-delta-portrait-')),
            fingerprint: Boolean(made.portrait?.appearanceFingerprint), castFrom: made.castFrom, assets: Boolean(api.getState().portraitAssets?.[made.id]),
        } : null;
        out.count = api.getState().npcs.length;
        out.view = api.getDossierState().castViews?.[made?.id] ?? null;
        out.injection = api.injectionPreview().text;
        await turn();
        await sleep(200);
        out.again = api.getState().npcs.length;

        // A swipe of the reply she was made at (the head reply) takes the dossier back with it; Story Director's meeting is undone too.
        const chat = mockState.context.chat;
        const people = sdk.people;
        const swipeHead = async (text, list, present) => {
            chat[metAt] = { is_user: false, is_system: false, name: 'Megumin', swipe_id: (chat[metAt].swipe_id || 0) + 1, mes: text, swipes: [...(chat[metAt].swipes || []), text] };
            sdk.people = list; sdk.present = present;
            if (!list.some(person => person.met)) sdk.made = {};
            mockState.swipeState = 'swiping';
            eventSource.emit('message_swiped', metAt);
            await sleep(200);
            eventSource.emit('message_received', metAt);
            await sleep(300);
            mockState.swipeState = 'none';
            await sleep(300);
            await turn();
        };
        await swipeHead('The ferry is empty tonight.', [{ key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', name: 'Fenna', aliases: [], met: null, alive: true }], []);
        out.afterSwipe = api.getState().npcs.filter(npc => npc.name === 'Fenna').length;
        // Met again on the new swipe: the dossier is made again.
        await swipeHead('Fenna is back at the ferry, coiling rope.', people, ['Fenna']);
        out.remade = api.getState().npcs.filter(npc => npc.name === 'Fenna').length;

        // A later scan adds to the dossier as for anyone: a keep row leaves what the pack gave.
        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Fenna', present: true, role: 'ferrywoman', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipReason: '' }] });
        await say('Fenna hands you a rope. "Hold this," she says.');
        await sleep(300);
        out.afterScan = { personality: fenna().personality, speech: fenna().speech, castFrom: Boolean(fenna().castFrom) };
        // The picture was written once, through the swipe and the second meeting; the chat's saved state never held it.
        out.portraitUploads = portraitUploads;
        out.portraitFiles = [...mockState.files.keys()].filter(path => path.includes('npc-state-delta-portrait-')).length;
        const sidecars = [...mockState.files.entries()].filter(([path]) => /\/npc-state-delta-[a-z0-9]+\.json$/.test(path));
        out.sidecarHoldsImage = sidecars.some(([, text]) => text.includes('data:image'));
        out.sidecarsSaved = sidecars.length;
        out.remadePortrait = fenna()?.portrait ?? null;
        console.log('RESULT ' + JSON.stringify(out));
    };
    const prelude = async () => {
        const sdk = {
            registered: [], people: [], made: {}, ticks: 0, handlers: {}, present: [],
            registerModule(def) { sdk.registered.push(def); },
            on(name, fn) { sdk.handlers[name] = fn; return () => {}; },
            turn: async turn => { await sdk.handlers.turn?.(turn); },
            command: async type => {
                if (type === 'npc.tick') {
                    sdk.ticks += 1;
                    for (const person of sdk.people) if (person.met && person.entry) sdk.made[person.key] = { name: person.name };
                }
                return { ok: true, receipt: { summary: '' } };
            },
            query: (name, args) => (name === 'director.cast' ? structuredClone(sdk.people)
                : name === 'npc.castMade' ? structuredClone(sdk.made)
                : name === 'packs.list' ? [{ id: 'ersveil', name: 'Ersveil', version: '1.0.0' }]
                : name === 'packs.portrait' ? (args?.pack === 'ersveil' && args?.file === 'fenna.webp' ? 'PORTRAIT' : null)
                : name === 'director.calendar' ? { era: 'CY', months: [{ name: 'Goldwane', days: 30 }], leapYears: false }
                : name === 'scene.present' ? structuredClone(sdk.present) : null),
            settings: () => ({}),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    };
    // The scenario runs in a child process: the entry and the portrait are written into its source.
    const source = scenario.toString().replace('__ENTRY__', JSON.stringify(entry));
    const preludeSource = prelude.toString().replace("'PORTRAIT'", JSON.stringify(png));
    const hosted = scenarioOutput(runHostScenario('cast-dossier-hosted', { toString: () => preludeSource }, { toString: () => source }));
    assert.equal(hosted.unmet.npcs, 0, 'nobody met: no dossier');
    assert.equal(hosted.count, 1, 'one dossier at the first meeting, without a scan');
    assert.equal(hosted.made.role, 'Runs the night ferry at Bluewatch docks.');
    // The host path (production runtime): look → physical, wears → current, each in the pack's exact words.
    assert.equal(hosted.made.overallAppearance, FENNA_ENTRY.look);
    assert.equal(hosted.made.appearance, `${FENNA_ENTRY.look.replace(/\.$/, '')}; ${entry.wears}`, 'the resolved appearance: body, then the outfit once');
    assert.deepEqual([hosted.made.castFrom.first.overallAppearance, hosted.made.castFrom.first.appearance], [FENNA_ENTRY.look, entry.wears]);
    assert.equal(hosted.made.speech, FENNA_ENTRY.voice);
    assert.equal(hosted.made.personality, FENNA_ENTRY.personality);
    assert.equal(hosted.made.background, FENNA_ENTRY.history);
    assert.equal(hosted.made.goal, 'Find out who opened the weir');
    assert.equal(hosted.made.location, 'Bluewatch docks');
    assert.equal(hosted.made.trust, 10);
    assert.equal(hosted.made.secrets, 2);
    assert.deepEqual(hosted.made.customFields, { Allegiance: 'Ferry guild' });
    // The pack's portrait is saved once as its own user file named by its content; the dossier keeps only the record that names it (no data URL).
    const bytes = Buffer.from(png.split(',')[1], 'base64');
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.deepEqual(hosted.made.files, [`/user/files/npc-state-delta-portrait-${hash.slice(0, 40)}.png`], 'the picture is one user file named by its content');
    assert.equal(hosted.made.portrait.path, hosted.made.files[0]);
    assert.equal(hosted.made.portrait.hash, hash);
    assert.equal(hosted.made.portrait.type, 'image/png');
    assert.equal(hosted.made.portrait.dataUrl, undefined, 'no picture in the dossier');
    assert.equal(hosted.made.portrait.sourceName, 'fenna.webp');
    assert.equal(hosted.made.fingerprint, true);
    assert.equal(hosted.made.assets, false, 'and no second copy in the chat\'s portrait assets');
    assert.equal(hosted.portraitUploads, 1, 'the picture is written once: not again for the swipe, the second meeting or a scan');
    assert.equal(hosted.portraitFiles, 1);
    assert.equal(hosted.sidecarsSaved, 1);
    assert.equal(hosted.sidecarHoldsImage, false, 'the chat\'s saved state holds no picture');
    assert.equal(hosted.remadePortrait.path, hosted.made.portrait.path, 'met again after the swipe: the same file');
    assert.equal(hosted.made.castFrom.packName, 'Ersveil');
    assert.equal(hosted.made.castFrom.met.on, 'Goldwane 12', 'the meeting date is written on Story Director\'s calendar');
    assert.equal(hosted.view.badge, 'Ersveil cast');
    assert.equal(hosted.view.lastHeard.text, 'took the ferry upriver to Ashford');
    assert.match(hosted.injection, /oilskin coat/, 'the narrator hears the look at once');
    assert.equal(hosted.again, 1, 'a later step does not make it twice');
    assert.equal(hosted.afterScan.personality, FENNA_ENTRY.personality, 'a later scan leaves what the pack gave unless the story says otherwise');
    assert.equal(hosted.afterScan.speech, FENNA_ENTRY.voice);
    assert.equal(hosted.afterScan.castFrom, true);
    assert.equal(hosted.afterSwipe, 0, 'a swipe of the reply she was made at takes her back');
    assert.equal(hosted.remade, 1, 'and she is made again when the new swipe meets her');
});

test('runtime: removing the cast dossier is final; a dossier a scan made earlier is not replaced; Delta alone makes none', () => {
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
        const out = {};
        // Yunyun already has a dossier (a scan made it); Fenna is the cast person.
        mockState.quietResponder = async () => JSON.stringify({ npcs: [row('Yunyun', { personality: 'Shy and loud at once.', role: 'sorceress' })] });
        await say('Yunyun waves from the gate.');
        await sleep(300);
        const meet = (name, key) => ({ key, pack: 'ersveil', id: key.split(':')[1], name, aliases: [], met: { on: 0, where: 'the gate' }, alive: true, entry: { id: key.split(':')[1], name, about: 'From the pack.', look: 'Pack look.', personality: 'Pack personality.', start: { place: 'gate', goal: 'pack goal' } } });
        sdk.people = [meet('Yunyun', 'ersveil:yunyun'), meet('Fenna', 'ersveil:fenna')];
        await say('Both are at the gate.');
        await turn();
        await sleep(300);
        const names = () => api.getState().npcs.map(npc => npc.name).sort();
        out.first = { names: names(), yunyun: api.getState().npcs.find(npc => npc.name === 'Yunyun').personality, yunyunCast: Boolean(api.getState().npcs.find(npc => npc.name === 'Yunyun').castFrom), fennaCast: Boolean(api.getState().npcs.find(npc => npc.name === 'Fenna')?.castFrom) };
        out.views = Object.keys(api.getDossierState().castViews ?? {});

        // The reader removes Fenna: she is not made again at the next step.
        const fennaId = api.getState().npcs.find(npc => npc.name === 'Fenna').id;
        await api.deleteNpc(fennaId);
        await sleep(200);
        await turn();
        await sleep(300);
        out.afterDelete = names();
        console.log('RESULT ' + JSON.stringify(out));
    };
    const prelude = async () => {
        const sdk = {
            registered: [], people: [], made: {}, handlers: {},
            registerModule(def) { sdk.registered.push(def); },
            on(name, fn) { sdk.handlers[name] = fn; return () => {}; },
            turn: async turn => { await sdk.handlers.turn?.(turn); },
            command: async type => {
                if (type === 'npc.tick') for (const person of sdk.people) if (person.met && person.entry) sdk.made[person.key] = { name: person.name };
                return { ok: true, receipt: { summary: '' } };
            },
            query: name => (name === 'director.cast' ? structuredClone(sdk.people) : name === 'npc.castMade' ? structuredClone(sdk.made)
                : name === 'packs.list' ? [{ id: 'ersveil', name: 'Ersveil' }] : name === 'scene.present' ? [] : null),
            settings: () => ({}),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    };
    const hosted = scenarioOutput(runHostScenario('cast-dossier-standing', prelude, scenario));
    assert.deepEqual(hosted.first.names, ['Fenna', 'Yunyun'], 'one new dossier: the standing one is not made again');
    assert.equal(hosted.first.yunyun, 'Shy and loud at once.', 'a dossier that was already there keeps its words (the pack never overwrites a dossier)');
    assert.equal(hosted.first.yunyunCast, false);
    assert.equal(hosted.first.fennaCast, true);
    assert.equal(hosted.views.length, 1);
    assert.deepEqual(hosted.afterDelete, ['Yunyun'], 'removed by the reader: not made again');

    const alone = scenarioOutput(runHostScenario('cast-dossier-none', async () => {
        const sdk = { registered: [], handlers: {}, registerModule(def) { sdk.registered.push(def); }, on(name, fn) { sdk.handlers[name] = fn; return () => {}; }, command: async () => ({ ok: true }), query: name => (name === 'scene.present' ? [] : null), settings: () => ({}) };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    }, async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'Nobody here.', swipe_id: 0, swipes: ['Nobody here.'] });
        const id = mockState.context.chat.length - 1;
        await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
        await mockState.sdk.handlers.turn?.({ type: 'normal' });
        await sleep(300);
        console.log('RESULT ' + JSON.stringify({ npcs: api.getState().npcs.length, views: api.getDossierState().castViews ?? null }));
    }));
    assert.equal(alone.npcs, 0);
    assert.equal(alone.views, null);
});
