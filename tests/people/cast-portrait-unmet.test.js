// PORTLINK2: a `+ npc Sister Temiwa` line made her dossier from the pack (castFrom) while Story Director still counted her unmet, so the met list the
// picture step reads did not hold her and she never got the pack's portrait. The picture step now asks for her entry by her own name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runHostScenario } from './helpers/host-scenario.js';
import { scenarioOutput } from './cast-dossier.helpers.js';

test('runtime: a pack person made by a + npc line while unmet gets the pack picture, fill-only, once, and keeps the story\'s own words; a removed picture and a dismissed person stay as they are', () => {
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
        const turn = async () => { await sdk.turn({ type: 'normal' }); await sleep(300); };
        const row = (name, extra = {}) => ({ name, present: true, role: 'healer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipReason: '', ...extra });
        const plainFetch = globalThis.fetch;
        const uploads = [];
        globalThis.fetch = async (url, options = {}) => {
            if (url === '/api/files/verify') return { ok: true, status: 200, json: async () => Object.fromEntries(JSON.parse(options.body).urls.map(path => [path, mockState.files.has(path)])) };
            if (url === '/api/files/upload' && JSON.parse(options.body).name.startsWith('npc-state-delta-portrait-')) uploads.push(JSON.parse(options.body).name);
            return plainFetch(url, options);
        };
        const byName = name => api.getState().npcs.find(npc => npc.name === name);
        const shape = name => { const npc = byName(name); return npc ? { path: npc.portrait?.path ?? null, source: npc.portrait?.sourceName ?? null, role: npc.role, cast: npc.castFrom?.key ?? null } : null; };
        const out = {};
        const entry = (id, name, alias) => ({ id, name, aliases: [alias], about: 'From the pack.', look: `${name} pack look.`, personality: 'Pack personality.', portrait: `${id}.webp`, start: { place: 'gate', goal: 'pack goal' } });
        // Unmet and in the scene: Story Director lists them only for an exact name (director.cast { named }), as the + npc line asks.
        sdk.unmet = [{ key: 'ersveil:temiwa', pack: 'ersveil', id: 'temiwa', name: 'Sister Temiwa', aliases: ['Temiwa'], met: null, alive: true, entry: entry('temiwa', 'Sister Temiwa', 'Temiwa') },
            { key: 'ersveil:torka', pack: 'ersveil', id: 'torka', name: 'Torka', aliases: [], met: null, alive: true, entry: entry('torka', 'Torka', 'T') }];
        sdk.pics = { 'temiwa.webp': 'PNG1', 'torka.webp': 'PNG1' };

        // The story's dossiers for both (as the + npc line makes them in the store), each linked to the pack person at once.
        mockState.quietResponder = async () => JSON.stringify({ npcs: [row('Sister Temiwa', { role: 'Bluewatch healer-sealer' }), row('Torka', { role: 'hunter' })] });
        await say('Sister Temiwa steps in with ash on her boots. Torka waits outside.');
        await turn();
        const state = api.getState();
        const link = (name, id) => { const npc = state.npcs.find(item => item.name === name); npc.castFrom = { key: `ersveil:${id}`, pack: 'ersveil', id, packName: 'Ersveil' }; };
        link('Sister Temiwa', 'temiwa'); link('Torka', 'torka');
        state.userDismissedGroups = [];
        await api.installState(state);
        out.before = { Temiwa: shape('Sister Temiwa'), Torka: shape('Torka'), uploads: uploads.length };

        await say('Sister Temiwa kneels by the sacks.');
        await turn();
        await sleep(300);
        out.after = { Temiwa: shape('Sister Temiwa'), Torka: shape('Torka'), uploads: uploads.length, count: api.getState().npcs.length };
        out.noSidecarImage = ![...mockState.files.entries()].some(([path, text]) => /\/npc-state-delta-[a-z0-9]+\.json$/.test(path) && text.includes('EhQGAhKmMIQ'));
        // The reader removes Torka's picture: nothing puts it back, Temiwa's stays exactly as it was, and nothing is read or written again.
        const stamp = JSON.stringify(byName('Sister Temiwa').portrait);
        out.removed = await api.removePortrait(byName('Torka').id, { chatKey: api.uiStatus().chatKey });
        await sleep(200);
        await say('Nothing else happens.');
        await turn();
        await sleep(300);
        out.again = { uploads: uploads.length, same: JSON.stringify(byName('Sister Temiwa').portrait) === stamp, Torka: shape('Torka') };
        console.log('RESULT ' + JSON.stringify(out));
    };
    const prelude = async () => {
        const sdk = {
            registered: [], unmet: [], handlers: {}, pics: {},
            registerModule(def) { sdk.registered.push(def); },
            on(name, fn) { const was = sdk.handlers[name]; sdk.handlers[name] = async (...args) => { await was?.(...args); return fn(...args); }; return () => {}; },
            turn: async turn => { await sdk.handlers.turn?.(turn); },
            command: async () => ({ ok: true, receipt: { summary: '' } }),
            query: (name, args) => (name === 'director.cast' ? structuredClone(typeof args?.named === 'string' ? sdk.unmet.filter(person => [person.name, ...person.aliases].includes(args.named)) : [])
                : name === 'npc.castMade' ? {}
                : name === 'packs.list' ? [{ id: 'ersveil', name: 'Ersveil', version: '1.0.0' }]
                : name === 'packs.portrait' ? (args?.pack === 'ersveil' && sdk.pics[args.file] ? 'PNG1DATA' : null)
                : name === 'scene.present' ? [] : null),
            settings: () => ({}),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    };
    const hosted = scenarioOutput(runHostScenario('cast-portrait-unmet', { toString: () => prelude.toString().replace("'PNG1DATA'", JSON.stringify(png)) }, { toString: () => scenario.toString() }));
    assert.equal(hosted.before.Temiwa.cast, 'ersveil:temiwa');
    assert.equal(hosted.before.Temiwa.path, null, 'linked, no picture yet');
    assert.match(hosted.after.Temiwa.path, /^\/user\/files\/npc-state-delta-portrait-[a-f0-9]{40}\.png$/, 'Temiwa has the pack picture although Story Director has not counted the meeting');
    assert.equal(hosted.after.Temiwa.source, 'temiwa.webp');
    assert.equal(hosted.after.Temiwa.role, hosted.before.Temiwa.role, 'the story\'s own words are untouched');
    assert.equal(hosted.after.uploads, 1, 'Temiwa and Torka share the one picture file (named by its content)');
    assert.equal(hosted.after.count, hosted.before.uploads + 2, 'no dossier made or lost');
    assert.equal(hosted.noSidecarImage, true);
    assert.equal(hosted.removed, true);
    assert.deepEqual(hosted.again, { uploads: 1, same: true, Torka: { ...hosted.before.Torka } }, 'a removed picture is not put back; once only');
});
