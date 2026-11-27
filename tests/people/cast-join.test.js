// The hidden `join` field of a world cast entry: the pack check, the dossier (castFrom.join), the narrator's line (only while the person is
// not in the party) and the reader's views, none of which show it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkWorldCast } from '../../packs/validate/world-pack-parts/cast-world.js';
import { buildInjection, createNpcRecord, normalizeNpcRecord } from '../../modules/people/core/core.js';
import { injectionOptionalFields } from '../../modules/people/core/core-injection-parts-parts/optional-fields.js';
import { JOIN_LINE, hideJoinLines } from '../../modules/people/core/core-injection-parts-parts/join-line.js';
import { applyCastEntry, castView, linkToCast, normalizeCast } from '../../modules/people/dossier/cast-dossier.js';
import { peopleQueries } from '../../modules/people/domain/queries.js';
import { dossierFields } from '../../modules/people/adapter/queries-dossier.js';
import { redactSentOf, sentText } from '../../core/sent/sent.js';

// The runtime reads the host's stubs when it loads.
globalThis.__npcMock ??= { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };
const { createInjectionPart } = await import('../../modules/people/runtime/runtime-injection.js');

const WORDS = 'once You (and no one else); keep her secret: the lighthouse oath';
const entry = (extra = {}) => ({ kind: 'companion', id: 'fenna', name: 'Fenna', role: 'Ferrywoman', history: 'Runs the night ferry.', join: WORDS, ...extra });
const [person] = normalizeCast([{ key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', name: 'Fenna', met: { on: 0, where: 'The quay' }, entry: entry() }]);
const made = () => normalizeNpcRecord(applyCastEntry(createNpcRecord('Fenna', []), person, { packName: 'Ersveil' }));
const present = () => ({ ...made(), id: 'npc_fenna', present: true });
const inject = (npc, options = {}, budget) => buildInjection([npc], 'Fenna ties up the ferry.', 1, 3, undefined, budget, null, options);

function check(join) {
    const warnings = [];
    const other = { kind: 'figure', id: 'orrin', name: 'Orrin' };
    const kept = checkWorldCast([entry({ join }), other], 'ersveil', () => {}, (code, path, message) => warnings.push({ path, message }), true);
    return { kept, warnings };
}

test('the pack check keeps plain text of 1 to 400 characters and refuses that person alone otherwise', () => {
    assert.equal(check(WORDS).kept[0].join, WORDS);
    assert.equal(check('x'.repeat(400)).kept[0].join.length, 400);
    for (const bad of ['x'.repeat(401), '', 'a <b> tag', 'a {macro}', 7, ['text']]) {
        const { kept, warnings } = check(bad);
        assert.deepEqual(kept.map(one => one.id), ['orrin'], JSON.stringify(bad));
        assert.equal(warnings[0].path, 'content.cast[0].join');
        assert.match(warnings[0].message, /join must be plain text of 1 to 400 characters/);
    }
});

test('the dossier keeps the words in castFrom, through the normalizer and a later link', () => {
    assert.equal(made().castFrom.join, WORDS);
    assert.equal(normalizeNpcRecord(made()).castFrom.join, WORDS);
    assert.equal(linkToCast(createNpcRecord('Fenna', []), person).castFrom.join, WORDS);
    const [plain] = normalizeCast([{ key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', name: 'Fenna', met: { on: 0, where: '' }, entry: entry({ join: undefined }) }]);
    assert.equal(Object.hasOwn(applyCastEntry(createNpcRecord('Fenna', []), plain).castFrom, 'join'), false);
});

test('the narrator is told once while the person is not in the party, and not once they are', () => {
    const text = inject(present());
    assert.equal(text.split(JOIN_LINE(WORDS)).length, 2, text);
    assert.ok(text.indexOf('background: Runs the night ferry.') < text.indexOf('would join the party:'), 'after background');
    assert.ok(!inject(present(), { partyIds: new Set(['npc_fenna']) }).includes('would join'));
    assert.ok(inject(present(), { partyIds: new Set(['npc_other']) }).includes(JOIN_LINE(WORDS)));
    assert.equal(injectionOptionalFields(present()).at(-1), JOIN_LINE(WORDS));
});

test('under a shrinking budget the line goes whole, before the essentials and no later than the background', () => {
    const npc = { ...present(), memories: Array.from({ length: 5 }, (_, i) => `${i} ${'remembers the flood '.repeat(8)}`), personality: 'Stubborn and kind. '.repeat(40) };
    let without = 0;
    for (let budget = 1800; budget >= 100; budget -= 50) {
        const text = inject(npc, {}, budget);
        assert.match(text, /- Fenna: IDENTITY/, String(budget));
        if (text.includes('would join')) assert.ok(text.includes(JOIN_LINE(WORDS)), `${budget}: ${text}`);
        else without += 1;
    }
    assert.ok(without > 0, 'some budget leaves it out');
});

test('the dossier queries, the cast block and "What\'s sent" never carry the words', () => {
    const npc = present();
    const state = { domains: { people: { npcs: { npc_fenna: npc }, order: ['npc_fenna'] } } };
    const queries = peopleQueries('people');
    for (const view of [queries['people.dossier'](state, { id: 'npc_fenna' }), queries['people.list'](state, {}), dossierFields(npc), castView(npc, person)]) {
        assert.ok(!JSON.stringify(view).includes('lighthouse'), JSON.stringify(view));
    }
    const sent = inject(npc);
    assert.ok(sent.includes('lighthouse'));
    const shown = hideJoinLines(sent);
    assert.ok(!shown.includes('lighthouse') && !shown.includes('would join'), shown);
    assert.match(shown, /background: Runs the night ferry\./);
    const registry = { module: () => ({ hooks: { redactSent: hideJoinLines } }) };
    assert.ok(!sentText([], [{ module: 'people', label: 'NPC State', text: sent }], { redact: redactSentOf(registry) }).copy.includes('lighthouse'));
});

test('a line cut short by a budget is still hidden, and the lines after it stay', () => {
    const line = `- Fenna: x; ${JOIN_LINE(WORDS)}`;
    assert.equal(hideJoinLines(`${line}\n- Orrin: y`), '- Fenna: x\n- Orrin: y');
    assert.equal(hideJoinLines(`${line.slice(0, line.indexOf('lighthouse') + 5)}…\n- Orrin: y`), '- Fenna: x\n- Orrin: y');
});

test('the sent dossier asks `party.levels` who is in the party: a member goes without the line, one who left keeps it', () => {
    const settings = { injectLimit: 3, injectBudgetTokens: 1800 };
    const liveText = levels => createInjectionPart({}, {
        awayReturnNotes: () => null, scenePresenceView: npcs => npcs, hostedMeterView: npcs => npcs,
        adapterMeters: () => (levels === undefined ? null : { partyLevelsAnswer: () => levels }),
    }).liveInjectionText({ npcs: [present()], turn: 1 }, settings, { namedNpcIds: [], transcript: 'Fenna ties up the ferry.' });
    assert.ok(liveText(undefined).includes('would join'), 'no host');
    assert.ok(liveText(null).includes('would join'), 'the RPG off');
    assert.ok(liveText([{ name: 'Orrin', left: false }]).includes('would join'));
    assert.ok(liveText([{ name: 'Fenna', left: true }]).includes('would join'));
    assert.ok(!liveText([{ name: 'fenna', left: false }]).includes('would join'));
    // The diagnostics dialog reads the last sent text through `injectionPreview`.
    const preview = createInjectionPart({ lastInjection: { text: liveText(null) } }, { getChatKey: () => 'no-chat' }).injectionPreview();
    assert.ok(preview.sending && !preview.text.includes('lighthouse'), preview.text);
});
