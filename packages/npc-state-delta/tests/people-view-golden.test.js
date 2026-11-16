import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PEOPLE_KEYS, peopleState, peopleView } from '../src/people/view.js';

// J07 step 3: the people view is lossless over every frozen dossier write path. For each path in
// field-paths-golden.json (already free of clock fields), view -> state gives back the golden's
// people keys, field for field, and the view's ids are unique.

const golden = JSON.parse(fs.readFileSync(new URL('./fixtures/field-paths-golden.json', import.meta.url), 'utf8'));

// The golden keeps three paths as bare records or lists; wrap them as sidecar states.
function asState(key, value) {
    if (key === 'editorNormalize') return { npcs: [value] };
    if (Array.isArray(value)) return { npcs: value };
    return value;
}

const keys = Object.keys(golden);

test('golden people view: the fixture has all 15 write paths', () => {
    assert.equal(keys.length, 15);
});

for (const key of keys) {
    test(`golden people view: ${key} round-trips`, () => {
        const state = asState(key, golden[key]);
        const warnings = [];
        const view = peopleView(state, { warn: message => warnings.push(message) });
        assert.deepEqual(warnings, []);
        assert.ok(view, 'a view is built');
        assert.equal(new Set(view.order).size, view.order.length, 'ids are unique');
        assert.deepEqual(view.order, state.npcs.map(npc => npc.id));
        const back = peopleState(view);
        assert.deepEqual(Object.keys(back).sort(), [...PEOPLE_KEYS].sort());
        for (const field of Object.keys(state)) {
            if (!PEOPLE_KEYS.includes(field)) continue;
            assert.deepEqual(back[field], state[field], `${key}: ${field} is unchanged`);
        }
    });
}

test('golden people view: the view is plain JSON and survives a JSON round trip', () => {
    for (const key of keys) {
        const view = peopleView(asState(key, golden[key]));
        assert.deepEqual(JSON.parse(JSON.stringify(view)), view, key);
    }
});
