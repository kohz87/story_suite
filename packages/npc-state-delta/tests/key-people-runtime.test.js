import test from 'node:test';
import assert from 'node:assert/strict';
import { runHostScenario } from './helpers/host-scenario.js';
import { scenarioOutput } from './key-people.helpers.js';

test('runtime: the Key tag on the card, the badge data, the summary once at the return, the scan hold; Delta alone has none of it', () => {
    const scenario = async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        // A turn in two halves: the player's message (the prompt for the generation is built then), and the reply
        // (Story Director's state for it is set `between`, as its capture does when the reply arrives).
        const send = async () => {
            mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'And then?' });
            const userId = mockState.context.chat.length - 1;
            await Promise.all((mockState.listeners.get('message_sent') || []).map(fn => fn(userId)));
        };
        const receive = async text => {
            mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: text, swipe_id: 0, swipes: [text] });
            const id = mockState.context.chat.length - 1;
            await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
            await Promise.all((mockState.listeners.get('character_message_rendered') || []).map(fn => fn(id)));
            await sleep(150);
            return id;
        };
        const turn = async (text, between = () => {}) => { await send(); await between(); return receive(text); };
        const row = (name, extra = {}) => ({ name, present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 }, ...extra });
        mockState.quietResponder = async () => JSON.stringify({ npcs: [row('Yunyun')] });
        await turn('Yunyun waves from the gate.');
        await sleep(200);
        const yunyun = () => api.getState().npcs.find(npc => npc.name === 'Yunyun');
        // Story Director's dates are story minutes (Goldwane 12 is day 11 of a 30-day month).
        const away = { doing: 'scouting the north road', since: 11 * 1440, back: 17 * 1440, steps: [{ date: 13 * 1440, text: 'reached Wolfmere Outpost' }] };
        const out = {};

        out.cardPlain = api.presentCastHtml();
        out.viewsPlain = api.getDossierState().keyViews ?? null;
        mockState.sdk.keys = [{ name: 'Yunyun', here: true, away: null }];
        out.cardKey = api.presentCastHtml();
        out.viewsKey = api.getDossierState().keyViews;

        // Not away: the same scan writes her background (so the hold below is what stops it).
        mockState.quietResponder = async () => JSON.stringify({ npcs: [row('Yunyun', { id: yunyun().id, background: 'Grew up on the docks of Axel.', backgroundState: 'update', backgroundReason: 'she told the story of her childhood' })] });
        await turn('Yunyun tells the story of her childhood on the docks of Axel.');
        await sleep(300);
        out.backgroundHere = yunyun().background ?? '';

        // Away: a scan that would rewrite it changes nothing.
        mockState.sdk.keys = [{ name: 'Yunyun', here: false, away }];
        out.viewsAway = api.getDossierState().keyViews;
        const rewrite = text => async () => JSON.stringify({ npcs: [row('Yunyun', { id: yunyun().id, background: text, backgroundState: 'update', backgroundReason: 'she told a different story of her childhood' })] });
        mockState.quietResponder = rewrite('Born in the mountains of Vale.');
        await turn('Yunyun says she was born in the mountains of Vale, not on the docks.');
        await sleep(300);
        out.backgroundAway = yunyun().background ?? '';
        out.injectionAway = api.injectionPreview().text;
        // The reader's own "Scan now" is deliberate: the same answer is written this time (only the automatic scan holds them).
        await api.scan();
        await sleep(300);
        out.backgroundManual = yunyun().background ?? '';

        // Back: the reply that brings her back; the next generation is told once, and not the one after.
        mockState.quietResponder = async () => JSON.stringify({ npcs: [row('Yunyun')] });
        // (What the host's per-reply step writes into the slice at the reply that brings her back.)
        await turn('Yunyun walks back through the gate, dusty and tired.', () => {
            mockState.sdk.keys = [{ name: 'Yunyun', here: true, away: null }];
            mockState.sdk.memory = { yunyun: { name: 'Yunyun', aliases: [], returnedAt: mockState.context.chat.length, presentReplies: 0,
                away: { doing: 'scouting the north road', since: 'Goldwane 12', back: 'Goldwane 18', steps: [{ date: 'Goldwane 14', text: 'reached Wolfmere Outpost' }] } } };
        });
        await sleep(300);
        out.injectionBack = api.injectionPreview().text;
        out.viewsBack = api.getDossierState().keyViews;
        await send();
        out.injectionNext = api.injectionPreview().text;
        await receive('Yunyun sits by the fire.');
        await sleep(300);
        out.injectionLater = api.injectionPreview().text;
        out.viewsLater = api.getDossierState().keyViews;
        // Present again: scans resume.
        mockState.quietResponder = rewrite('Raised in the lighthouse at Axel.');
        await turn('Yunyun says she was raised in the lighthouse at Axel after all.');
        await sleep(300);
        out.backgroundBack = yunyun().background ?? '';
        console.log('RESULT ' + JSON.stringify(out));
    };
    const prelude = async () => {
        const sdk = {
            registered: [], keys: [], memory: {},
            registerModule(def) { sdk.registered.push(def); },
            command: async () => ({ ok: true, receipt: { summary: '' } }),
            query: name => (name === 'director.keyPeople' ? structuredClone(sdk.keys)
                : name === 'npc.keyAway' ? structuredClone(sdk.memory)
                : (name === 'director.calendar' ? { era: 'CY', months: [{ name: 'Goldwane', days: 30 }, { name: 'Bluewatch', days: 30 }], leapYears: false }
                    : (name === 'scene.present' ? ['Yunyun'] : null))),
            settings: () => ({}),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    };
    const hosted = scenarioOutput(runHostScenario('key-people-hosted', prelude, scenario));
    assert.doesNotMatch(hosted.cardPlain, /key-tag/, 'an empty answer: no tag');
    assert.equal(hosted.viewsPlain, null, 'and no key data');
    assert.match(hosted.cardKey, /<span class="npc-state-delta-key-tag" title="Key person \(Story Director\)">★ Key<\/span>/);
    assert.equal(hosted.viewsKey.npc_yunyun === undefined ? Object.values(hosted.viewsKey)[0].name : hosted.viewsKey.npc_yunyun.name, 'Yunyun');
    assert.equal(Object.values(hosted.viewsAway)[0].away.doing, 'scouting the north road');
    assert.deepEqual([Object.values(hosted.viewsAway)[0].away.since, Object.values(hosted.viewsAway)[0].away.back], ['Goldwane 12', 'Goldwane 18'], 'the dates are written on the calendar, not shown as minutes');
    assert.match(hosted.backgroundHere, /docks of Axel/, 'the same scan writes her background when she is here');
    assert.equal(hosted.backgroundAway, hosted.backgroundHere, 'and does not while she is away');
    assert.match(hosted.backgroundManual, /mountains of Vale/, 'but the reader\'s own Scan now writes it');
    assert.match(hosted.backgroundBack, /lighthouse at Axel/, 'scans resume when she is present again');
    assert.doesNotMatch(hosted.injectionAway, /WHILE AWAY/, 'nothing about the absence is sent while she is away');
    assert.match(hosted.injectionBack, /Yunyun: IDENTITY[^\n]*; WHILE AWAY, NOW BACK \(Goldwane 12 – Goldwane 18\): scouting the north road; Goldwane 14: reached Wolfmere Outpost/);
    assert.equal(hosted.injectionBack.split('WHILE AWAY').length - 1, 1, 'once');
    assert.equal(hosted.injectionNext, hosted.injectionBack, 'the generation that follows is told too (a swipe of it repeats it)');
    assert.equal(Object.values(hosted.viewsBack)[0].recent.away.doing, 'scouting the north road', 'the dossier still shows the absence');
    assert.doesNotMatch(hosted.injectionLater, /WHILE AWAY/, 'one reply later it is not sent again');
    assert.equal(Object.values(hosted.viewsLater)[0].recent.justReturned, false, 'but the dossier still shows the absence for a few replies');

    // The same turns with a Story Director that has no such query (and Delta alone): nothing of it anywhere.
    const alone = scenarioOutput(runHostScenario('key-people-none', async () => {
        const sdk = { registered: [], registerModule(def) { sdk.registered.push(def); }, command: async () => ({ ok: true }), query: name => (name === 'scene.present' ? ['Yunyun'] : null), settings: () => ({}) };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    }, async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] });
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'Yunyun waves from the gate.', swipe_id: 0, swipes: ['Yunyun waves from the gate.'] });
        const id = mockState.context.chat.length - 1;
        await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
        await Promise.all((mockState.listeners.get('character_message_rendered') || []).map(fn => fn(id)));
        await sleep(400);
        console.log('RESULT ' + JSON.stringify({ card: api.presentCastHtml(), views: api.getDossierState().keyViews ?? null, keyAway: api.getState().keyAway ?? null }));
    }));
    assert.doesNotMatch(alone.card, /key-tag/);
    assert.equal(alone.views, null);
    assert.equal(alone.keyAway, null, 'nothing is added to the saved state');
});

