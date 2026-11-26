// A sentence `~ npc Name | toward:` wrote is marked in the same write (`relationshipSummarySource: 'line'`) and reaches the narrator as written, whatever
// the meters say; any other writer of the summary drops the mark, and its text is calibrated and checked against the meters as before.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__npcMock = { extensionSettings: {}, context: { chat: [{ name: 'Narrator', mes: 'Sister Temiwa says he is a companion she is slowly learning to trust. Partner. Lover. Friend. Rival. Fool. Hero. Mine. Home.', is_user: false }], name1: 'Astra', name2: 'Narrator' }, saveSettingsCalls: 0 };
const { suite, dossiers } = await import('./helpers/pacing-suite.js');
const { buildInjection } = await import('../../modules/people/core/core-injection.js');
const { mergeScanResult, normalizeNpcRecord } = await import('../../modules/people/core/core.js');
const { peopleState, peopleView } = await import('../../modules/people/view.js');
const { validatePeople } = await import('../../modules/people/domain/validate.js');
const { protectTerminalNpc } = await import('../../modules/people/core/terminal-lifecycle.js');
const { preserveTargetManualLocks } = await import('../../modules/people/bundle/bundle-import-helpers.js');
const { applyFocusedRelationshipDecisions } = await import('../../modules/people/relationship/relationship-pass.js');
const { useTranscriptSource } = await import('../../modules/people/transcript/transcript-parts/source.js');
useTranscriptSource({ context: () => globalThis.__npcMock.context });
const { createTargetedRefreshPart } = await import('../../modules/people/calls/runtime-targeted-refresh.js');
const { seedCastAdmission } = await import('../../modules/people/runtime/runtime-cast-sync.js');
const { consolidateAliasLinkedNpcDuplicates } = await import('../../modules/people/core/core-merge-aliases.js');

const PARTNER = 'Her chosen partner, the man she wants beside her.';
// Eight short clauses, past the per-field cuts of both narrator blocks (the calibration keeps six clauses and can reword the strong ones).
const LONG = 'Partner. Lover. Friend. Rival. Fool. Hero. Mine. Home. The man she cannot live without, whom she chose over her own vows at the Ferrybend gate, and whom she now trusts with the keys, the ledger, the children and the last word.';
// The meters allow every word of these, but compaction drops two of the clauses: only the copy guard keeps them all.
const CLAUSES = 'Partner. Lover. Friend. Rival. Fool. Hero. Mine. Home.';
const NEUTRAL = /relationship remains mostly neutral or unsettled/;
const LOW = { trust: 20, affection: 25, desire: 0, tension: 0 };
const start = () => ({ ...dossiers(), npc_temiwa: { ...dossiers().npc_temiwa, relationship: { ...LOW }, fieldChangeMessages: {} } });
const temiwa = s => s.host.head().domains.people.npcs.npc_temiwa;
const snap = s => JSON.stringify(s.host.head().domains.people);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
// The record as NPC State's working copy holds it after a hydrate (runtime-hydration-state.js: every stored record is normalized).
const working = s => peopleState(s.host.head().domains.people).npcs.map(normalizeNpcRecord).find(npc => npc.id === 'npc_temiwa');
const present = npc => buildInjection([{ ...npc, present: true, relationship: { ...LOW } }], 'Sister Temiwa waits.');
const absent = npc => buildInjection([{ ...npc, present: false, relationship: { ...LOW } }], 'I think of Sister Temiwa.');
const told = block => /TOWARD PLAYER \(secondary\): ([^\n]*)/.exec(block)?.[1] ?? '';
const marked = (text = PARTNER, extra = {}) => normalizeNpcRecord({ id: 'npc_temiwa', name: 'Sister Temiwa', relationship: { ...LOW }, relationshipSummary: text, relationshipSummarySource: 'line', ...extra });

