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

// '𝒜' is one character and two UTF-16 units. The check counts characters, as it always has, so a pack that installed before still installs (prompts cut by units: a known limit for astral text right at a limit).
const ASTRAL = '\u{1D49C}';

test('cast text limits count characters: an astral character at a limit still fits, one character over refuses', () => {
    for (const [field, max] of Object.entries(MAX)) {
        const fits = `${'a'.repeat(max - 1)}${ASTRAL}`;
        assert.deepEqual(check(person({ [field]: fits })).warnings, [], field);
        const over = check(person({ [field]: `${'a'.repeat(max)}${ASTRAL}` }));
        assert.equal(over.kept.length, 0, field);
    }
    assert.deepEqual(check(person({ look: `${'l'.repeat(799)}${ASTRAL}`, wears: 'w'.repeat(395) })).warnings, []);
    assert.equal(check(person({ look: `${'l'.repeat(800)}${ASTRAL}`, wears: 'w'.repeat(395) })).kept.length, 0);
});
