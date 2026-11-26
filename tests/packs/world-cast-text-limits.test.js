// A world-pack cast entry's long texts: the pack check takes what NPC State keeps, so an accepted text reaches the dossier whole.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkWorldCast } from '../../packs/validate/world-pack-parts/cast-world.js';
import { normalizeEntry } from '../../modules/people/dossier/cast-dossier.js';

const MAX = { look: 800, wears: 600, voice: 600, personality: 900, history: 1200 };
const person = extra => ({ kind: 'companion', id: 'fenna', name: 'Fenna', start: { place: 'ledgerford', goal: 'g', routine: 'r'.repeat(300) }, ...extra });
const check = record => { const warnings = []; return { kept: checkWorldCast([record], 'p', () => {}, (...w) => warnings.push(w), true), warnings }; };

test('a world cast text at its limit is kept whole by the check and by NPC State', () => {
    const texts = Object.fromEntries(Object.entries(MAX).map(([field, max]) => [field, 'a'.repeat(max)]));
    const { kept, warnings } = check(person(texts));
    assert.deepEqual(warnings, []);
    const entry = normalizeEntry(kept[0]);
    for (const [field, max] of Object.entries(MAX)) assert.equal(entry[field].length, max, field);
    assert.equal(entry.start.routine.length, 300);
});

test('one character over a limit refuses that person alone', () => {
    for (const [field, max] of Object.entries(MAX)) {
        const { kept, warnings } = check(person({ [field]: 'a'.repeat(max + 1) }));
        assert.equal(kept.length, 0, field);
        assert.match(warnings[0][2], new RegExp(`${field} must be plain text of 1 to ${max}`));
    }
    assert.equal(check(person({ start: { place: 'ledgerford', routine: 'r'.repeat(301) } })).kept.length, 0);
});