test('a toward sentence is marked by its write and reaches the narrator word for word, present or only named, live, after a reload and a Re-read', async () => {
    for (const text of [PARTNER, LONG]) {
        const s = await suite({ lines: true, records: start() });
        const at = await s.say([`~ npc Sister Temiwa | toward: ${text}`]);
        const check = why => {
            assert.equal(temiwa(s).relationshipSummary, text, why);
            assert.equal(temiwa(s).relationshipSummarySource, 'line', why);
            const copy = working(s);
            assert.equal(copy.relationshipSummary, text, `${why}: the working copy`);
            assert.equal(told(present(copy)).startsWith(text), true, `${why}: ${present(copy)}`);
            assert.ok(absent(copy).includes(`toward the player: ${text})`), `${why}: ${absent(copy)}`);
            // NPC State's next write of the working copy keeps the mark, and the store takes it.
            const view = peopleView({ turn: 1, npcs: [copy], candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {} });
            assert.equal(view.npcs.npc_temiwa.relationshipSummarySource, 'line', why);
            assert.deepEqual(validatePeople(view), [], why);
        };
        check('live');
        same(s, 'replay equals live');
        check('rebuild');
        await s.host.turn.onChatChanged();
        check('chat change');
        assert.equal((await s.host.sdk.reread(at)).ok, true);
        check('Re-read');
        same(s, 'Re-read replay equals live');
        await s.say(['~ npc Sister Temiwa | trust: up']);
        check('a later reply');
        same(s, 'later replay equals live');
    }
});

test('a reader edit of the summary through people.edit drops the mark, and replays the same', async () => {
    const s = await suite({ lines: true, records: start() });
    await s.say([`~ npc Sister Temiwa | toward: ${PARTNER}`]);
    assert.equal((await s.host.sdk.command('people.edit', { id: 'npc_temiwa', fields: { relationshipSummary: 'The man she wants beside her.' } })).ok, true);
    assert.equal(temiwa(s).relationshipSummarySource, undefined);
    same(s, 'replay equals live');
});

test('without the mark the same sentence is judged by the meters as before', () => {
    const plain = normalizeNpcRecord({ id: 'npc_temiwa', name: 'Sister Temiwa', relationship: { ...LOW }, relationshipSummary: PARTNER });
    assert.match(told(present(plain)), NEUTRAL);
    const dropped = normalizeNpcRecord({ ...marked(), relationshipSummary: '' });
    assert.equal(dropped.relationshipSummarySource, undefined, 'no mark on an empty summary');
    assert.equal(normalizeNpcRecord({ ...marked(), relationshipSummarySource: 'scan' }).relationshipSummarySource, undefined, 'no other mark is kept');
});

const scan = (existing, relationshipSummary, extra = {}) => mergeScanResult({ turn: 1, npcs: [existing] }, { npcs: [{ id: existing.id, name: existing.name, present: true, relationshipSummary, ...extra }] }, { turn: 2 }).state.npcs[0];

test('a scan that copies the sentence back, or proposes nothing it may write, keeps it and its mark', () => {
    for (const [text, proposal] of [[LONG, LONG], [LONG, `${LONG.slice(0, 230)}…`], [PARTNER, PARTNER], [PARTNER, ''], [PARTNER, 'A stranger to her.']]) {
        const out = scan(marked(text), proposal);
        assert.equal(out.relationshipSummary, text, proposal);
        assert.equal(out.relationshipSummarySource, 'line', proposal);
    }
});

// An accepted relationship event is what lets the focused pass rewrite a summary.
function focused(existing, relationshipSummary) {
    const deed = 'Ari offered Mira shelter.';
    const state = { turn: 2, npcs: [existing] };
    applyFocusedRelationshipDecisions(state, new Map([[existing.id, { relationshipImpact: 'ordinary', relationshipDelta: { trust: 1, affection: 0, desire: 0, tension: 0 },
        relationshipEvidence: { trust: deed, affection: '', desire: '', tension: '' }, relationshipChangeReason: deed, relationshipSummary, relationshipSummaryDecisionProvided: true }]]), undefined, 3);
    assert.equal(state.npcs[0].lastRelationshipChange.reason, deed, 'the event was accepted');
    return state.npcs[0];
}

test('the focused relationship pass keeps a copy of the sentence and drops the mark when it writes its own', () => {
    const copied = focused(marked(CLAUSES), CLAUSES);
    assert.deepEqual([copied.relationshipSummary, copied.relationshipSummarySource], [CLAUSES, 'line']);
    const next = 'A companion she is slowly learning to trust.';
    const out = focused(marked(), next);
    assert.deepEqual([out.relationshipSummary, out.relationshipSummarySource], [next, undefined]);
});

