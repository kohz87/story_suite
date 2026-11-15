import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createNpcRecord,
    mergeScanResult,
    resolveInterimIdentityPromotions,
} from '../core.js';

test('matches alias to existing NPC instead of duplicating', () => {
    const npc = createNpcRecord('Luna');
    npc.aliases = ['Guild Receptionist'];
    // A role-description alias needs continuity evidence before it merges into a named dossier.
    const result = mergeScanResult({ npcs: [npc], turn: 2 }, { npcs: [{ name: 'Guild Receptionist', role: 'Adventurers Guild receptionist', sameIndividual: true }] }, { maxNpcs: 6, turn: 2 });
    assert.equal(result.state.npcs.length, 1);
    assert.equal(result.state.npcs[0].role, 'Adventurers Guild receptionist');
});

test('promotes an interim job-title dossier to a grounded proper name in place', () => {
    const npc = createNpcRecord('Guild Receptionist');
    npc.manual = false;
    npc.role = 'Adventurers Guild receptionist';
    npc.location = 'Bluewatch Guild';
    npc.memories = ['She waived the late filing fee after the rescue.'];
    npc.relationship = { trust: 17, affection: 4, desire: 0, tension: -2 };
    npc.portrait = { dataUrl: 'data:image/png;base64,abc' };

    const result = mergeScanResult({ npcs: [npc], candidates: [], turn: 4 }, { npcs: [{
        id: npc.id,
        name: 'Luna',
        aliases: ['Guild Receptionist'],
        identityKind: 'proper_name',
        sameIndividual: true,
        present: true,
        worldActive: false,
        relationshipImpact: 'none',
        relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 },
    }] }, { turn: 5 });

    assert.equal(result.state.npcs.length, 1);
    assert.equal(result.state.npcs[0].id, npc.id, 'identity promotion must keep the dossier id');
    assert.equal(result.state.npcs[0].name, 'Luna');
    assert.equal(result.state.npcs[0].identityKind, 'proper_name');
    assert.ok(result.state.npcs[0].aliases.includes('Guild Receptionist'), 'the interim label should remain searchable as an alias');
    assert.deepEqual(result.state.npcs[0].memories, npc.memories, 'identity promotion must preserve dossier history');
    assert.deepEqual(result.state.npcs[0].relationship, npc.relationship, 'identity promotion must preserve relationship state');
    assert.deepEqual(result.state.npcs[0].portrait, npc.portrait, 'identity promotion must preserve portrait data');
    assert.deepEqual(result.report.renamed, [{ id: npc.id, from: 'Guild Receptionist', to: 'Luna' }]);
});

test('uniquely matched role continuity can promote a dossier even when the model omits its id and old alias', () => {
    const npc = createNpcRecord('Guild Receptionist');
    npc.manual = false;
    npc.role = 'Adventurers Guild Receptionist';
    npc.location = 'Bluewatch Guild';

    const result = mergeScanResult({ npcs: [npc], candidates: [], turn: 2 }, { npcs: [{
        name: 'Luna', identityKind: 'proper_name', sameIndividual: true,
        role: 'Guild Receptionist', location: 'Bluewatch Guild', present: true, worldActive: false,
        relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 },
    }] }, { turn: 3 });

    assert.equal(result.state.npcs.length, 1, 'the newly named role must not create a duplicate dossier');
    assert.equal(result.state.npcs[0].id, npc.id);
    assert.equal(result.state.npcs[0].name, 'Luna');
    assert.ok(result.state.npcs[0].aliases.includes('Guild Receptionist'));
});

test('pre-merge identity resolver attaches the old dossier id to a uniquely matched proper-name reveal', () => {
    const npc = createNpcRecord('Guild Receptionist');
    npc.role = 'Adventurers Guild Receptionist';
    npc.location = 'Bluewatch Guild';
    const resolved = resolveInterimIdentityPromotions({ npcs: [{
        name: 'Luna', identityKind: 'proper_name', role: 'Guild Receptionist', location: 'Bluewatch Guild', present: true,
    }] }, [npc], []);
    assert.equal(resolved.npcs[0].id, npc.id, 'relationship repair and merge should see the revealed name as the existing dossier before mutation');
    assert.equal(resolved.npcs[0].sameIndividual, true);
    assert.ok(resolved.npcs[0].aliases.includes('Guild Receptionist'));
});

