import test from 'node:test';
import assert from 'node:assert/strict';
import { runHostScenario } from './helpers/host-scenario.js';
import { scenarioOutput } from './cast-dossier.helpers.js';

test('runtime: a cast member admitted by the same reply as her first meeting is seeded from the card, not from the narration', () => {
    const scenario = async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        const sdk = mockState.sdk;
        sdk.people = [{ key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', name: 'Fenna', aliases: [], met: { on: 0, where: 'the gate' }, alive: true,
            entry: { id: 'fenna', name: 'Fenna', about: 'Runs the night ferry.', look: 'Tall and weathered, grey eyes, rope-scarred hands.', personality: 'Stubborn and quietly kind.', history: 'Lost her husband to the weir.',
                start: { place: 'Bluewatch docks', goal: 'Find who opened the weir' }, secrets: [{ title: 'The weir', text: 'She saw who opened the gates.', when: 'the party learns of the toll-gang' }] } }];
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'And then?' });
        await Promise.all((mockState.listeners.get('message_sent') || []).map(fn => fn(mockState.context.chat.length - 1)));
        const text = 'Fenna poles the ferry in. Her eyes are green.';
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: text, swipe_id: 0, swipes: [text] });
        const id = mockState.context.chat.length - 1;
        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Fenna', present: true, role: 'boatwoman', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named', directInteraction: true,
            relationshipImpact: 'none', relationshipReason: '', personality: 'Invented: cheerful.', background: 'Invented: a farm girl.', homeBase: 'Invented town', overallAppearance: 'Short, green eyes.' }] });
        await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
        await Promise.all((mockState.listeners.get('character_message_rendered') || []).map(fn => fn(id)));
        await sleep(300);
        await sdk.handlers.turn?.({ type: 'normal' });
        await sleep(300);
        const fenna = api.getState().npcs.filter(npc => npc.name === 'Fenna');
        const one = fenna[0] || {};
        console.log('RESULT ' + JSON.stringify({ count: fenna.length, look: one.overallAppearance, personality: one.personality, background: one.background, homeBase: one.homeBase, cast: Boolean(one.castFrom), secrets: (one.secrets || []).map(item => item.from + ':' + item.text) }));
    };
    const prelude = async () => {
        const sdk = {
            registered: [], people: [], made: {}, handlers: {},
            registerModule(def) { sdk.registered.push(def); },
            on(name, fn) { sdk.handlers[name] = fn; return () => {}; },
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
    const out = scenarioOutput(runHostScenario('cast-dossier-first-admission', prelude, scenario));
    assert.equal(out.count, 1, 'one dossier, not a scan one beside a cast one');
    assert.equal(out.look, 'Tall and weathered, grey eyes, rope-scarred hands.', 'the card\'s look wins over the narration\'s');
    assert.equal(out.personality, 'Stubborn and quietly kind.');
    assert.equal(out.background, 'Lost her husband to the weir.', 'the card\'s background, not an invented one');
    assert.equal(out.homeBase, 'Bluewatch docks', 'the card\'s home base');
    assert.equal(out.cast, true, 'marked as made from the cast');
    assert.deepEqual(out.secrets, ['pack:She saw who opened the gates.'], 'the authored hidden notes, no invented ones');
});

// (ONEPASSCAPR2-2) The other ordering: the host's turn step makes the cast dossier before the reply's scan row arrives; the card's words stay.
test('runtime: the other order (the host\'s turn makes the cast dossier first, then the reply\'s row merges): the card still wins', () => {
    const scenario = async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        const sdk = mockState.sdk;
        sdk.people = [{ key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', name: 'Fenna', aliases: [], met: { on: 0, where: 'the gate' }, alive: true,
            entry: { id: 'fenna', name: 'Fenna', about: 'Runs the night ferry.', look: 'Tall and weathered, grey eyes, rope-scarred hands.', personality: 'Stubborn and quietly kind.', history: 'Lost her husband to the weir.',
                start: { place: 'Bluewatch docks', goal: 'Find who opened the weir' }, secrets: [{ title: 'The weir', text: 'She saw who opened the gates.', when: 'the party learns of the toll-gang' }] } }];
        await sdk.handlers.turn?.({ type: 'normal' });
        await sleep(300);
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'And then?' });
        await Promise.all((mockState.listeners.get('message_sent') || []).map(fn => fn(mockState.context.chat.length - 1)));
        const text = 'Fenna poles the ferry in. Her eyes are green.';
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: text, swipe_id: 0, swipes: [text] });
        const id = mockState.context.chat.length - 1;
        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Fenna', present: true, role: 'boatwoman', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named', directInteraction: true,
            relationshipImpact: 'none', relationshipReason: '', personality: 'Invented: cheerful.', background: 'Invented: a farm girl.', homeBase: 'Invented town', overallAppearance: 'Short, green eyes.' }] });
        await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
        await Promise.all((mockState.listeners.get('character_message_rendered') || []).map(fn => fn(id)));
        await sleep(300);
        const fenna = api.getState().npcs.filter(npc => npc.name === 'Fenna');
        const one = fenna[0] || {};
        console.log('RESULT ' + JSON.stringify({ count: fenna.length, look: one.overallAppearance, personality: one.personality, background: one.background, homeBase: one.homeBase, cast: Boolean(one.castFrom), secrets: (one.secrets || []).map(item => item.from + ':' + item.text) }));
    };
    const prelude = async () => {
        const sdk = {
            registered: [], people: [], made: {}, handlers: {},
            registerModule(def) { sdk.registered.push(def); },
            on(name, fn) { sdk.handlers[name] = fn; return () => {}; },
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
    const out = scenarioOutput(runHostScenario('cast-dossier-turn-first', prelude, scenario));
    assert.equal(out.count, 1, 'one dossier, not a scan one beside a cast one');
    assert.equal(out.look, 'Tall and weathered, grey eyes, rope-scarred hands.', 'the card\'s look wins over the narration\'s');
    assert.equal(out.personality, 'Stubborn and quietly kind.');
    assert.equal(out.background, 'Lost her husband to the weir.', 'the card\'s background, not an invented one');
    assert.equal(out.homeBase, 'Bluewatch docks', 'the card\'s home base');
    assert.equal(out.cast, true, 'marked as made from the cast');
    assert.deepEqual(out.secrets, ['pack:She saw who opened the gates.'], 'the authored hidden notes, no invented ones');
});

