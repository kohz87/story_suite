import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { standInTree } from './helpers/temp-tree.js';
import { oldSource } from './helpers/old-source.js';
import {
    LEVEL_FIELD_RULE, buildBackfillPrompt, buildDossierImportPrompt, buildNarrationCaptureParts, buildProfileRefreshPrompt,
    buildScannerPrompt, createNpcRecord, mergeScanResult, normalizeNpcRecord,
} from '../../modules/people/core/core.js';
import { tempDir } from '../../scripts/temp-dir.mjs';

// The Level field rule (owner-approved, core contract C10): one sentence in the custom-field rule, only when the
// configured names include Level (any case); every other prompt and field is unchanged.

const npc = normalizeNpcRecord({ id: 'npc_maelis', name: 'Maelis Varn', present: true, personality: 'Warm.' });
const options = { transcript: 'Maelis waves.', existingNpcs: [npc], existingNpc: npc, targetNpc: npc, targetName: 'Maelis Varn' };
const builders = {
    scanner: o => buildScannerPrompt(o),
    capture: o => buildNarrationCaptureParts(o).context,
    backfill: o => buildBackfillPrompt(o),
    refresh: o => buildProfileRefreshPrompt(o),
    dossierImport: o => buildDossierImportPrompt(o),
};

for (const [label, build] of Object.entries(builders)) {
    test(`${label} prompt: the Level sentence only when Level is configured, in any case`, () => {
        const without = build({ ...options, customFieldNames: ['Class', 'Faction'] });
        assert.ok(!without.includes(LEVEL_FIELD_RULE));
        assert.equal(build({ ...options, customFieldNames: ['Class', 'Faction'] }), without);
        for (const name of ['Level', 'level', 'LEVEL']) {
            const withLevel = build({ ...options, customFieldNames: [name, 'Class'] });
            assert.ok(withLevel.includes(`Never guess.${LEVEL_FIELD_RULE}`), name);
            assert.equal(withLevel.split('Level is the one exception').length, 2, 'once');
        }
        const a = build({ ...options, customFieldNames: ['Class'] });
        const b = build({ ...options, customFieldNames: ['Class', 'Level'] });
        assert.ok(b.length - a.length > LEVEL_FIELD_RULE.length, 'the delta is the sentence plus the name');
        assert.equal(build({ ...options, customFieldNames: [] }).includes('CUSTOM FIELDS'), false);
    });
}