test('unique role continuity promotes an interim dossier when the model omits sameIndividual entirely', () => {
    const npc = createNpcRecord('Guild Receptionist');
    npc.manual = false;
    npc.role = 'Adventurers Guild Receptionist';
    npc.location = 'Bluewatch Guild';

    const result = mergeScanResult({ npcs: [npc], candidates: [], turn: 2 }, { npcs: [{
        name: 'Luna', identityKind: 'proper_name',
        role: 'Guild Receptionist', location: 'Bluewatch Guild', present: true, worldActive: false,
        relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 },
    }] }, { turn: 3 });

    assert.equal(result.state.npcs.length, 1);
    assert.equal(result.state.npcs[0].id, npc.id);
    assert.equal(result.state.npcs[0].name, 'Luna');
    assert.ok(result.state.npcs[0].aliases.includes('Guild Receptionist'));
});

test('explicit sameIndividual false prevents role-based identity fusion', () => {
    const npc = createNpcRecord('Guild Receptionist');
    npc.manual = false;
    npc.role = 'Guild Receptionist';
    npc.location = 'Bluewatch Guild';

    const result = mergeScanResult({ npcs: [npc], candidates: [], turn: 2 }, { npcs: [{
        name: 'Luna', identityKind: 'proper_name', sameIndividual: false,
        role: 'Guild Receptionist', location: 'Bluewatch Guild', present: true,
    }] }, { turn: 3 });

    assert.equal(result.state.npcs.length, 2, 'explicit different-person evidence must not merge the named NPC into the interim dossier');
    assert.ok(result.state.npcs.some(item => item.name === 'Guild Receptionist'));
    assert.ok(result.state.npcs.some(item => item.name === 'Luna'));
});

test('proper-name reveal can replace a manually locked interim profile name without losing the dossier id', () => {
    const npc = createNpcRecord('Masked Guard');
    npc.role = 'North Gate Guard';
    npc.manualProfileFields = ['name', 'role'];
    npc.memories = ['The guard let Aris through during the siege.'];

    const result = mergeScanResult({ npcs: [npc], candidates: [], turn: 4 }, { npcs: [{
        id: npc.id, name: 'Marris', identityKind: 'proper_name', present: true,
        relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 },
    }] }, { turn: 5 });

    assert.equal(result.state.npcs[0].id, npc.id);
    assert.equal(result.state.npcs[0].name, 'Marris');
    assert.ok(result.state.npcs[0].aliases.includes('Masked Guard'));
    assert.deepEqual(result.state.npcs[0].memories, npc.memories);
    assert.ok(result.state.npcs[0].manualProfileFields.includes('name'), 'the promoted proper name remains protected after replacing the placeholder');
});

test('scanner cannot downgrade a known proper name back to a job title', () => {
    const npc = createNpcRecord('Luna');
    npc.manual = false;
    npc.role = 'Guild Receptionist';
    const result = mergeScanResult({ npcs: [npc], candidates: [], turn: 2 }, { npcs: [{
        id: npc.id, name: 'Guild Receptionist', identityKind: 'role_label', sameIndividual: true,
        present: true, worldActive: false, relationshipImpact: 'none',
        relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 },
    }] }, { turn: 3 });
    assert.equal(result.state.npcs[0].name, 'Luna');
    assert.equal(result.state.npcs[0].identityKind, 'proper_name');
    assert.equal(result.report.renamed.length, 0);
});

test('role candidate promoted by a newly learned proper name carries the old label into aliases', () => {
    const first = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, { npcs: [{
        name: 'Guild Receptionist', identityKind: 'role_label', dossierSignal: 'incidental', present: true,
        role: 'Guild Receptionist', location: 'Bluewatch Guild',
    }] }, { turn: 1, admissionMode: 'conservative' });
    assert.equal(first.state.candidates.length, 1);

    const second = mergeScanResult(first.state, { npcs: [{
        name: 'Luna', identityKind: 'proper_name', dossierSignal: 'persistent', sameIndividual: true,
        role: 'Guild Receptionist', location: 'Bluewatch Guild', present: true,
    }] }, { turn: 2, admissionMode: 'conservative' });

    assert.equal(second.state.candidates.length, 0);
    assert.equal(second.state.npcs.length, 1);
    assert.equal(second.state.npcs[0].name, 'Luna');
    assert.ok(second.state.npcs[0].aliases.includes('Guild Receptionist'));
});