// (first meeting) The first reply on which a pack cast member is present with the player gives her ONE "I first met" memory, in either order
// (the reply's scan admits her, or the host's turn step makes her dossier first), hosted (the move fact stays out), placed and dated from the meeting.
const firstMeetingRun = (name, turnFirst, mention = false, castOnly = false) => {
    // The host scenario runs as source text in its own process: the two switches are written into it.
    const scenarioFn = async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        const sdk = mockState.sdk;
        sdk.people = [{ key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', name: 'Fenna', aliases: [], met: { on: 'Day 1', where: 'the gate' }, alive: true,
            entry: { id: 'fenna', name: 'Fenna', about: 'Runs the night ferry.', look: 'Tall and weathered.', start: { place: 'Bluewatch docks', goal: 'Find who opened the weir' } } }];
        if (turnFirst) { await sdk.handlers.turn?.({ type: 'normal' }); await sleep(300); }
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'And then?' });
        await Promise.all((mockState.listeners.get('message_sent') || []).map(fn => fn(mockState.context.chat.length - 1)));
        const text = 'Fenna poles the ferry in.';
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: text, swipe_id: 0, swipes: [text] });
        const id = mockState.context.chat.length - 1;
        mockState.quietResponder = async () => JSON.stringify({ npcs: castOnly ? [] : [{ name: 'Fenna', present: !mention, role: 'boatwoman', location: 'the gate', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named', directInteraction: !mention,
            relationshipImpact: 'none', relationshipReason: '' }] });
        await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
        await Promise.all((mockState.listeners.get('character_message_rendered') || []).map(fn => fn(id)));
        await sleep(300);
        if (!turnFirst) { await sdk.handlers.turn?.({ type: 'normal' }); await sleep(300); }
        const one = api.getState().npcs.find(npc => npc.name === 'Fenna') || {};
        console.log('RESULT ' + JSON.stringify({ found: Boolean(one.name), memories: one.memories || [], stamps: one.memoryStamps || {}, facts: Object.values(one.memoryFacts?.entries || {}).map(entry => entry.k) }));
    };
    const scenario = { toString: () => scenarioFn.toString().replace(/\bturnFirst\b/g, String(turnFirst)).replace(/\bmention\b/g, String(mention)).replace(/\bcastOnly\b/g, String(castOnly)) };
    const prelude = async () => {
        const sdk = {
            registered: [], people: [], made: {}, handlers: {},
            registerModule(def) { sdk.registered.push(def); },
            on(name, fn) { sdk.handlers[name] = fn; return () => {}; },
            command: async type => {
                if (type === 'npc.tick') for (const person of sdk.people) if (person.met && person.entry) sdk.made[person.key] = { name: person.name };
                return { ok: true, receipt: { summary: '' } };
            },
            query: q => (q === 'director.cast' ? structuredClone(sdk.people) : q === 'npc.castMade' ? structuredClone(sdk.made)
                : q === 'packs.list' ? [{ id: 'ersveil', name: 'Ersveil' }] : q === 'scene.present' ? [] : null),
            settings: () => ({}),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    };
    return scenarioOutput(runHostScenario(name, prelude, scenario));
};
test('first meeting: a pack cast member admitted by the reply that meets her gets one "I first met" memory (hosted)', () => {
    const out = firstMeetingRun('first-meeting-admitted', false);
    assert.deepEqual(out.memories.filter(text => /first met/.test(text)), ['I first met Kazuma at the gate.'], 'exactly one, placed from the reply');
    assert.deepEqual(out.facts, ['met']);
});
test('first meeting: the host\'s turn step made the dossier (the scan did not admit her) at the meeting reply: one fact, dated and placed from the meeting', () => {
    const out = firstMeetingRun('first-meeting-cast-only', false, false, true);
    assert.deepEqual(out.memories.filter(text => /first met/.test(text)), ['I first met Kazuma at the gate.']);
    assert.deepEqual(Object.values(out.stamps).map(stamp => stamp.d), ['Day 1'], 'the story date of the meeting');
});
test('first meeting: the turn step before the reply exists, then the reply\'s scan finds her present: still exactly one', () => {
    const out = firstMeetingRun('first-meeting-turn-first', true);
    assert.equal(out.memories.filter(text => /first met/.test(text)).length, 1, 'exactly one');
});
test('first meeting: a cast member only mentioned in the reply (not present) gets none', () => {
    const out = firstMeetingRun('first-meeting-mention', false, true);
    assert.deepEqual((out.memories || []).filter(text => /first met/.test(text)), []);
});
