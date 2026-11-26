// A world-pack cast entry's long texts: the pack check takes what NPC State keeps, so an accepted text reaches the dossier whole.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkWorldCast } from '../../packs/validate/world-pack-parts/cast-world.js';
import { applyCastEntry } from '../../modules/people/dossier/cast-dossier-parts/apply-entry.js';
import { normalizeEntry } from '../../modules/people/dossier/cast-dossier.js';
import { normalizeNpcRecord } from '../../modules/people/core/continuity-core-parts/records.js';
import { injectionOptionalFields } from '../../modules/people/core/core-injection-parts-parts/optional-fields.js';
import { buildScannerPrompt } from '../../modules/people/core/core-prompts-scanner.js';
import { buildProfileRefreshPrompt } from '../../modules/people/core/core-prompts-targeted-parts/profile-refresh.js';

const MAX = { look: 800, wears: 600, voice: 600, personality: 900, history: 1200 };
const person = extra => ({ kind: 'companion', id: 'fenna', name: 'Fenna', start: { place: 'ledgerford', goal: 'g', routine: 'r'.repeat(300) }, ...extra });
const check = record => { const warnings = []; return { kept: checkWorldCast([record], 'p', () => {}, (...w) => warnings.push(w), true), warnings }; };

test('a world cast text at its limit is kept whole by the check and by NPC State', () => {
    const texts = Object.fromEntries(Object.entries(MAX).map(([field, max]) => [field, 'a'.repeat(max)]));
    // look and wears share a cap, so each reaches its own limit with the other cut to what is left.
    for (const pair of [{ wears: 'a'.repeat(395) }, { look: 'a'.repeat(595) }]) {
        const { kept, warnings } = check(person({ ...texts, ...pair }));
        assert.deepEqual(warnings, []);
        const entry = normalizeEntry(kept[0]);
        for (const [field, max] of Object.entries(MAX)) assert.equal(entry[field].length, pair[field]?.length ?? max, field);
        assert.equal(entry.start.routine.length, 300);
    }
});

test('look and wears over 1195 characters together refuse that person, naming both', () => {
    const { kept, warnings } = check(person({ look: 'a'.repeat(800), wears: 'a'.repeat(396) }));
    assert.equal(kept.length, 0);
    assert.match(warnings[0][2], /look and wears together must be at most 1195 characters/);
});

test('the longest look and wears reach the end of wears in each prompt that shows a cast appearance', () => {
    for (const [look, wears] of [[800, 395], [595, 600]]) {
        const end = 'and red boots';
        const record = person({ look: 'l'.repeat(look), wears: `${'w'.repeat(wears - end.length - 1)} ${end}` });
        const entry = normalizeEntry(check(record).kept[0]);
        assert.equal(entry.look.length + entry.wears.length, 1195);
        const npc = normalizeNpcRecord(applyCastEntry({ id: 'npc_fenna', name: 'Fenna' }, { key: 'p/fenna', pack: 'p', id: 'fenna', entry }));
        assert.ok(npc.appearance.length > 1195 && npc.appearance.endsWith(end), 'stored whole');
        assert.ok(injectionOptionalFields(npc, true)[0][0].endsWith(end), 'narrator');
        for (const prompt of [buildScannerPrompt({ transcript: 'Fenna changes her clothes.', existingNpcs: [npc] }), buildProfileRefreshPrompt({ transcript: 'Fenna waits.', targetNpc: npc })]) {
            assert.ok(prompt.includes(JSON.stringify(npc.appearance).slice(1, -1)));
        }
    }
});

test('one character over a limit refuses that person alone', () => {
    for (const [field, max] of Object.entries(MAX)) {
        const { kept, warnings } = check(person({ [field]: 'a'.repeat(max + 1) }));
        assert.equal(kept.length, 0, field);
        assert.match(warnings[0][2], new RegExp(`${field} must be plain text of 1 to ${max}`));
    }
    assert.equal(check(person({ start: { place: 'ledgerford', routine: 'r'.repeat(301) } })).kept.length, 0);
});

// '𝒜' is one character and two UTF-16 units: the prompts and the dossier cut by units, so the check counts them too.
const ASTRAL = '\u{1D49C}';

test('a text at its limit in UTF-16 units is kept whole by NPC State; one unit over refuses, though its characters fit', () => {
    for (const [field, max] of Object.entries(MAX)) {
        const fits = `${'a'.repeat(max - 2)}${ASTRAL}`;
        const taken = check(person({ [field]: fits }));
        assert.deepEqual(taken.warnings, [], field);
        assert.equal(normalizeEntry(taken.kept[0])[field], fits, field);
        const over = check(person({ [field]: `${'a'.repeat(max - 1)}${ASTRAL}` }));
        assert.equal(over.kept.length, 0, field);
        assert.match(over.warnings[0][2], new RegExp(`${field} must be plain text of 1 to ${max}`));
    }
    assert.equal(check(person({ start: { place: 'ledgerford', routine: `${'r'.repeat(299)}${ASTRAL}` } })).kept.length, 0);
});

test('look and wears share their cap in UTF-16 units: at it the end of wears reaches each prompt; one unit over refuses', () => {
    const end = `red boots ${ASTRAL}`;
    const wears = `${'w'.repeat(395 - end.length - 1)} ${end}`;
    const entry = normalizeEntry(check(person({ look: 'l'.repeat(800), wears })).kept[0]);
    assert.equal(entry.look.length + entry.wears.length, 1195);
    const npc = normalizeNpcRecord(applyCastEntry({ id: 'npc_fenna', name: 'Fenna' }, { key: 'p/fenna', pack: 'p', id: 'fenna', entry }));
    assert.ok(npc.appearance.endsWith(end), 'stored whole');
    assert.ok(injectionOptionalFields(npc, true)[0][0].endsWith(end), 'narrator');
    for (const prompt of [buildScannerPrompt({ transcript: 'Fenna changes her clothes.', existingNpcs: [npc] }), buildProfileRefreshPrompt({ transcript: 'Fenna waits.', targetNpc: npc })]) {
        assert.ok(prompt.includes(JSON.stringify(npc.appearance).slice(1, -1)));
    }
    const over = check(person({ look: 'l'.repeat(800), wears: `w${wears}` }));
    assert.equal(over.kept.length, 0);
    assert.match(over.warnings[0][2], /look and wears together must be at most 1195 characters/);
});

test('the list texts that NPC State cuts at the same limit count UTF-16 units too', () => {
    const text = (units, max) => `${'a'.repeat(max - units)}${ASTRAL}`;
    const lists = over => ({
        keyRelationships: [{ id: 'bram', text: text(over ? 1 : 2, 400) }],
        abilities: [{ name: 'Song', description: text(over ? 1 : 2, 200) }],
        stages: [{ name: text(over ? 1 : 2, 40), needs: [{ meter: 'trust', at: 10 }], text: 'Close.' }],
    });
    for (const [field, value] of Object.entries(lists(false))) assert.deepEqual(check(person({ [field]: value })).warnings, [], field);
    for (const [field, value] of Object.entries(lists(true))) assert.equal(check(person({ [field]: value })).kept.length, 0, field);
    const entry = normalizeEntry(check(person(lists(false))).kept[0], () => 'Bram');
    assert.ok(entry.keyRelationships[0].endsWith(ASTRAL));
    assert.ok(entry.abilities[0].description.endsWith(ASTRAL));
    assert.ok(entry.stages[0].name.endsWith(ASTRAL));
});