test('honors exclusions and roster cap', () => {
    const result = mergeScanResult({ npcs: [], turn: 1 }, { npcs: [{ name: 'Megumin' }, { name: 'Yunyun' }, { name: 'Wiz' }] }, { maxNpcs: 1, excludeNames: ['Megumin'], turn: 1 });
    assert.deepEqual(result.state.npcs.map(n => n.name), ['Yunyun']);
    assert.equal(result.report.skipped.length, 2);
});

// ---- name collisions: a surname or a title-less name alone never joins people of different gender or role ----
function seedRoster(rows) {
    let state = { npcs: [], turn: 1 };
    rows.forEach((row, at) => { state = mergeScanResult(state, { npcs: [{ present: true, dossierSignal: 'persistent', ...row }] }, { maxNpcs: 12, turn: 2 + at, admissionMode: 'immediate' }).state; });
    return state;
}
test('name collisions: courier "Pell" is not merged into "Vrena Pell" the spice seller; the same-role case still merges', () => {
    const state = seedRoster([{ name: 'Pell', gender: 'male', role: 'street courier' }]);
    assert.equal(state.npcs.length, 1, 'the courier has his own dossier');
    const out = mergeScanResult(state, { npcs: [{ name: 'Vrena Pell', aliases: ['Pell'], gender: 'female', role: 'spice seller', present: true, dossierSignal: 'persistent' }] }, { maxNpcs: 12, turn: 9, admissionMode: 'immediate' }).state;
    const names = out.npcs.map(npc => npc.name).sort();
    assert.deepEqual(names, ['Pell', 'Vrena Pell'], 'two people, two dossiers');
    assert.equal(out.npcs.find(npc => npc.name === 'Pell').gender, 'male');
    assert.equal(out.npcs.find(npc => npc.name === 'Vrena Pell').gender, 'female');
    const same = mergeScanResult(state, { npcs: [{ name: 'Rik Pell', aliases: ['Pell'], gender: 'male', role: 'courier for the guild', present: true, dossierSignal: 'persistent' }] }, { maxNpcs: 12, turn: 9, admissionMode: 'immediate' }).state;
    assert.equal(same.npcs.length, 1, 'same gender and a shared role word: still one person');
});
test('name collisions: "Varn" the carter and "Master Varn" (a different role) stay two people unless the scanner says they are one', () => {
    const state = seedRoster([{ name: 'Varn', gender: 'male', role: 'carter hauling suet' }]);
    const apart = mergeScanResult(state, { npcs: [{ name: 'Master Varn', gender: 'male', role: 'guild treasurer', present: true, dossierSignal: 'persistent' }] }, { maxNpcs: 12, turn: 9, admissionMode: 'immediate' }).state;
    assert.equal(apart.npcs.length, 2);
    const same = mergeScanResult(state, { npcs: [{ name: 'Master Varn', aliases: ['Varn'], sameIndividual: true, gender: 'male', role: 'guild treasurer', present: true, dossierSignal: 'persistent' }] }, { maxNpcs: 12, turn: 9, admissionMode: 'immediate' }).state;
    assert.equal(same.npcs.length, 1, 'an explicit sameIndividual joins them');
});
test('name collisions: a reworded role alone does not split one person; a role conflict plus a second difference does', () => {
    const opts = { maxNpcs: 12, turn: 9, admissionMode: 'immediate' };
    const row = extra => ({ present: true, dossierSignal: 'persistent', gender: 'female', ...extra });
    const state = seedRoster([{ name: 'Vrena Pell', gender: 'female', role: 'spice seller', location: 'Salt Market' }]);
    // The first name only, the role worded another way, no place conflict: the same person.
    const same = mergeScanResult(state, { npcs: [row({ name: 'Vrena', aliases: ['Vrena Pell'], role: 'market trader', location: 'Salt Market stalls' })] }, opts).state;
    assert.equal(same.npcs.length, 1, 'a reworded role with a shared place stays one dossier');
    const noPlace = mergeScanResult(state, { npcs: [row({ name: 'Vrena', aliases: ['Vrena Pell'], role: 'market trader' })] }, opts).state;
    assert.equal(noPlace.npcs.length, 1, 'no place on one side is not a second difference');
    // The same first name, a different role AND a different place: two people.
    const apart = mergeScanResult(state, { npcs: [row({ name: 'Vrena', aliases: ['Vrena Pell'], role: 'ferry pilot', location: 'Eastern Ferry' })] }, opts).state;
    assert.equal(apart.npcs.length, 2, 'role and place both differ');
    // A bare surname of the other (role differs, no place): two people, as before; gender conflicts still block on their own.
    const surname = mergeScanResult(state, { npcs: [row({ name: 'Pell', aliases: ['Vrena Pell'], role: 'street courier' })] }, opts).state;
    assert.equal(surname.npcs.length, 2, 'a surname with a different role');
    const gender = mergeScanResult(state, { npcs: [row({ name: 'Vrena', aliases: ['Vrena Pell'], gender: 'male', role: 'spice seller' })] }, opts).state;
    assert.equal(gender.npcs.length, 2, 'gender conflict blocks alone');
});
test('name collisions: the alias consolidation pass keeps a surname-alias pair of different gender apart', () => {
    const state = seedRoster([{ name: 'Pell', gender: 'male', role: 'courier' }, { name: 'Vrena Pell', gender: 'female', role: 'spice seller' }]);
    const woman = state.npcs.find(npc => npc.name === 'Vrena Pell');
    woman.aliases = ['Pell'];
    const out = mergeScanResult(state, { npcs: [] }, { maxNpcs: 12, turn: 12 }).state;
    assert.equal(out.npcs.length, 2);
});

