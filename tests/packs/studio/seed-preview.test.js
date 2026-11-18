// "What NPC State seeds" (studio/model/seed-preview.js): the preview equals what a whole host makes at the first meeting, loads with no
// settings and no host globals (also in a real browser page), is pure (same entry, same answer; the entry is not touched), and follows an edited entry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { previewSeed } from '../../../studio/model/seed-preview.js';
import { runHostScenario } from '../../people/helpers/host-scenario.js';
import { scenarioOutput } from '../../people/cast-dossier.helpers.js';

const ENTRY = {
    kind: 'companion', id: 'fenna', name: 'Fenna', role: 'Runs the night ferry.', species: 'Elf', look: 'Tall and weathered.', homeBase: 'Bluewatch docks', status: 'Grieving',
    level: 7, abilities: [{ name: 'Weirsight', description: 'Reads water.' }], keepsakes: [{ name: 'Oar', description: 'Her father\'s.' }],
    ties: [{ with: 'orrin', tag: 'kin' }], keyRelationships: [{ id: 'orrin', text: 'her late husband\'s brother' }],
    meters: { preset: 'companion', trust: 10 }, secrets: [{ title: 'The weir', text: 'She saw who opened it.' }],
    start: { place: 'docks', goal: 'Find who opened the weir' },
};
const CAST = [{ id: 'orrin', name: 'Orrin' }];
const value = (preview, field) => preview.fields.find(row => row.field === field)?.value;

test('the preview loads and runs with no host globals and no settings', async () => {
    assert.equal(typeof globalThis.window, 'undefined');
    const preview = previewSeed(ENTRY, { cast: CAST, placeName: id => `The ${id}` });
    assert.equal(preview.ok, true);
    assert.equal(value(preview, 'location'), 'The docks', 'the starting place, by name, never by id');
    assert.equal(value(preview, 'level'), 7);
    assert.deepEqual(value(preview, 'keyRelationships'), ['Orrin — her late husband\'s brother'], 'a person in the cast is named by name');
    assert.deepEqual(previewSeed({ id: 'x', name: '' }), { ok: false });
});

test('the preview is pure and follows an edited entry: grown, then shrunk', () => {
    const before = structuredClone(ENTRY);
    const first = previewSeed(ENTRY, { cast: CAST });
    assert.deepEqual(previewSeed(ENTRY, { cast: CAST }).fields, first.fields);
    assert.deepEqual(ENTRY, before, 'the author\'s entry is not touched');
    const grown = previewSeed({ ...ENTRY, abilities: [...ENTRY.abilities, { name: 'Tidecall', description: 'Calls the tide.' }] }, { cast: CAST });
    assert.deepEqual(value(grown, 'abilities').map(row => row.name), ['Weirsight', 'Tidecall']);
    const shrunk = previewSeed({ ...ENTRY, abilities: undefined, level: undefined }, { cast: CAST });
    assert.equal(value(shrunk, 'abilities'), undefined);
    assert.equal(value(shrunk, 'level'), undefined, 'no guessed Level');
    assert.deepEqual(previewSeed(ENTRY, { cast: CAST }).fields, first.fields, 'back to the first entry: the first answer');
});

test('rows past NPC State\'s limits are reported and left out; a secret with a gate seeds only with world secrets on', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `N${i}`, description: 'd' }));
    const big = previewSeed({ ...ENTRY, abilities: many });
    assert.equal(value(big, 'abilities').length, 16);
    assert.deepEqual(big.overflow.abilities, ['N16', 'N17', 'N18', 'N19']);
    const gated = { ...ENTRY, secrets: [{ id: 'gate', title: 'Gate', text: 'Hidden.', gate: 'meter trust >= 50' }] };
    const off = previewSeed(gated);
    const on = previewSeed(gated, { gated: true });
    assert.ok((value(on, 'secrets')?.length ?? 0) > (value(off, 'secrets')?.length ?? 0));
});

// The same entry through a whole host (Delta's real index.js and the cast sync at the first meeting): the preview shows what it made.
test('the preview equals the record a whole host makes at the first meeting', () => {
    const prelude = async () => {
        const sdk = {
            registered: [], people: [], made: {}, handlers: {}, present: [],
            registerModule(def) { sdk.registered.push(def); },
            on(name, fn) { const was = sdk.handlers[name]; sdk.handlers[name] = async (...args) => { await was?.(...args); return fn(...args); }; return () => {}; },
            turn: async turn => { await sdk.handlers.turn?.(turn); },
            command: async type => {
                if (type === 'npc.tick') for (const person of sdk.people) if (person.met && person.entry) sdk.made[person.key] = { name: person.name };
                return { ok: true, receipt: { summary: '' } };
            },
            query: name => (name === 'director.cast' ? structuredClone(sdk.people)
                : name === 'npc.castMade' ? structuredClone(sdk.made)
                : name === 'packs.list' ? [{ id: 'studio', name: 'Studio', version: '1.0.0' }]
                : name === 'director.calendar' ? { era: 'CY', months: [{ name: 'Goldwane', days: 30 }], leapYears: false }
                : name === 'scene.present' ? structuredClone(sdk.present) : null),
            settings: () => ({}),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    };
    const scenario = async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        const sdk = mockState.sdk;
        mockState.quietResponder = async () => JSON.stringify({ npcs: [] });
        const rows = __ROWS__;
        sdk.people = rows;
        sdk.present = ['Fenna'];
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'And then?' });
        await Promise.all((mockState.listeners.get('message_sent') || []).map(fn => fn(mockState.context.chat.length - 1)));
        const text = 'Fenna looks up from her rope.';
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: text, swipe_id: 0, swipes: [text] });
        const id = mockState.context.chat.length - 1;
        await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
        await Promise.all((mockState.listeners.get('character_message_rendered') || []).map(fn => fn(id)));
        await sleep(150);
        await sdk.turn({ type: 'normal' });
        await sleep(550);
        const npc = api.getState().npcs.find(n => n.name === 'Fenna');
        console.log('RESULT ' + JSON.stringify(npc ?? null));
    };
    const row = (raw, met) => ({ key: `studio:${raw.id}`, pack: 'studio', id: raw.id, name: raw.name, aliases: [], met, alive: true, entry: structuredClone(raw) });
    const rows = [row(ENTRY, { on: 0, where: '' }), row(CAST[0], null)];
    const source = scenario.toString().replace('__ROWS__', JSON.stringify(rows));
    const made = scenarioOutput(runHostScenario('seed-preview-host', { toString: () => prelude.toString() }, { toString: () => source }));
    assert.ok(made, 'the host made the dossier');
    const preview = previewSeed(ENTRY, { cast: CAST });
    for (const { field, value: seeded } of preview.fields) {
        if (['location', 'birthDate'].includes(field)) continue;   // the host's place is where she was met; the birthday reads the chat's calendar
        assert.deepEqual(made[field], seeded, `field ${field}`);
    }
});
