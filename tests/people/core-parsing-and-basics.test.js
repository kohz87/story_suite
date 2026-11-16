import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildInjection,
    KEY_RELATIONSHIP_LIMIT,
    buildScannerPrompt,
    createNpcRecord,
    mergeScanResult,
    normalizeName,
    normalizeNpcRecord,
    parseScanJson,
    selectRelevantNpcs,
    scoreNpcRelevance,
    stripUiNoise,
    hasCompactMeguminWorldState,
} from '../core.js';

test('normalizes names across punctuation and casing', () => {
    assert.equal(normalizeName('  Lady Éris!! '), 'lady éris');
});

test('archive reason contract includes automatic stale archives', () => {
    for (const reason of ['', 'manual', 'deceased', 'stale']) assert.equal(normalizeNpcRecord({ name: 'Mira', archiveReason: reason }).archiveReason, reason);
    assert.equal(normalizeNpcRecord({ name: 'Mira', archiveReason: 'forgotten' }).archiveReason, '');
});


test('minor NPC flag survives normalization and does not disable present-state generation injection', () => {
    const npc = normalizeNpcRecord({ ...createNpcRecord('Minor Noble'), minor: true, present: true, personality: 'Reserved', speech: 'Formal' });
    assert.equal(npc.minor, true);
    assert.equal(npc.present, true);
    assert.equal(npc.personality, 'Reserved');
    assert.equal(npc.speech, 'Formal');
    assert.match(buildInjection([npc], 'The court waits.', 1, 3), /Minor Noble/);
});

test('parses fenced scanner JSON', () => {
    const parsed = parseScanJson('```json\n{"npcs":[{"name":"Yunyun"}]}\n```');
    assert.equal(parsed.npcs[0].name, 'Yunyun');
});

test('repairs common model JSON defects from raw scanner output', () => {
    const trailing = parseScanJson('{\n  "npcs": [ { "name": "Marris", }, ],\n}');
    assert.equal(trailing.npcs[0].name, 'Marris');

    const bareKey = parseScanJson('{npcs:[{name:"Guild Boy", present:true}]}');
    assert.equal(bareKey.npcs[0].name, 'Guild Boy');
    assert.equal(bareKey.npcs[0].present, true);
});

test('repairs parser-position missing commas between array elements and object properties', () => {
    const objects = parseScanJson('{"npcs":[{"name":"Myla"}\n {"name":"Toris"}]}');
    assert.deepEqual(objects.npcs.map(npc => npc.name), ['Myla', 'Toris']);

    const strings = parseScanJson('{"npcs":[{"name":"Myla","memories":["first"\n "second"],"present":true "worldActive":false}]}');
    assert.deepEqual(strings.npcs[0].memories, ['first', 'second']);
    assert.equal(strings.npcs[0].present, true);
    assert.equal(strings.npcs[0].worldActive, false);
});

test('does not silently accept truncated scanner JSON', () => {
    assert.throws(
        () => parseScanJson('{"npcs":[{"name":"Myla","appearance":"Young woman with dark'),
        /Unterminated string|malformed JSON/i,
    );
});

test('strips unrelated UI blocks but preserves Megumin World State and NPC Inner Chatter evidence', () => {
    const generic = stripUiNoise('<details><summary>UI</summary>secret panel</details><p>Yunyun waves.</p>');
    assert.equal(generic, 'Yunyun waves.');

    const megumin = stripUiNoise('<details><summary>📌 <b>World State</b></summary><b>Toris (Receptionist)</b>: working the guild desk.</details><details><summary>💭 <b>NPC Inner Chatter</b></summary>Toris: Another form to file.</details><p>The receptionist looks up.</p>');
    assert.match(megumin, /World State: Toris \(Receptionist\)\s*:\s*working the guild desk\./);
    assert.match(megumin, /NPC Inner Chatter: Toris: Another form to file\./);
    assert.match(megumin, /The receptionist looks up\./);
});