// Card-only ghost: a name only the greeting's World State roster or a hidden Notebook note holds is never admitted.
import { storyTextsForAdmission } from '../scan-context.js';
const GREETING = 'Mist over Bluewatch, and Astra waits at the gate.\n<Blocks><World_State>\n**📡 Off-Screen:**\n* Watch-Captain Edda Rorke - Counting a short garrison\n</World_State></Blocks>';
const REPLY1 = 'The guard nods at you.\n<Blocks><Notebook>\nSecret: the toll is forged.\nHidden from: Astra, Edda Rorke, the reader\nComes out when: Astra speaks directly with Watch-Captain Edda Rorke\n</Notebook><CYOA>\n1. Ask about the toll\n</CYOA></Blocks>';
const ghostRow = name => ({ npcs: [{ name, identityKind: 'proper_name', dossierSignal: 'meaningful', present: false, worldActive: true }] });
const admit = (chat, upTo) => mergeScanResult({ npcs: [], candidates: [], turn: 1 }, ghostRow('Edda Rorke'), { turn: 1, storyTexts: storyTextsForAdmission(chat, upTo) });
test('card-only name (greeting roster, reply-1 Notebook secret) is not admitted at any scan', () => {
    const chat = [{ mes: GREETING, is_user: false }, { mes: 'I ride to the gate.', is_user: true }, { mes: REPLY1, is_user: false }];
    for (const upTo of [0, 1, 2]) {
        const texts = storyTextsForAdmission(chat, upTo);
        assert.ok(!texts.some(t => t.includes('Edda')));
        const merged = admit(chat, upTo);
        assert.equal(merged.state.npcs.length, 0);
        assert.equal(merged.state.candidates.length, 0);
        assert.deepEqual(merged.report.skipped, ['Edda Rorke']);
    }
});
test('a person named in the greeting prose is admitted at the greeting scan; later messages do not count', () => {
    const chat = [{ mes: 'Captain Rorke eyes the gate.' }, { mes: 'I ask for Edda Rorke.', is_user: true }];
    assert.equal(admit(chat, 0).state.npcs.length, 1);
    const later = [{ mes: GREETING }, { mes: 'I ask for Edda Rorke.', is_user: true }];
    assert.equal(admit(later, 0).state.npcs.length, 0);
    assert.equal(admit(later, 1).state.npcs.length, 1);
    assert.equal(admit([{ mes: GREETING }, { mes: 'Edda Rorke nods.', is_system: true }], 1).state.npcs.length, 0);
});
test('an existing ghost dossier keeps updating, no storyTexts means no check', () => {
    const base = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, ghostRow('Edda Rorke'), { turn: 1 });
    assert.equal(base.state.npcs.length, 1);
    const again = mergeScanResult(base.state, ghostRow('Edda Rorke'), { turn: 2, storyTexts: ['someone'] });
    assert.equal(again.state.npcs.length, 1);
});

