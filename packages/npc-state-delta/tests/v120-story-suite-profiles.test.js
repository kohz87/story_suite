import test from 'node:test';
import assert from 'node:assert/strict';
import {
    NPC_PROFILE_ROLE_MAX,
    NPC_PROFILE_SUMMARY_MAX,
    buildNpcProfile,
    buildNpcProfiles,
    resolveDossierTarget,
    trimAtWord,
} from '../suite-handshake.js';
import { normalizeNpcRecord, setNpcArchived } from '../core.js';
import { runHostScenario } from './v120-story-suite.helpers.js';

test('v1.2.2 trimAtWord keeps whole words and ends a shortened text in an ellipsis', () => {
    assert.equal(trimAtWord('  short   text ', 200), 'short text');
    assert.equal(trimAtWord('aaaa bbbb cccc', 10), 'aaaa bbbb…');
    assert.equal(trimAtWord('aaaa bbbb cccc', 12), 'aaaa bbbb…');
    assert.equal(trimAtWord('aaaa bbbb; cccc', 12), 'aaaa bbbb…', 'no dangling separator before the ellipsis');
    assert.equal(trimAtWord('unbrokenwordthatislong', 8), 'unbroke…', 'one long word is cut inside, still within the cap');
    assert.equal(trimAtWord(null, 10), '');
    assert.equal(trimAtWord({ toString: () => 'x' }, 10), '');
});

test('v1.2.2 npc profiles: tracked, non-archived NPCs with a short role and a <= 200-char summary', () => {
    const lyra = {
        id: 'npc-lyra', name: 'Lyra Vance', aliases: ['Lyra', 'the healer'], present: true,
        role: 'Temple healer; former field medic of the Third Legion', species: 'elf',
        personality: 'Calm, dry, protective of the young; slow to trust strangers.',
        background: 'Raised in the Silver Temple, she served a decade as a field medic before taking her vows and returning to tend the poor of Ironvale and its mines.',
        speech: 'Clipped and formal.', mood: 'tired', appearance: 'grey robes',
        customFields: { Abilities: 'healing magic, shortsword', Level: '5', Faction: 'Silver Temple' },
        relationship: { trust: 40 }, memories: ['healed Ren'],
    };
    const npcs = [
        lyra,
        { id: 'npc-guard', name: 'Gate guard', role: 'guard', archived: true, present: false },
        { id: 'npc-ren', name: 'Ren', role: '', customFields: { class: 'Ranger', Skills: 'tracking, archery' }, personality: 'Quiet.' },
        { id: 'npc-empty', name: 'Mira' },
        null,
        'not a dossier',
    ];
    const profiles = buildNpcProfiles(npcs, { customFieldNames: ['Class', 'Abilities', 'Skills', 'Level', 'Faction'] });
    assert.deepEqual(profiles.map(profile => profile.id), ['npc-lyra', 'npc-ren', 'npc-empty'], 'archived and malformed entries are left out, dossier order kept');
    assert.deepEqual(Object.keys(profiles[0]), ['id', 'name', 'aliases', 'present', 'role', 'summary']);
    assert.deepEqual({ ...profiles[0], aliases: [...profiles[0].aliases] }, {
        id: 'npc-lyra', name: 'Lyra Vance', aliases: ['Lyra', 'the healer'], present: true,
        role: 'Temple healer',
        summary: 'Temple healer; former field medic of the Third Legion (elf). Abilities: healing magic, shortsword. Calm, dry, protective of the young; slow to trust strangers. Raised in the Silver Temple, she served…',
    });
    assert.ok(profiles[0].summary.length <= NPC_PROFILE_SUMMARY_MAX);
    assert.doesNotMatch(profiles[0].summary, /Level|Faction|tired|grey robes|Clipped/, 'only identity, abilities, personality and background are used');
    assert.deepEqual([profiles[1].role, profiles[1].summary, profiles[1].present], ['Ranger', 'Ranger. Skills: tracking, archery. Quiet.', false], 'a Class custom field stands in for an empty role and is not repeated');
    assert.deepEqual([profiles[2].role, profiles[2].summary, [...profiles[2].aliases]], ['', '', []]);

    // Plain frozen copies: the dossier is not shared or changed.
    assert.ok(Object.isFrozen(profiles) && profiles.every(profile => Object.isFrozen(profile) && Object.isFrozen(profile.aliases)));
    assert.notEqual(profiles[0].aliases, lyra.aliases);
    assert.throws(() => { 'use strict'; profiles[0].aliases.push('x'); }, TypeError);
    lyra.aliases.push('Vance');
    assert.deepEqual([...profiles[0].aliases], ['Lyra', 'the healer']);
    assert.deepEqual(Object.keys(lyra.customFields), ['Abilities', 'Level', 'Faction']);

    // Unconfigured custom fields are not read; without a dossier role the summary starts from species.
    assert.equal(buildNpcProfile({ id: 'x', name: 'X', species: 'dwarf', customFields: { Class: 'Cleric' }, personality: 'Gruff' }).summary, 'dwarf. Gruff.');
    assert.equal(buildNpcProfile({ id: 'x', name: 'X', species: 'Elf', role: 'Elf archer' }).summary, 'Elf archer.', 'species already in the role is not repeated');
    const longRole = buildNpcProfile({ id: 'x', name: 'X', role: 'Keeper of the old northern lighthouse and the drowned archive beneath the harbour cliffs' }).role;
    assert.ok(longRole.length <= NPC_PROFILE_ROLE_MAX && longRole.endsWith('…'), longRole);
    assert.equal(buildNpcProfile({ id: 'x', name: 'X', role: 'Blacksmith — once a soldier' }).role, 'Blacksmith');
});

