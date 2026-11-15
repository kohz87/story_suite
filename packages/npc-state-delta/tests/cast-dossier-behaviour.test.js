import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInjection, createNpcRecord, mergeScanResult, normalizeNpcRecord as normalizeProduction } from '../core.js';
import { normalizeNpcRecord } from '../core-mechanics.js';
import { applyCastEntry, normalizeCast, normalizeEntry } from '../src/cast-dossier.js';
import { TEMIWA_ENTRY, dateText, person, temiwaPerson } from './cast-dossier.helpers.js';

const LEVER_LABELS = ['Disposition', 'Care', 'Expression', 'Independence', 'Conflict', 'Threat', 'Analytical', 'Presentation', 'Mercy', 'Loyalty', 'Drive', 'Honesty'];
const TEMIWA_BEHAVIOUR = [
    'Mercy: low - stitches those who annoy her slower than she must, and enjoys it',
    'Care: high - fiercely protective of the dead',
    'Loyalty: high - once someone matters she cannot let go',
    'Independence: high - refuses to be used; balks at being anyone\'s tool',
    'Presentation: high - knows how people look at her and plays on it',
];
const TEMIWA_MANNERISMS = ['A weary smirk when she catches someone looking', 'Laughs a little too easily at pain'];
const TEMIWA_WITH_YOU = 'Jealous once you matter: cold cruelty to rivals, sudden sweetness to you (the sweetness is scarier). Tension rises when you\'re with other companions; losing you would be losing a body to the Veil.';
const BEHAVED = { ...TEMIWA_ENTRY, behaviour: TEMIWA_BEHAVIOUR, mannerisms: TEMIWA_MANNERISMS, withYou: TEMIWA_WITH_YOU };
const applyTemiwa = entry => applyCastEntry(createNpcRecord('Temiwa', []), temiwaPerson(entry), { packName: 'Ersveil' });

test('behaviour, mannerisms and withYou are read: levers in Delta\'s form, lists bounded, texts cut; absent they are empty', () => {
    const entry = normalizeEntry(BEHAVED);
    assert.deepEqual(entry.behaviour, TEMIWA_BEHAVIOUR);
    assert.deepEqual(entry.mannerisms, TEMIWA_MANNERISMS);
    assert.equal(entry.withYou, TEMIWA_WITH_YOU);
    const none = normalizeEntry(TEMIWA_ENTRY);
    assert.deepEqual([none.behaviour, none.mannerisms, none.withYou], [[], [], '']);
    assert.equal(normalizeEntry({ ...TEMIWA_ENTRY, withYou: 'w'.repeat(500) }).withYou.length, 400);
    assert.deepEqual(normalizeEntry({ ...TEMIWA_ENTRY, behaviour: 'Care: high - kind', mannerisms: { a: 1 } }).behaviour, [], 'not a list: nothing');
    // The level is read in any case and written low|medium|high; a dash of any kind separates the effect.
    assert.deepEqual(normalizeEntry({ ...TEMIWA_ENTRY, behaviour: ['care : HIGH – kind to the sick', 'Mercy: Medium — spares the beaten'] }).behaviour,
        ['care: high - kind to the sick', 'Mercy: medium - spares the beaten']);
});

test('bad items are skipped, the good ones stay in order: no level, an unknown label, a habit, about the player or a named person, a repeat of a kind, a non-string', () => {
    const behaviour = normalizeEntry({ ...TEMIWA_ENTRY, behaviour: [
        'Care: high - protective of the dead',
        'Care: extreme - too much', 'Care - no level at all', 'Weather: low - gloomy', 'Habits: high - sharpens knives',
        'Conflict: high - cold with the player', 'Loyalty: high - devoted toward Marris',
        'Care: low - a second care lever merges with the first', 42, null, { lever: 'Drive' },
        'Drive: medium - keeps going',
    ] }).behaviour;
    assert.deepEqual(behaviour, ['Care: high - protective of the dead', 'Drive: medium - keeps going']);
    const many = LEVER_LABELS.map(label => `${label}: low - an effect`);
    assert.equal(normalizeEntry({ ...TEMIWA_ENTRY, behaviour: many }).behaviour.length, 6, 'at most six');
    assert.ok(normalizeEntry({ ...TEMIWA_ENTRY, behaviour: [`Care: high - ${'long '.repeat(80)}`] }).behaviour[0].length <= 180, 'a lever is cut at Delta\'s 180');
    const habits = normalizeEntry({ ...TEMIWA_ENTRY, mannerisms: ['Taps her pendant', 42, '', 'Taps her pendant', 'Hums a river song', 'Chews willow bark', 'Folds her sash', 'Counts the exits', `${'x '.repeat(120)}`] }).mannerisms;
    assert.deepEqual(habits, ['Taps her pendant', 'Hums a river song', 'Chews willow bark', 'Folds her sash'], 'a repeat is skipped, at most four');
    assert.ok(normalizeEntry({ ...TEMIWA_ENTRY, mannerisms: ['y '.repeat(200)] }).mannerisms[0].length <= 160, 'a mannerism is cut at Delta\'s 160');
});