test('the Level sentence is stated, generic, and leaves "Never guess" for every other field', () => {
    assert.match(LEVEL_FIELD_RULE, /named level or rank|names that person's level or rank/);
    assert.match(LEVEL_FIELD_RULE, /"C-D"/);
    assert.match(LEVEL_FIELD_RULE, /Never from dramatic description/);
    assert.match(LEVEL_FIELD_RULE, /not quotes, questions or wishes/);
    assert.match(LEVEL_FIELD_RULE, /customFieldsReason/);
    const prompt = buildScannerPrompt({ ...options, customFieldNames: ['Level', 'Class'] });
    assert.match(prompt, /Never guess\. Level is the one exception/, 'Never guess stays; Level alone is excepted');
    assert.doesNotMatch(buildScannerPrompt({ ...options, customFieldNames: ['Class'] }), /exception/);
});

test('in a one-pass capture the Level sentence sits in the context part, not the cached rules part', () => {
    const parts = buildNarrationCaptureParts({ ...options, customFieldNames: ['Level'] });
    assert.ok(!parts.rules.includes('Level is the one exception'));
    assert.ok(parts.context.includes(LEVEL_FIELD_RULE));
});

test('merge: a Level estimate needs a quote that is really in the story; hand-set values and other fields keep their rules', () => {
    const base = { npcs: [{ ...createNpcRecord('Mira'), id: 'npc_mira' }], candidates: [], turn: 1 };
    const scan = (state, fields, reason, context) => mergeScanResult(state, { npcs: [{ id: 'npc_mira', name: 'Mira', customFields: fields, customFieldsReason: reason }] },
        { turn: 1, customFieldNames: ['Level', 'Class'], developmentContext: context }).state;
    const story = 'Mira walks in. "He is far beyond anything I can sense," the captain whispers. Mira is level 3.';
    const quote = 'Level: "far beyond anything I can sense"';
    assert.equal(scan(base, { Level: '40' }, quote, story).npcs[0].customFields?.Level, '40', 'quoted line in the text passes');
    assert.equal(scan(base, { Level: '40' }, 'Level: "he is a legend of the northern wars"', story).npcs[0].customFields, undefined, 'a made-up reason is dropped');
    assert.equal(scan(base, { Level: '40' }, 'Level: "beyond"', story).npcs[0].customFields, undefined, 'a one-word quote is dropped');
    assert.equal(scan(base, { Level: '40' }, 'far beyond anything I can sense', story).npcs[0].customFields, undefined, 'a quote not written after "Level" is dropped');
    assert.equal(scan(base, { Level: '40' }, '', story).npcs[0].customFields, undefined, 'no reason, no estimate');
    assert.equal(scan(base, { Level: '40', Class: 'Rogue' }, 'Class: "far beyond anything I can sense" Level: a guess', story).npcs[0].customFields, undefined, 'a quote meant for another field does not carry Level');
    assert.equal(scan(base, { Level: '40' }, 'Level: "far beyond anything I can sense"', story).npcs[0].customFields?.Level, '40');
    const aged = (fields, reason) => mergeScanResult(base, { npcs: [{ id: 'npc_mira', name: 'Mira', customFields: fields, customFieldsReason: reason }] },
        { turn: 1, customFieldNames: ['Level', 'Age'], developmentContext: 'The damage she did was far beyond anything I can sense.' }).state.npcs[0].customFields;
    assert.equal(aged({ Level: '40' }, 'Level: "the damage she did was far beyond anything I can sense"')?.Level, '40', 'a field name inside the quote does not cut it');
    assert.equal(aged({ Level: '40', Age: '30' }, 'Age: "x" Level: "the damage she did was far beyond anything I can sense"')?.Level, '40');
    assert.equal(scan(base, { Level: '3' }, '', story).npcs[0].customFields?.Level, '3', 'a value in the text keeps its path');
    assert.equal(scan(base, { Class: 'Rogue' }, 'a guess', story).npcs[0].customFields, undefined, 'other fields still need the value in the text');
    const set = scan(base, { Level: '40' }, quote, story);
    assert.equal(scan(set, { Level: '50' }, '', story).npcs[0].customFields.Level, '40', 'an established value needs a reason');
    set.npcs[0].manualProfileFields = ['customFields'];
    assert.equal(scan(set, { Level: '50' }, quote, story).npcs[0].customFields.Level, '40', 'a hand-set value is never overwritten');
});

// ---- the Level field appears by itself while Story Block's RPG feature is on (read time, never stored) ----
// runtime-settings.js imports SillyTavern's extensions.js, so it is loaded from a temp tree with a stub host (as settings-debounce.test.js does).
const tempRoot = tempDir('npc-level-auto-');
const extRoot = path.join(tempRoot, 'public', 'scripts', 'extensions', 'third-party', 'npc_state_delta');
fs.mkdirSync(extRoot, { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'package.json'), JSON.stringify({ type: 'module' }));
standInTree(extRoot);   // old names, stand-ins for the real files; the host modules are the shared stubs reading __npcMock
globalThis.__npcMock = { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };
const { effectiveCustomFieldNames, setRpgProbe, rpgIsOn } = await import(pathToFileURL(path.join(extRoot, 'runtime-settings.js')).href);
const { buildInjection } = await import('../../modules/people/core/core.js');
const { suite } = await import('./helpers/pacing-suite.js');
const setNames = names => ({ customFieldNames: names });
const rpg = { on: false };

test('the accessor no longer adds Level while the RPG is on: Level is a built-in field (pack format 4); the configured names are returned as they are', () => {
    try {
        setRpgProbe(null);
        assert.deepEqual(effectiveCustomFieldNames(setNames(['Class'])), ['Class'], 'standalone');
        setRpgProbe(() => rpg.on);
        for (const on of [false, true]) {
            rpg.on = on;
            assert.deepEqual(effectiveCustomFieldNames(setNames(['Class'])), ['Class'], `RPG ${on ? 'on' : 'off'}: the configured names only`);
            assert.deepEqual(effectiveCustomFieldNames(setNames([])), [], `RPG ${on ? 'on' : 'off'}: none stays none`);
            assert.deepEqual(effectiveCustomFieldNames(setNames(['LEVEL', 'Class'])), ['LEVEL', 'Class'], 'a configured Level (any case) is kept as configured');
        }
        setRpgProbe(() => { throw new Error('host gone'); });
        assert.equal(rpgIsOn(), false, 'a probe that throws means off');
        setRpgProbe(() => true);
        assert.equal(rpgIsOn(), true);
    } finally { setRpgProbe(null); }
});

test('RPG on adds no Level custom field to the scanner prompt or the injection; a configured Level behaves as before', () => {
    const npcWithLevel = normalizeNpcRecord({ id: 'npc_maelis', name: 'Maelis Varn', present: true, personality: 'Warm.', customFields: { Level: '3', Class: 'Rogue' } });
    const inject = names => buildInjection([npcWithLevel], 'Maelis waves.', 1, 3, undefined, 4000, null, { customFieldNames: names });
    try {
        setRpgProbe(() => true);
        const names = effectiveCustomFieldNames(setNames(['Class']));
        assert.equal(buildScannerPrompt({ ...options, customFieldNames: names }), buildScannerPrompt({ ...options, customFieldNames: ['Class'] }));
        assert.doesNotMatch(buildScannerPrompt({ ...options, customFieldNames: names }), /Level is the one exception/);
        assert.doesNotMatch(inject(names), /Level: 3/, 'the stored custom Level is not injected unless it is configured');
        assert.match(inject(['Class', 'Level']), /Class: Rogue · Level: 3|Level: 3 · Class: Rogue/, 'a configured Level still is');
    } finally { setRpgProbe(null); }
});

test('the adapter answers rpgOn from the host feature (hosted), false when off', async () => {
    const s = await suite({});
    assert.equal(s.adapter.rpgOn(), true === s.host.sdk.feature('story-block.rpg'), 'it follows the host');
    s.host.features.set('story-block.rpg', true);
    assert.equal(s.adapter.rpgOn(), true);
    s.host.features.set('story-block.rpg', false);
    assert.equal(s.adapter.rpgOn(), false, 'switched off mid-chat: the next read sees it');
});

// ---- N4: the sheet no longer overwrites the stored Level on a scan (it used to: `applySheetLevels`); the sheet writes back through people.fields ----
test('a scan keeps the scanner\'s Level for an active party member: no party-sheet overwrite, no sheetLevels in the report', () => {
    const reason = 'Level: "far beyond anything I can sense"';
    const story = 'The captain whispers: he is far beyond anything I can sense. Mira is level 3.';
    const mira = { ...createNpcRecord('Mira'), id: 'npc_mira', aliases: ['the Ranger'], customFields: { Level: '4' } };
    const scan = (state, fields, extra) => mergeScanResult(state, { npcs: [{ id: 'npc_mira', name: 'Mira', customFields: fields, customFieldsReason: reason }] },
        { turn: 2, customFieldNames: ['Level'], developmentContext: story, ...extra });
    const done = scan({ npcs: [mira], candidates: [], turn: 1 }, { Level: '40' }, { partyLevels: [{ name: 'Mira', level: 5 }] });
    assert.equal(done.state.npcs[0].customFields.Level, '40', 'the scanner\'s Level stands; the sheet\'s 5 is not written');
    assert.equal(done.report.sheetLevels, undefined);
    const quiet = scan({ npcs: [mira], candidates: [], turn: 1 }, {}, { partyLevels: [{ name: 'the ranger', level: 6 }] });
    assert.equal(quiet.state.npcs[0].customFields.Level, '4', 'nothing is written for a member either');
});

test('the adapter still reads party.levels (null without the query); the hosted views no longer mark Level "from the party sheet"', async () => {
    assert.equal((await suite({})).adapter.partyLevelsAnswer(), null, 'a host without the query: as today (the answer with the query: cast-dossier.test.js)');
    const source = oldSource('runtime-hosted.js');
    assert.equal(/sheetLevels|partyLevelList/.test(source), false, 'no sheet-level mark and no party level list in the hosted part');
});

test('no scan call site passes the party levels any more', () => {
    for (const file of ['runtime-scan.js', 'runtime-targeted.js']) {
        const source = oldSource(file);
        assert.ok(source.includes('mergeScanResult('), file);
        assert.equal(source.includes('partyLevels'), false, `${file}: no partyLevels`);
    }
});
test.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
