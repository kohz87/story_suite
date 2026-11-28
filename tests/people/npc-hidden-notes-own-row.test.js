// Hidden notes a scan writes go to the dossier the row is for: a row carrying a stored dossier's id never gives its notes to a new person who
// answers to the same name (a new Reed admitted beside Orrin Reed, whose nickname is Reed).
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__npcMock ??= { extensionSettings: {} };
const { mergeScanResult, createNpcRecord } = await import('../../modules/people/core/core.js');
const { settleScanRows, followFoldedTies } = await import('../../modules/people/core/core-merge-namesakes.js');
const { resolveInterimIdentityPromotions } = await import('../../modules/people/core/core-development-batch.js');
const { normalizeGeneratedSecrets } = await import('../../modules/people/meters/npc-meters.js');
const { createHostedPart } = await import('../../modules/people/runtime/runtime-hosted.js');
const { pageHandles } = await import('../../modules/people/runtime/handles.js');

const note = who => [{ title: `${who} A`, text: `${who} keeps a debt hidden.`, meter: 'trust', at: 20 }, { title: `${who} B`, text: `${who} once fled a war.`, meter: 'trust', at: 60 }];
const extra = { present: true, identityKind: 'proper_name', dossierSignal: 'persistent', dossierReason: 'named', directInteraction: true };

function run({ idForm = id => id, newFirst = false, newNotes = false } = {}) {
    pageHandles.hosted = true;
    const part = createHostedPart({ peopleAdapter: { hosted: () => true, generatedSecrets: normalizeGeneratedSecrets } }, {});
    const orrin = { ...createNpcRecord('Orrin Reed', []), gender: 'male', role: 'ranger', aliases: ['Reed'] };
    const state = { npcs: [orrin], candidates: [], turn: 3 };
    const a = { ...extra, id: idForm(orrin.id), name: 'Reed', gender: 'male', role: 'ranger', secrets: note('ORRIN') };
    const b = { ...extra, name: 'Reed', gender: 'female', role: 'innkeeper', ...(newNotes ? { secrets: note('NEWREED') } : {}) };
    const parsed = { npcs: newFirst ? [b, a] : [a, b] };
    const named = settleScanRows(state.npcs, parsed, [], false);
    const resolved = resolveInterimIdentityPromotions(named.scanResult, state.npcs, []);
    const merged = mergeScanResult(structuredClone(state), parsed, { turn: 4, sourceMessageId: 1 });
    const kept = rows => followFoldedTies(rows, merged.report.deduplicated);
    part.attachGeneratedSecrets(merged.state, merged.report.created, kept(parsed), kept(resolved), kept(named.scanResult));
    return { orrin: merged.state.npcs.find(npc => npc.id === orrin.id), fresh: merged.state.npcs.find(npc => npc.id !== orrin.id) };
}
const texts = npc => (npc?.secrets ?? []).map(item => item.text).join(' | ');

test('a stored person\'s notes, sent under their id, never land on a new person who shares their nickname', () => {
    const { fresh } = run();
    assert.ok(fresh, 'the new Reed is admitted');
    assert.doesNotMatch(texts(fresh), /ORRIN/);
});

test('the id in another spelling is still the stored person\'s; the new person keeps their own notes in either row order', () => {
    assert.doesNotMatch(texts(run({ idForm: id => id.toUpperCase() }).fresh), /ORRIN/);
    for (const newFirst of [false, true]) assert.match(texts(run({ newNotes: true, newFirst }).fresh), /NEWREED/, `new row first: ${newFirst}`);
});