test('every lever form survives normalizeNpcRecord unchanged: each of the 12 labels at each level, and the six together', () => {
    for (const label of LEVER_LABELS) {
        for (const level of ['low', 'medium', 'high']) {
            const line = `${label}: ${level} - holds a thought, "quoted"; a second clause, with commas (and brackets) — and a dash`;
            const entry = normalizeEntry({ ...TEMIWA_ENTRY, behaviour: [line] });
            assert.deepEqual(entry.behaviour, [line], `${label} ${level} is read as written`);
            const made = normalizeNpcRecord(applyTemiwa({ ...TEMIWA_ENTRY, behaviour: [line] }));
            assert.deepEqual(made.behaviorProfile, [line], `${label} ${level} is stored as written`);
            assert.deepEqual(normalizeNpcRecord(structuredClone(made)).behaviorProfile, [line], `${label} ${level} on the next load`);
        }
    }
    const six = LEVER_LABELS.slice(0, 6).map((label, index) => `${label}: ${['low', 'medium', 'high'][index % 3]} - the ${label.toLowerCase()} effect`);
    assert.deepEqual(normalizeNpcRecord(applyTemiwa({ ...TEMIWA_ENTRY, behaviour: six })).behaviorProfile, six);
    const other = LEVER_LABELS.slice(6).map((label, index) => `${label}: ${['high', 'medium', 'low'][index % 3]} - the ${label.toLowerCase()} effect`);
    assert.deepEqual(normalizeNpcRecord(applyTemiwa({ ...TEMIWA_ENTRY, behaviour: other })).behaviorProfile, other);
    assert.deepEqual(normalizeNpcRecord(applyTemiwa(BEHAVED)).behaviorProfile, TEMIWA_BEHAVIOUR);
    assert.deepEqual(normalizeNpcRecord(applyTemiwa(BEHAVED)).mannerisms, TEMIWA_MANNERISMS);
});

test('the made dossier: levers to the behavioral profile, mannerisms to mannerisms, withYou to the relationship summary; castFrom.first keeps them', () => {
    const made = applyTemiwa(BEHAVED);
    assert.deepEqual(made.behaviorProfile, TEMIWA_BEHAVIOUR);
    assert.deepEqual(made.mannerisms, TEMIWA_MANNERISMS);
    assert.equal(made.relationshipSummary, TEMIWA_WITH_YOU);
    assert.deepEqual(made.castFrom.first.behaviorProfile, TEMIWA_BEHAVIOUR);
    assert.deepEqual(made.castFrom.first.mannerisms, TEMIWA_MANNERISMS);
    assert.equal(made.castFrom.first.relationshipSummary, undefined, 'the summary is not a kept pack word: it is compacted and calibrated like any summary');
    assert.equal(made.personality, '', 'the personality is the personality field alone');
    const stored = normalizeProduction(made);
    assert.ok(stored.relationshipSummary.length <= 320 && /^Jealous once you matter/.test(stored.relationshipSummary), 'withYou is stored as any summary is (at most 320)');
});