test('v1.2.2 npc profiles leave out the dead, archived or not, and keep the living and the restored', () => {
    const npcs = [
        { id: 'alive', name: 'Alive', lifeState: 'alive', lifeStateCertainty: 'explicit' },
        { id: 'unknown', name: 'Unknown', lifeState: 'unknown' },
        { id: 'dead-explicit', name: 'Dead', lifeState: 'deceased', lifeStateCertainty: 'explicit', archived: false },
        { id: 'dead-inferred', name: 'Probably dead', lifeState: 'deceased', lifeStateCertainty: 'inferred' },
        { id: 'dead-case', name: 'Dead case', lifeState: ' Deceased ' },
        { id: 'dead-archived', name: 'Archived dead', lifeState: 'deceased', archived: true, archiveReason: 'deceased' },
        { id: 'restored', name: 'Restored', lifeState: 'alive', lifeStateCertainty: 'explicit', archived: false, archiveReason: '' },
    ];
    assert.deepEqual(buildNpcProfiles(npcs).map(profile => profile.id), ['alive', 'unknown', 'restored']);
    // The same through the dossier owner's own records: a confirmed death kept unarchived
    // (Auto-archive deaths off) is left out; a manual Restore marks the NPC alive again.
    const dead = normalizeNpcRecord({ id: 'n1', name: 'Orrin', lifeState: 'deceased', lifeStateCertainty: 'explicit' });
    assert.equal(dead.archived, false);
    const restored = setNpcArchived(setNpcArchived(dead, true, { reason: 'deceased' }), false, { allowDeathCorrection: true });
    assert.deepEqual(buildNpcProfiles([dead]), []);
    assert.deepEqual(buildNpcProfiles([restored]).map(profile => profile.id), ['n1']);
});

test('v1.2.2 npc profiles never throw and read nothing but the dossiers given', () => {
    assert.deepEqual(buildNpcProfiles(undefined), []);
    assert.deepEqual(buildNpcProfiles({ npcs: [] }), []);
    const hostile = { id: 'h', name: 'H' };
    Object.defineProperty(hostile, 'role', { get() { throw new Error('boom'); } });
    const warn = console.warn;
    console.warn = () => {};
    try {
        assert.deepEqual(buildNpcProfiles([hostile]), []);
    } finally {
        console.warn = warn;
    }
    assert.deepEqual(buildNpcProfiles([{ id: 'a', name: 'A', role: 7, aliases: 'Al', customFields: ['bad'] }], { customFieldNames: 'Class' }).map(p => [p.role, [...p.aliases], p.summary]), [['7', [], '7.']]);
});

test('v1.2.2 the runtime shares npcProfiles() beside the unchanged npcs(), with no request or prompt', () => {
    runHostScenario('npc-profiles', async () => {
        const suite = globalThis.StorySuite;
        const api = suite.api('npc-state-delta');
        assert.deepEqual(api.npcProfiles(), [], 'empty until the chat\'s dossiers load');
        mockState.extensionSettings.npc_state_delta.customFieldNames = ['Abilities'];
        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', species: 'human', personality: 'Shy, earnest and fiercely loyal to her rival.', customFields: { Abilities: 'advanced magic' }, mood: 'nervous, eager', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] });
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'Who is at the gate?' });
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'Yunyun, the shy human adventurer who casts advanced magic, waves nervously from the gate.', swipe_id: 0, swipes: ['Yunyun, the shy human adventurer who casts advanced magic, waves nervously from the gate.'] });
        const id = mockState.context.chat.length - 1;
        await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
        await sleep(200);

        const npcs = api.npcs();
        assert.deepEqual(npcs.map(npc => Object.keys(npc)), [['id', 'name', 'aliases', 'present', 'archived']], 'npcs() is unchanged');
        const requests = mockState.rawCalls.length;
        const prompts = mockState.prompts.length;
        const profiles = api.npcProfiles();
        assert.equal(profiles.length, 1);
        const [yunyun] = profiles;
        assert.deepEqual([yunyun.id, yunyun.name, yunyun.present, yunyun.role], [npcs[0].id, 'Yunyun', true, 'adventurer']);
        assert.match(yunyun.summary, /^adventurer \(human\)\./);
        assert.ok(yunyun.summary.length <= 200);
        assert.ok(Object.isFrozen(profiles) && Object.isFrozen(yunyun));
        assert.equal(mockState.rawCalls.length, requests, 'no model request');
        assert.equal(mockState.prompts.length, prompts, 'no prompt write');
        assert.notEqual(api.npcProfiles(), profiles, 'each call returns a fresh copy');
    });
});

