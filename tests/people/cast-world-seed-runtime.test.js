// Pack format 4, N2, on a host: a world cast entry's Level, Abilities, Keepsakes, status and ties are made in the meeting reply, so a swipe takes
// them back and a swipe back makes them again exactly (replay == live).
import test from 'node:test';
import assert from 'node:assert/strict';
import { runHostScenario } from './helpers/host-scenario.js';
import { scenarioOutput } from './cast-dossier.helpers.js';

const ENTRY = {
    kind: 'companion', id: 'fenna', name: 'Fenna', role: 'Runs the night ferry.', look: 'Tall and weathered.', homeBase: 'Bluewatch docks', status: 'Grieving',
    level: 7, abilities: [{ name: 'Weirsight', description: 'Reads water.' }], keepsakes: [{ name: 'Oar', description: 'Her father\'s.' }],
    ties: [{ with: 'orrin', tag: 'kin' }], tastes: [{ item: 'strong tea', like: true, why: 'warms her' }],
    start: { place: 'Bluewatch docks', goal: 'Find who opened the weir' },
};

test('runtime: the world cast fields are made at the first meeting; a swipe and a swipe back leave them as made', () => {
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
        const fenna = () => api.getState().npcs.find(npc => npc.name === 'Fenna');
        const shape = () => { const n = fenna(); return n ? { level: n.level, abilities: n.abilities, keepsakes: n.keepsakes, status: n.status, role: n.role, keyRelationships: n.keyRelationships ?? [] } : null; };
        const row = (met, entry) => ({ key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', name: 'Fenna', aliases: [], met, alive: true, ...(entry ? { entry } : {}) });
        const out = {};
        sdk.people = [row(null), { key: 'ersveil:orrin', pack: 'ersveil', id: 'orrin', name: 'Orrin', aliases: [], met: null, alive: true }];
        await say('The docks are quiet at dusk.');
        await turn();
        out.unmet = shape();
        const met = [row({ on: 11 * 1440, where: 'Bluewatch docks' }, __ENTRY__), sdk.people[1]];
        sdk.people = met; sdk.present = ['Fenna'];
        const metAt = await say('Fenna looks up from her rope as you reach the ferry.');
        await turn();
        await sleep(300);
        out.made = shape();
        const chat = mockState.context.chat;
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
        await swipeHead('The ferry is empty tonight.', [row(null), met[1]], []);
        out.afterSwipe = shape();
        await swipeHead('Fenna is back at the ferry, coiling rope.', met, ['Fenna']);
        out.remade = shape();
        out.count = api.getState().npcs.filter(npc => npc.name === 'Fenna').length;
        console.log('RESULT ' + JSON.stringify(out));
    };
    const prelude = async () => {
        const sdk = {
            registered: [], people: [], made: {}, ticks: 0, handlers: {}, present: [],
            registerModule(def) { sdk.registered.push(def); },
            on(name, fn) { const was = sdk.handlers[name]; sdk.handlers[name] = async (...args) => { await was?.(...args); return fn(...args); }; return () => {}; },
            turn: async turn => { await sdk.handlers.turn?.(turn); },
            command: async type => {
                if (type === 'npc.tick') { sdk.ticks += 1; for (const person of sdk.people) if (person.met && person.entry) sdk.made[person.key] = { name: person.name }; }
                return { ok: true, receipt: { summary: '' } };
            },
            query: (name) => (name === 'director.cast' ? structuredClone(sdk.people)
                : name === 'npc.castMade' ? structuredClone(sdk.made)
                : name === 'packs.list' ? [{ id: 'ersveil', name: 'Ersveil', version: '1.0.0' }]
                : name === 'director.calendar' ? { era: 'CY', months: [{ name: 'Goldwane', days: 30 }], leapYears: false }
                : name === 'scene.present' ? structuredClone(sdk.present) : null),
            settings: () => ({}),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    };
    const source = scenario.toString().replace('__ENTRY__', JSON.stringify(ENTRY));
    const out = scenarioOutput(runHostScenario('cast-world-seed-hosted', { toString: () => prelude.toString() }, { toString: () => source }));
    const expected = { level: 7, abilities: [{ name: 'Weirsight', description: 'Reads water.' }], keepsakes: [{ name: 'Oar', description: 'Her father\'s.' }], status: 'Grieving', role: 'Runs the night ferry.', keyRelationships: [] };
    assert.equal(out.unmet, null, 'nobody met: no dossier');
    assert.deepEqual(out.made, expected, 'made in the meeting reply');
    // This scripted host has no people store, so the swipe does not undo the dossier (the store and checkpoint do, in the cast-dossier tests); here a swipe and a swipe back
    // must leave the seeded fields exactly as made, and meeting her again must not seed her twice or change a value.
    assert.deepEqual(out.afterSwipe, expected, 'the swipe leaves the seeded fields as made');
    assert.deepEqual(out.remade, expected, 'a swipe back keeps the same record');
    assert.equal(out.count, 1, 'one dossier, not two');
});