test('an entry without the fields makes the dossier it made before: nothing set, no new castFrom.first keys', () => {
    const made = applyTemiwa(TEMIWA_ENTRY);
    const base = createNpcRecord('Temiwa', []);
    assert.deepEqual([made.behaviorProfile, made.mannerisms, made.relationshipSummary], [base.behaviorProfile, base.mannerisms, base.relationshipSummary]);
    assert.deepEqual(Object.keys(made.castFrom.first).sort(), ['appearance', 'overallAppearance']);
    const partial = applyTemiwa({ ...TEMIWA_ENTRY, withYou: 'Wary of you.' });
    assert.deepEqual([partial.behaviorProfile, partial.mannerisms], [base.behaviorProfile, base.mannerisms]);
    assert.deepEqual(Object.keys(partial.castFrom.first).sort(), ['appearance', 'overallAppearance']);
    // Fenna's entry (no wears, no new fields) is as it was.
    const [p] = normalizeCast([person()], dateText);
    assert.deepEqual(Object.keys(applyCastEntry(createNpcRecord('Fenna', []), p).castFrom.first).sort(), ['background', 'overallAppearance', 'personality', 'speech']);
});

const LEAK = 'Jealous once you matter: cold cruelty to rivals, sudden sweetness to you. She would do anything for you and cannot live without you.';
const away = npc => ({ ...npc, present: false });
const referenceLine = npc => buildInjection([away(npc)], 'People talk about Temiwa at the inn.', 3, 3).split('\n').find(line => line.includes('mentioned, not present')) ?? '';

test('round 2: the pack\'s withYou is stored calibrated and compacted like any summary, once and for good (no uncalibrated exception)', () => {
    const made = normalizeProduction(applyTemiwa({ ...TEMIWA_ENTRY, withYou: LEAK }));
    assert.doesNotMatch(made.relationshipSummary, /would do anything for|cannot live without/i, 'calibrated against the 0 numbers');
    assert.match(made.relationshipSummary, /cares deeply for you/);
    assert.equal(normalizeProduction(structuredClone(made)).relationshipSummary, made.relationshipSummary, 'the same on the next load');
    const long = normalizeProduction(applyTemiwa({ ...TEMIWA_ENTRY, withYou: `${'She keeps a ledger of every kindness you have shown her. '.repeat(8)}`.trim().slice(0, 400) }));
    assert.ok(long.relationshipSummary.length <= 320, 'a long withYou is compacted to the stored limit, as any summary');
    // The first scanner merge (a mood-only update) leaves the stored summary exactly as it was stored at the first meeting.
    const merged = mergeScanResult({ npcs: [made], turn: 2 }, { npcs: [{ id: made.id, name: made.name, mood: 'calm' }] }, { turn: 3, sourceMessageId: 9 }).state.npcs[0];
    assert.equal(merged.relationshipSummary, made.relationshipSummary, 'the first merge changes nothing in the summary');
});

