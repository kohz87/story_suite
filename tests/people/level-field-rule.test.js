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

// ---- (hosted, main until job R2) an active party member's built-in Level follows their sheet (Story Block's `party.levels`) ----
test('active party member: the built-in Level follows the sheet (even past a custom-fields lock); after leaving the last sheet level stays', async () => {
    const mira = normalizeNpcRecord({ ...createNpcRecord('Mira'), id: 'npc_mira', aliases: ['the Ranger'], level: 4, customFields: { Class: 'Rogue' } });
    const scan = (state, party, extra = {}) => mergeScanResult(state, { npcs: [{ id: 'npc_mira', name: 'Mira' }] }, { turn: 2, ...(party ? { partyLevels: party } : {}), ...extra });
    const active = [{ name: 'Mira', level: 5 }];
    const a = scan({ npcs: [mira], candidates: [], turn: 1 }, active);
    assert.equal(a.state.npcs[0].level, 5, 'the sheet level');
    assert.deepEqual(a.state.npcs[0].customFields, { Class: 'Rogue' }, 'the custom fields are left as they are');
    assert.deepEqual(a.report.sheetLevels, [{ id: 'npc_mira', reason: 'Level: from the party sheet' }]);
    assert.ok(a.report.updated.includes('npc_mira'));
    assert.equal(scan(a.state, [{ name: 'the ranger', level: 6 }]).state.npcs[0].level, 6, 'an alias matches, in any case');
    assert.equal(scan(a.state, [{ name: 'Mira', level: 3 }]).state.npcs[0].level, 3, 'the sheet is the member\'s Level: it may lower it');
    assert.equal(scan(a.state, active).report.sheetLevels.length, 0, 'unchanged: nothing written');
    assert.equal(scan(a.state, []).state.npcs[0].level, 5, 'after leaving: the last sheet level stays');
    for (const party of [undefined, null, []]) assert.equal(scan({ npcs: [mira], candidates: [], turn: 1 }, party).state.npcs[0].level, 4, `no sheet (${JSON.stringify(party)}): as stored`);
    assert.equal(scan({ npcs: [{ ...mira, manualProfileFields: ['customFields'] }], candidates: [], turn: 1 }, active).state.npcs[0].level, 5, 'the built-in Level has no editor lock; a custom-fields lock does not cover it');
    assert.equal(scan({ npcs: [mira], candidates: [], turn: 1 }, [{ name: 'Mira', level: 120 }]).state.npcs[0].level, 4, 'outside 1 to 99: not written');
});

test('a configured custom "Level" from the scanner is still not kept for an active member (the sheet sets the Level)', () => {
    const reason = 'Level: "far beyond anything I can sense"';
    const story = 'The captain whispers: he is far beyond anything I can sense. Mira is level 3.';
    const mira = { ...createNpcRecord('Mira'), id: 'npc_mira', customFields: { Level: '4' } };
    const done = mergeScanResult({ npcs: [mira], candidates: [], turn: 1 }, { npcs: [{ id: 'npc_mira', name: 'Mira', customFields: { Level: '40' }, customFieldsReason: reason }] },
        { turn: 2, customFieldNames: ['Level'], developmentContext: story, partyLevels: [{ name: 'Mira', level: 5 }] });
    assert.equal(done.state.npcs[0].customFields.Level, '4', 'the scanner\'s 40 is stripped for a party member');
    assert.equal(done.state.npcs[0].level, 5);
});

test('the adapter reads party.levels (null without the query), the dossier marks Level "from the party sheet" only for those people', async () => {
    assert.equal((await suite({})).adapter.partyLevelsAnswer(), null, 'a host without the query: as today (the answer with the query: cast-dossier.test.js)');
    const { projectDossierState } = await import('../../modules/people/legacy/dossier-ui-catalog.js');
    const people = [normalizeNpcRecord({ id: 'npc_mira', name: 'Mira', level: 5 }), normalizeNpcRecord({ id: 'npc_bo', name: 'Bo', level: 2 })];
    const marked = projectDossierState({ npcs: people, sheetLevels: { npc_mira: true } }, { chatKey: 'c1' }).npcs;
    assert.equal(marked[0].levelFromSheet, true);
    assert.equal(marked[1].levelFromSheet, undefined, 'a person off the sheet (or left) has no mark');
    assert.equal(projectDossierState({ npcs: people }, { chatKey: 'c1' }).npcs[0].levelFromSheet, undefined, 'standalone: no mark');
});

// ---- the sheet level holds on every scan path; the mark only when it matches ----
const hostedPart = async answer => {
    globalThis.document = { documentElement: { dataset: { npcStateDeltaStoryBlockV2: '1' } } }; globalThis.__handles.hosted = true;
    const { createHostedPart } = await import(pathToFileURL(path.join(extRoot, 'runtime-hosted.js')).href);
    const rt = { storySuiteV2: { hosted: () => true, partyLevelsAnswer: () => answer } };
    return createHostedPart(rt, { chatHydrationStatus: () => 'ready', getChatKey: () => 'c1', getChatState: () => ({ npcs: [] }), latestMessageId: () => 1, latestReplyIndex: () => 1 });
};

test('partyLevelList drops a member who left (rule 2), keeps whole-number levels only, and the mark needs the stored Level to equal the sheet', async () => {
    const prior = globalThis.document;
    try {
        const part = await hostedPart([{ name: 'Mira', level: 5, left: false }, { name: 'Bo', level: 3, left: true }, { name: 'Cy', level: 2.5 }, { name: 'Di', level: 4 }]);
        assert.deepEqual(part.partyLevelList(), [{ name: 'Mira', level: 5 }, { name: 'Di', level: 4 }], 'Bo left; Cy has no whole level');
        const person = (id, name, level) => normalizeNpcRecord({ id, name, ...(level === null ? {} : { level }) });
        const state = { npcs: [person('m', 'Mira', 5), person('b', 'Bo', 3), person('d', 'Di', 9), person('x', 'Xu', 5)] };
        assert.deepEqual(part.dossierHostViews({ ...state }).sheetLevels, { m: true }, 'Mira matches; Bo left; Di holds another value (hand-locked or not yet scanned); Xu is not a member');
        assert.equal(part.dossierHostViews({ npcs: [person('d', 'Di', null)] }).sheetLevels, undefined, 'no stored Level: no mark');
    } finally { globalThis.document = prior; }
});

test('every merge call site passes the party levels: the reply scan and the targeted passes (backfill, Refresh, catch-up and import go through them)', () => {
    const read = oldSource;
    for (const file of ['runtime-scan.js', 'runtime-targeted.js']) {
        const source = read(file);
        const calls = source.split('mergeScanResult(').length - 1;
        assert.equal(source.split('partyLevels: partyLevelList()').length - 1, calls, `${file}: each mergeScanResult call passes partyLevels`);
        assert.ok(calls >= 1, file);
    }
    assert.match(read('index.js'), /createTargetedPart\(rt, \{[^}]*partyLevelList/, 'the targeted part is given the one shared helper');
});
test.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));   // last: the hosted-part test above imports from it