test('runtime: a swipe or regenerate of the first reply after a return is told the summary again (the chat still holds the swiped reply); the next new reply is not', () => {
    const prelude = async () => {
        mockState.context.eventTypes.GENERATION_AFTER_COMMANDS = 'generation_after_commands';
        const sdk = {
            registered: [], keys: [{ name: 'Yunyun', here: true, away: null }], memory: {},
            registerModule(def) { sdk.registered.push(def); },
            command: async () => ({ ok: true, receipt: { summary: '' } }),
            query: name => (name === 'director.keyPeople' ? structuredClone(sdk.keys) : name === 'npc.keyAway' ? structuredClone(sdk.memory) : (name === 'scene.present' ? ['Yunyun'] : null)),
            settings: () => ({}),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    };
    const scenario = async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        const emit = async (name, ...args) => { for (const listener of mockState.listeners.get(name) || []) await listener(...args); };
        const chat = mockState.context.chat;
        const userSays = async () => { chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'And then?' }); await emit('message_sent', chat.length - 1); };
        const replyArrives = async (text, id) => { await emit('message_received', id); await emit('character_message_rendered', id); await sleep(200); };
        const note = () => api.injectionPreview().text.split('WHILE AWAY').length - 1;
        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] });
        const reply = async text => {
            await userSays();
            await emit('generation_after_commands', 'normal', {}, false);
            chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: text, swipe_id: 0, swipes: [text] });
            const id = chat.length - 1;
            await replyArrives(text, id);
            return id;
        };
        await reply('Yunyun waves from the gate.');
        // Reply A brings her back: the host's step wrote the memory at A (the index of the reply it ran for).
        const A = chat.length + 1;
        mockState.sdk.memory = { yunyun: { name: 'Yunyun', aliases: [], returnedAt: A, presentReplies: 0, away: { doing: 'scouting', since: 'Goldwane 12', back: 'Goldwane 18', steps: [] } } };
        assert.equal(await reply('Yunyun walks back through the gate.'), A);
        const out = { afterA: note() };

        // The next generation (reply B) is told.
        await userSays();
        await emit('generation_after_commands', 'normal', {}, false);
        out.promptB = note();
        chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'Yunyun sits by the fire.', swipe_id: 0, swipes: ['Yunyun sits by the fire.'] });
        const B = chat.length - 1;
        await replyArrives('', B);
        out.afterB = note();

        // A swipe of B: the chat still holds B while the new one is written, and it is told again.
        await emit('generation_after_commands', 'swipe', {}, false);
        out.promptSwipe = note();
        chat[B].swipes.push('Yunyun stirs the fire.'); chat[B].swipe_id = 1; chat[B].mes = 'Yunyun stirs the fire.';
        await replyArrives('', B);
        out.afterSwipe = note();
        // A regenerate that ST has already removed B for: the latest reply is A again, and it is told.
        const removed = chat.pop();
        await emit('generation_after_commands', 'regenerate', {}, false);
        out.promptRegenerate = note();
        removed.mes = 'Yunyun pokes the fire.'; removed.swipes = [removed.mes]; removed.swipe_id = 0;
        chat.push(removed);
        await replyArrives('', B);
        out.afterRegenerate = note();
        // The next new reply (C) is not told.
        await userSays();
        await emit('generation_after_commands', 'normal', {}, false);
        out.promptC = note();
        console.log('RESULT ' + JSON.stringify(out));
    };
    const out = scenarioOutput(runHostScenario('key-people-swipe', prelude, scenario));
    assert.deepEqual(out, { afterA: 1, promptB: 1, afterB: 0, promptSwipe: 1, afterSwipe: 0, promptRegenerate: 1, afterRegenerate: 0, promptC: 0 });
    assert.equal(out.promptB, 1, 'the first generation after the return is told');
    assert.equal(out.promptSwipe, 1, 'a swipe of that reply is told again');
    assert.equal(out.promptRegenerate, 1, 'and so is a regenerate of it');
    assert.equal(out.afterB + out.afterSwipe + out.afterRegenerate, 0, 'once a reply is written the note is not carried on');
    assert.equal(out.promptC, 0, 'the next new reply is not told');
});