test('round 2 (reviewer\'s leak): a named-but-away cast person never shows an unsupported claim; present shows the neutral line; a supported summary shows in both', () => {
    const made = normalizeProduction(applyTemiwa({ ...TEMIWA_ENTRY, withYou: LEAK }));
    const scene = 'Temiwa stands at the north gate.';
    assert.match(buildInjection([{ ...made, present: true }], scene, 3, 3), /TOWARD PLAYER \(secondary\): relationship remains mostly neutral/);
    const line = referenceLine(made);
    assert.match(line, /Temiwa \(mentioned, not present/);
    assert.doesNotMatch(line, /toward the player|Jealous|anything for|live without/i);
    const mild = normalizeProduction(applyTemiwa({ ...TEMIWA_ENTRY, withYou: 'Wary of you, but curious; tests your patience before she trusts.' }));
    assert.match(buildInjection([{ ...mild, present: true }], scene, 3, 3), /TOWARD PLAYER \(secondary\): Wary of you, but curious/);
    assert.match(referenceLine(mild), /toward the player: Wary of you, but curious/);
});

test('round 2: a dossier that is not from the cast keeps its reference line exactly as stored (no calibration, no gate)', () => {
    const plain = normalizeProduction({ ...createNpcRecord('Temiwa', []), role: 'courier', homeBase: 'gate', relationshipSummary: 'Jealous once you matter: cold cruelty to rivals.' });
    assert.match(referenceLine(plain), /toward the player: Jealous once you matter: cold cruelty to rivals\./);
});

test('the pack\'s levers and mannerisms are kept whole while the stored list is the pack\'s list; a changed list is normalized like any other', () => {
    const made = normalizeProduction(applyTemiwa(BEHAVED));
    // A list that Delta's normalizer would shorten stays when it is the recorded pack list.
    const odd = { ...made, behaviorProfile: ['Care: high - kind', 'Care: low - merges into the first'], mannerisms: ['Taps her pendant twice', 'Taps her pendant twice, again'], castFrom: { ...made.castFrom, first: { behaviorProfile: ['Care: high - kind', 'Care: low - merges into the first'], mannerisms: ['Taps her pendant twice', 'Taps her pendant twice, again'] } } };
    assert.equal(normalizeProduction(odd).behaviorProfile.length, 2);
    assert.equal(normalizeProduction(odd).mannerisms.length, 2);
    // After the scanner or the reader changes a list the normal rules apply again.
    const changed = normalizeProduction({ ...odd, behaviorProfile: [...odd.behaviorProfile, 'Drive: high - keeps going'], mannerisms: [...odd.mannerisms, 'Hums'] });
    assert.equal(changed.behaviorProfile.length, 2, 'the two Care levers merge: normal compaction');
    assert.equal(changed.mannerisms.length < 3, true);
    // Recorded pack words under another key do not hold a list.
    const wrongKey = normalizeProduction({ ...odd, castFrom: { ...odd.castFrom, first: { mannerisms: ['Taps her pendant twice', 'Taps her pendant twice, again'] } } });
    assert.equal(wrongKey.behaviorProfile.length, 1);
});

test('a scanner refinement of the cast levers and mannerisms applies as for any dossier (no new rule)', () => {
    const made = normalizeProduction(applyTemiwa(BEHAVED));
    const scene = 'Temiwa hummed over the stitches, tapping her pendant, then laughed too easily when the boy cried out; she waits until the dead are covered before she eats.';
    const out = mergeScanResult({ npcs: [made], turn: 2 }, { profileUpdates: [{
        id: made.id, evidence: { mannerisms: [scene] }, mannerisms: [...TEMIWA_MANNERISMS, 'Hums over her stitches'], mannerismState: 'evolve',
        developmentReason: 'She hums while stitching.',
    }] }, { turn: 3, sourceMessageId: 9, developmentContext: scene }).state.npcs[0];
    assert.deepEqual(out.behaviorProfile, TEMIWA_BEHAVIOUR, 'untouched fields stay');
    assert.ok(out.mannerisms.length >= 2);
});

test('dossiers made before are read as stored: no migration', () => {
    const before = { ...createNpcRecord('Fenna', []), personality: 'Stubborn.', behaviorProfile: ['Care: practical - helps through actions'], mannerisms: ['Coils rope'], relationshipSummary: 'She trusts you a little.', castFrom: { key: 'ersveil:fenna', first: { personality: 'Stubborn.' } } };
    const stored = normalizeProduction(before);
    assert.deepEqual([stored.behaviorProfile, stored.mannerisms, stored.relationshipSummary], [before.behaviorProfile, before.mannerisms, before.relationshipSummary]);
    assert.deepEqual(stored.castFrom, before.castFrom);
});

test('the narrator hears a cast person\'s levers, mannerisms and summary: injection already prints these fields, so the block only has more to print', () => {
    const plain = normalizeProduction({ ...applyTemiwa(TEMIWA_ENTRY), present: true });
    const behaved = normalizeProduction({ ...applyTemiwa(BEHAVED), present: true });
    const scene = 'Temiwa stands at the north gate.';
    const a = buildInjection([plain], scene, 3, 3);
    const b = buildInjection([behaved], scene, 3, 3);
    assert.doesNotMatch(a, /behavioral profile|mannerisms:/);
    assert.match(b, /mannerisms: A weary smirk when she catches someone looking, Laughs a little too easily at pain/);
    assert.match(b, /behavioral profile: /);
    assert.match(b, /Care: high/);
    // The summary is stored whole, but injection is unchanged: it prints the summary only while it agrees with the numbers (a
    // "jealous once you matter" claim at the starting 0s does not), and otherwise the numbers' own guidance, as for any dossier.
    assert.match(b, /TOWARD PLAYER \(secondary\): relationship remains mostly neutral/);
    const mild = normalizeProduction({ ...applyTemiwa({ ...BEHAVED, withYou: 'Wary of you, but curious; tests your patience before she trusts.' }), present: true });
    assert.match(buildInjection([mild], scene, 3, 3), /TOWARD PLAYER \(secondary\): Wary of you, but curious; tests your patience before she trusts\./);
    process.stdout.write(`\n[injection with the fields]\n${b}\n`);
});