// Live run 3: "leader in the gambeson" (a description the scanner wrote for an unnamed man) became a dossier at the second sighting.
import { isDescriptivePhrase } from '../core-identity.js';
test('a descriptive phrase is not admitted as a person; names, role labels and uncased scripts are', () => {
    const row = name => ({ npcs: [{ name, identityKind: 'proper_name', dossierSignal: 'meaningful', present: true, sameIndividual: true }] });
    let state = { npcs: [], candidates: [], turn: 1 };
    for (const turn of [1, 2, 3]) {
        const merged = mergeScanResult(state, row('leader in the gambeson'), { turn, storyTexts: ['The leader in the gambeson shouts.'] });
        state = merged.state;
        assert.deepEqual(merged.report.skipped, ['leader in the gambeson']);
    }
    assert.equal(state.npcs.length, 0);
    assert.equal(state.candidates.length, 0);
    assert.equal(mergeScanResult({ npcs: [], candidates: [], turn: 1 }, row('Marda'), { turn: 1 }).state.npcs.length, 1);
    assert.equal(mergeScanResult({ npcs: [], candidates: [], turn: 1 }, row('the Butcher of Vell'), { turn: 1 }).state.npcs.length, 1);
    assert.equal(mergeScanResult({ npcs: [], candidates: [], turn: 1 }, row('老王'), { turn: 1 }).state.npcs.length, 1);
    assert.equal(isDescriptivePhrase('the innkeeper'), false);
    assert.equal(isDescriptivePhrase('old man'), false);
    assert.equal(isDescriptivePhrase('woman with the scar'), true);
    assert.equal(isDescriptivePhrase('Leader in the gambeson'), true, 'a sentence-cased start');
    for (const name of ['Lady of the Lake', 'Sister Callow', 'Old Garvan of the Seven Stones']) assert.equal(isDescriptivePhrase(name), false, name);
    assert.equal(isDescriptivePhrase('ライラ の 友人 で'), false);
    // A role label with a linking word is admitted as before: a candidate at the first sighting, a dossier at the second.
    for (const label of ['captain of the guard', 'woman in red', 'man with the scar']) {
        const roleRow = { npcs: [{ name: label, identityKind: 'role_label', dossierSignal: 'meaningful', present: true, sameIndividual: true }] };
        const first = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, roleRow, { turn: 1, storyTexts: [`The ${label} waits.`] });
        assert.equal(first.state.candidates.length, 1, `${label}: candidate at sighting 1`);
        const second = mergeScanResult(first.state, roleRow, { turn: 2, storyTexts: [`The ${label} waits.`] });
        assert.equal(second.state.npcs.length, 1, `${label}: dossier at sighting 2`);
    }
    // ...while "leader in the gambeson" stays out whatever kind the scanner gave it, with and without story texts.
    for (const identityKind of ['role_label', 'proper_name']) for (const storyTexts of [['The leader in the gambeson shouts.'], undefined]) {
        let st = { npcs: [], candidates: [], turn: 1 };
        for (const turn of [1, 2, 3]) st = mergeScanResult(st, { npcs: [{ name: 'leader in the gambeson', identityKind, dossierSignal: 'meaningful', present: true, sameIndividual: true }] }, { turn, ...(storyTexts ? { storyTexts } : {}) }).state;
        assert.equal(st.npcs.length + st.candidates.length, 0, `${identityKind} ${storyTexts ? 'with' : 'without'} texts`);
    }
    // A dossier that already exists (made before this rule) keeps updating.
    const had = { npcs: [createNpcRecord('leader in the gambeson', [])], candidates: [], turn: 1 };
    const again = mergeScanResult(had, row('leader in the gambeson'), { turn: 2 });
    assert.equal(again.state.npcs.length, 1);
    assert.deepEqual(again.report.skipped, []);
});