// The Refresh's own last step (afterMerge), taken from the real Refresh part: the shared runner is captured, not run.
async function refreshWith(existing, proposal) {
    let pass = null;
    const part = createTargetedRefreshPart({}, {
        editorIsMounted: () => false, ensureChatStateLoaded: async () => {}, getChatKey: () => 'chat', getChatState: () => ({ turn: 1, npcs: [existing] }),
        hostedMeterView: list => list, hostedTargetNotes: () => null, isScanBusy: () => false, requireReadyChatMutation: () => true, targetNoteOptions: () => ({}),
        runTargetedDossierPass: async options => { pass = options; return true; },
    }, { prepareCanonicalScanBase: async () => true, targetedRowFor: () => null, refreshChangedFields: () => [] });
    assert.equal(await part.refreshNpcFromChat(existing.id), true);
    const refreshed = structuredClone(existing);
    pass.afterMerge(refreshed, { liveBefore: existing, scoped: { match: { relationshipSummary: proposal } } });
    return normalizeNpcRecord(refreshed);
}

test('a Refresh replaces the sentence with its own, drops the mark, and the meters gate applies again', async () => {
    const copied = await refreshWith(marked(CLAUSES), CLAUSES);
    assert.deepEqual([copied.relationshipSummary, copied.relationshipSummarySource], [CLAUSES, 'line'], 'a copy keeps it');
    const next = 'A companion she is slowly learning to trust.';
    const out = await refreshWith(marked(), next);
    assert.deepEqual([out.relationshipSummary, out.relationshipSummarySource], [next, undefined]);
    assert.equal(told(present(out)), next);
    // A later unmarked text the meters do not allow is withheld again.
    assert.match(told(present(normalizeNpcRecord({ ...out, relationshipSummary: PARTNER }))), NEUTRAL);
    // And the calibration rewords strong phrases again.
    assert.match(normalizeNpcRecord({ ...out, relationshipSummary: 'Her partner now; she cannot live without him.' }).relationshipSummary, /relies deeply on/);
});

test('the mark follows the summary through a death and an imported dossier', () => {
    const dead = protectTerminalNpc({ ...marked(), lifeState: 'deceased', lifeStateCertainty: 'explicit' }, { name: 'Sister Temiwa', relationshipSummary: 'Another text.' });
    assert.deepEqual([dead.relationshipSummary, dead.relationshipSummarySource], [PARTNER, 'line']);
    const plain = { name: 'Sister Temiwa', relationshipSummary: 'An old friend.' };
    assert.equal(preserveTargetManualLocks(marked(), plain).relationshipSummarySource, undefined, 'the import\'s own text is not marked');
    assert.equal(preserveTargetManualLocks(marked(), { name: 'Sister Temiwa' }).relationshipSummarySource, 'line', 'an import with no summary keeps the target\'s');
    assert.equal(preserveTargetManualLocks({ ...plain, manualProfileFields: ['relationshipSummary'] }, marked()).relationshipSummarySource, undefined, 'a locked target keeps its own');
    assert.equal(preserveTargetManualLocks(plain, marked()).relationshipSummarySource, 'line', 'a marked import keeps its mark');
});

test('an alias merge keeps the mark only with the sentence it keeps', () => {
    const merge = (a, b) => {
        const next = { npcs: [normalizeNpcRecord(a), normalizeNpcRecord(b)] };
        consolidateAliasLinkedNpcDuplicates(next, { updated: [] });
        assert.equal(next.npcs.length, 1);
        return [next.npcs[0].relationshipSummary, next.npcs[0].relationshipSummarySource];
    };
    const other = { id: 'npc_sister', name: 'The Sister', aliases: ['Sister Temiwa'], identityKind: 'title' };
    assert.deepEqual(merge(marked(LONG), { ...other, relationshipSummary: 'An old friend.' }), [LONG, 'line']);
    const longer = 'A companion she is slowly learning to trust, a little more each week.';
    assert.deepEqual(merge(marked(), { ...other, relationship: { ...LOW }, relationshipSummary: longer }), [longer, undefined]);
});

test('the late pack seed keeps a toward sentence written since the person was admitted, with its mark; the pack\'s own words are not marked', () => {
    const person = { key: 'p:t', pack: 'p', id: 't', name: 'Sister Temiwa', aliases: [], met: {}, entry: { name: 'Sister Temiwa', aliases: [], withYou: 'A stranger at her gate.', start: {}, stages: [], meters: { values: {} }, secrets: [] } };
    const seed = (npc, admitted) => seedCastAdmission({ castSeedPending: { npc_temiwa: { values: { relationshipSummary: admitted } } } }, npc, person);
    const kept = seed(marked(), '');
    assert.deepEqual([kept.relationshipSummary, kept.relationshipSummarySource], [PARTNER, 'line']);
    const packs = seed(marked(), PARTNER);
    assert.deepEqual([packs.relationshipSummary, packs.relationshipSummarySource], ['A stranger at her gate.', undefined]);
});