test('strips the August 18 Megumin master Blocks envelope down to intentional evidence only', () => {
    const raw = `Megumin narrates the guild hall.
<Blocks>
<CYOA>1. Ask Toris about the audit</CYOA>
<World_State>**Date & Time:** 10:00\n**Location:** Bluewatch Guild\n**NPCs Present:** Toris\n**Off-Screen:** Myla is filing reports upstairs.</World_State>
<NPC_Inner_Chatter>Toris: I need to finish this ledger.</NPC_Inner_Chatter>
<Bonds>Toris: Affection: 88/100 (+8)</Bonds>
<Character_Sheet>HP: 99/100</Character_Sheet>
<New_NPC name="Secret Banker">A model-generated NPC Bank dossier that must not become story evidence.</New_NPC>
<NPC_Update name="Toris">Personality: rewritten by Megumin NPC Bank</NPC_Update>
<Story_Tracker>next_beat: reveal the vault</Story_Tracker>
<Custom_Block>future possibility that did not happen</Custom_Block>
</Blocks>`;
    const cleaned = stripUiNoise(raw);
    assert.match(cleaned, /Megumin narrates the guild hall\./);
    assert.match(cleaned, /World State: .*Bluewatch Guild/);
    assert.match(cleaned, /Off-Screen:\*\* Myla is filing reports upstairs\./);
    assert.match(cleaned, /NPC Inner Chatter: Toris: I need to finish this ledger\./);
    for (const forbidden of ['Ask Toris about the audit', 'Affection: 88', 'HP: 99', 'Secret Banker', 'rewritten by Megumin NPC Bank', 'reveal the vault', 'future possibility']) {
        assert.doesNotMatch(cleaned, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});

test('recognizes compact Megumin World State without confusing a full state refresh', () => {
    const compact = `<Blocks><World_State>**Time & Loc:** Noon at Axel Guild\n**PC:** red cloak | standing\n**NPCs Present:**\n* Yunyun: blue robe | seated</World_State></Blocks>`;
    const full = `<Blocks><World_State>**Date & Time:** Noon\n**Location:** Axel Guild\n**Weather:** clear\n**NPCs Present:** Yunyun\n**Off-Screen:** Wiz tends the shop.</World_State></Blocks>`;
    assert.equal(hasCompactMeguminWorldState(compact), true);
    assert.equal(hasCompactMeguminWorldState(full), false);
    assert.equal(hasCompactMeguminWorldState('<p>No world tracker this turn.</p>'), false);
});

test('species/race is a first-class stable field and legacy thoughts are discarded', () => {
    const normalized = normalizeNpcRecord({
        name: 'Mira',
        race: 'Half-elf',
        thoughts: { current: 'legacy inner monologue', certainty: 'inferred' },
    });
    assert.equal(normalized.species, 'Half-elf');
    assert.equal('thoughts' in normalized, false);

    const npc = createNpcRecord('Brokk');
    npc.species = 'Dwarf';
    npc.manualProfileFields = ['species'];
    const merged = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, name: 'Brokk', species: 'Elf', present: true,
    }] }, { turn: 2 });
    assert.equal(merged.state.npcs[0].species, 'Dwarf');
});

test('scanner keeps species/race separate from appearance and does not persist Inner Chatter thoughts', () => {
    const prompt = buildScannerPrompt({ transcript: 'Brokk is a dwarf. NPC Inner Chatter: I hope nobody notices.' });
    assert.match(prompt, /species literal/i);
    assert.match(prompt, /Never invent\./i);
    assert.match(prompt, /species literal/i);
    assert.match(prompt, /species-aging inference/i);
    assert.doesNotMatch(prompt, /\"thoughts\"\s*:/i);
});

test('stored age and apparentAge remain separate without old-format migration', () => {
    const oldShape = normalizeNpcRecord({ id: 'npc_marris', name: 'Marris', age: '~25' });
    assert.equal(oldShape.age, '~25');
    assert.equal(oldShape.apparentAge, '');

    const current = normalizeNpcRecord({ id: 'npc_elaria', name: 'Elaria', age: '~143', apparentAge: '~24' });
    assert.equal(current.age, '~143');
    assert.equal(current.apparentAge, '~24');
});

test('retired Importance/manual metadata is stripped while current story salience remains authoritative', () => {
    const normalized = normalizeNpcRecord({ name: 'Iria', importance: 77, manual: true });
    assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'importance'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'manual'), false);

    const created = mergeScanResult({ npcs: [], turn: 0 }, { npcs: [{
        name: 'Newa', identityKind: 'proper_name', dossierSignal: 'meaningful', present: true, importance: 100,
    }] }, { turn: 1 });
    assert.equal(Object.prototype.hasOwnProperty.call(created.state.npcs[0], 'importance'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(created.state.npcs[0], 'manual'), false);

    const remote = createNpcRecord('Remote Queen');
    remote.lastSeenTurn = 0;
    const mira = createNpcRecord('Mira');
    mira.lastSeenTurn = 0;
    const picked = selectRelevantNpcs([remote, mira], 'Mira enters and takes the empty chair.', 10, 1);
    assert.deepEqual(picked.map(npc => npc.name), ['Mira']);
    assert.ok(scoreNpcRelevance(mira, 'Mira enters and takes the empty chair.', 10) > scoreNpcRelevance(remote, 'Mira enters and takes the empty chair.', 10));
});

test('key relationship limit is eight and the editor label says so', async () => {
    assert.equal(KEY_RELATIONSHIP_LIMIT, 8);
    const fs = await import('node:fs');
    assert.match(fs.readFileSync(new URL('../runtime-editor.js', import.meta.url), 'utf8'), /Max \$\{KEY_RELATIONSHIP_LIMIT\}/);
});