test('v1.2.2 openDossier resolution: id first, then a unique name or alias among non-archived NPCs', () => {
    const npcs = [
        { id: 'npc-lyra', name: 'Lyra Vance', aliases: ['Lyra', 'the Healer'] },
        { id: 'npc-orrin', name: 'Orrin Hask', aliases: ['Capt. Hask'], archived: true, archiveReason: 'manual' },
        { id: 'npc-ren', name: 'Ren', aliases: ['Lyra Vance'] },
        { id: 'npc-twin-a', name: 'Twin', aliases: ['Sam'] },
        { id: 'npc-twin-b', name: 'twin', aliases: ['Sam'] },
        { id: 'npc-lyra-alias', name: 'Old Orrin', aliases: ['Orrin Hask'] },
        { name: 'No id' },
        null,
    ];
    assert.equal(resolveDossierTarget(npcs, 'npc-lyra'), 'npc-lyra');
    assert.equal(resolveDossierTarget(npcs, '  npc-ren '), 'npc-ren');
    assert.equal(resolveDossierTarget(npcs, 'npc-orrin'), '', 'an archived id opens nothing, with no name fallback');
    assert.equal(resolveDossierTarget(npcs, 'lyra vance'), 'npc-lyra', 'a name matches case-insensitively and wins over another NPC\'s alias');
    assert.equal(resolveDossierTarget(npcs, 'THE HEALER'), 'npc-lyra', 'an alias matches when no name does');
    assert.equal(resolveDossierTarget(npcs, 'Orrin Hask'), 'npc-lyra-alias', 'archived NPCs are not matched by name');
    assert.equal(resolveDossierTarget(npcs, 'Capt. Hask'), '', 'an archived NPC\'s alias matches nothing');
    assert.equal(resolveDossierTarget(npcs, 'Twin'), '', 'an ambiguous name opens nothing');
    assert.equal(resolveDossierTarget(npcs, 'Sam'), '', 'an ambiguous alias opens nothing');
    assert.equal(resolveDossierTarget(npcs, 'Lyr'), '', 'only exact matches');
    assert.equal(resolveDossierTarget(npcs, 'nobody'), '');
    assert.equal(resolveDossierTarget(npcs, ''), '');
    assert.equal(resolveDossierTarget(npcs, null), '');
    assert.equal(resolveDossierTarget(npcs, { id: 'npc-lyra' }), '');
    assert.equal(resolveDossierTarget(undefined, 'npc-lyra'), '');
    const hostile = [{ get id() { throw new Error('boom'); } }];
    assert.equal(resolveDossierTarget(hostile, 'x'), '', 'never throws');
});

test('v1.2.2 the runtime openDossier opens the launcher dossier path, and nothing for archived or unknown NPCs', () => {
    runHostScenario('open-dossier', async () => {
        const suite = globalThis.StorySuite;
        const api = suite.api('npc-state-delta');
        const opened = [];
        document.addEventListener('npc-state-delta:open-dossier', event => { opened.push(event.detail.npcId); event.detail.handled = true; });
        assert.equal(api.openDossier('Yunyun'), false, 'nothing before the dossiers exist');

        mockState.quietResponder = async () => JSON.stringify({ npcs: [
            { name: 'Yunyun', aliases: ['Yun'], present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } },
            { name: 'Wiz', present: true, role: 'shopkeeper', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named shopkeeper', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } },
        ] });
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'Who is here?' });
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'Yunyun (Yun to friends) waves while Wiz minds her shop.', swipe_id: 0, swipes: ['Yunyun (Yun to friends) waves while Wiz minds her shop.'] });
        const id = mockState.context.chat.length - 1;
        await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
        await sleep(200);
        const [yunyun, wiz] = ['Yunyun', 'Wiz'].map(name => api.npcs().find(npc => npc.name === name));
        assert.ok(yunyun && wiz);

        const requests = mockState.rawCalls.length;
        const prompts = mockState.prompts.length;
        const before = JSON.stringify(globalThis.NPCStateDelta.getState());
        assert.equal(api.openDossier(yunyun.id), true);
        assert.equal(api.openDossier('yunyun'), true, 'name fallback');
        assert.equal(api.openDossier('YUN'), true, 'alias fallback');
        assert.equal(api.openDossier('nobody'), false);
        assert.equal(api.openDossier(), false);
        assert.deepEqual(opened, [yunyun.id, yunyun.id, yunyun.id], 'the same open path as the launcher and present cast');
        assert.equal(mockState.rawCalls.length, requests, 'no model request');
        assert.equal(mockState.prompts.length, prompts, 'no prompt write');
        assert.equal(JSON.stringify(globalThis.NPCStateDelta.getState()), before, 'no data change');

        await globalThis.NPCStateDelta.archive(wiz.id);
        assert.equal(api.npcs().find(npc => npc.id === wiz.id)?.archived, true);
        assert.equal(api.openDossier(wiz.id), false, 'archived by id');
        assert.equal(api.openDossier('Wiz'), false, 'archived by name');
        assert.deepEqual(opened, [yunyun.id, yunyun.id, yunyun.id]);
    });
});
