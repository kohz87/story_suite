import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInjection, createNpcRecord, mergeScanResult, normalizeNpcRecord as normalizeProduction } from '../../modules/people/core/core.js';
import { normalizeNpcRecord } from '../../modules/people/core/core-mechanics.js';
import { currentPresentationText, normalizeAppearanceModel, resolveNpcAppearance } from '../../modules/people/appearance/appearance.js';
import { applyCastEntry, normalizeEntry } from '../../modules/people/dossier/cast-dossier.js';
import { TEMIWA_ENTRY, madeTemiwa, temiwaPerson } from './cast-dossier.helpers.js';

const TEMIWA_SCENE = 'Temiwa stood slender, amber eyes bright, russet fur damp, white-tipped tail showing: the veil pinned back and the tail in a grey linen wrap.';
const temiwaScan = npc => mergeScanResult({ npcs: [npc], turn: 2 }, { profileUpdates: [{
    id: npc.id, evidence: { appearance: [TEMIWA_SCENE] },
    overallAppearance: 'Slender fox-woman, amber eyes, russet fur, white-tipped tail',
    appearance: 'Veil pinned back, tail in a grey linen wrap', appearanceState: 'change',
    appearanceReason: 'The veil is pinned back and the tail is in a grey linen wrap.',
}] }, { turn: 3, sourceMessageId: 9, developmentContext: TEMIWA_SCENE }).state.npcs[0];
const BODY = /fox-woman|amber eyes|russet fur|white-tipped tail/i;
const OUTFIT = /veil|sash|pendant|linen|gauze/i;

test('wears is read like look: cut to 1800 characters and flattened; absent it is empty', () => {
    const entry = normalizeEntry({ ...TEMIWA_ENTRY, wears: `a\n\n${'word '.repeat(700)}` });
    assert.ok(entry.wears.length <= 1800 && !/\n/.test(entry.wears));
    assert.equal(normalizeEntry({ ...TEMIWA_ENTRY, wears: undefined }).wears, '');
    assert.equal(normalizeEntry({ ...TEMIWA_ENTRY, wears: 42 }).wears, '42', 'any value is read as text like look');
    assert.equal(temiwaPerson().entry.wears, TEMIWA_ENTRY.wears, 'it comes through the answer for a met person');
});

test('a cast entry with wears: look is the physical appearance, wears the current one, each in the pack\'s exact words', () => {
    const made = madeTemiwa();
    assert.equal(made.overallAppearance, TEMIWA_ENTRY.look, 'look → physical');
    assert.equal(currentPresentationText(made), TEMIWA_ENTRY.wears, 'wears → current appearance');
    assert.doesNotMatch(made.overallAppearance, OUTFIT, 'no clothing in the physical text');
    assert.doesNotMatch(currentPresentationText(made), BODY, 'no body in the current text');
    assert.equal(made.currentForm, '');
    assert.deepEqual(made.appearanceForms, []);
    assert.deepEqual(made.castFrom.first, { overallAppearance: TEMIWA_ENTRY.look, appearance: TEMIWA_ENTRY.wears }, 'the pack\'s words per field');
    const raw = applyCastEntry(createNpcRecord('Temiwa', []), temiwaPerson(), { packName: 'Ersveil' });
    assert.equal(raw.overallAppearance, TEMIWA_ENTRY.look);
    assert.equal(raw.appearance, TEMIWA_ENTRY.wears, 'the record before normalization: current = wears alone');
    // What the narrator hears: the body and the outfit, each once.
    const shown = resolveNpcAppearance(made);
    assert.equal(shown.split('white-tipped tail').length - 1, 1, 'the body words once, not restated by the outfit');
    assert.match(buildInjection([{ ...made, present: true }], 'Temiwa is here.', 1), /flame-cross pendants/);
    // Idempotent: normalizing again changes nothing.
    const again = normalizeProduction(structuredClone(made));
    assert.deepEqual([again.overallAppearance, again.appearance, currentPresentationText(again)], [made.overallAppearance, made.appearance, currentPresentationText(made)]);
});

test('an older entry without wears: look is the physical appearance whole, the current appearance is left empty for the scanner', () => {
    const made = madeTemiwa({ ...TEMIWA_ENTRY, wears: undefined });
    assert.equal(made.overallAppearance, TEMIWA_ENTRY.look);
    assert.equal(currentPresentationText(made), '', 'nothing in the current slot');
    assert.equal(normalizeAppearanceModel(made).appearance, made.appearance);
    assert.equal(resolveNpcAppearance(made), TEMIWA_ENTRY.look, 'the narrator still hears the pack\'s look');
    assert.deepEqual(made.castFrom.first, { overallAppearance: TEMIWA_ENTRY.look }, 'no pack words are recorded for the current appearance');
    assert.ok(!applyCastEntry(createNpcRecord('Temiwa', []), temiwaPerson({ ...TEMIWA_ENTRY, wears: undefined }), {}).appearance, 'the raw record leaves appearance empty');
    // An entry with neither sets neither.
    const bare = applyCastEntry(createNpcRecord('Temiwa', []), temiwaPerson({ ...TEMIWA_ENTRY, look: '', wears: '' }), {});
    assert.ok(!bare.overallAppearance && !bare.appearance);
    assert.deepEqual(bare.castFrom.first, {});
    // Only wears (no look): the outfit is the current appearance and the physical slot is left for the scanner.
    const onlyWears = madeTemiwa({ ...TEMIWA_ENTRY, look: '' });
    assert.equal(onlyWears.overallAppearance, '');
    assert.equal(onlyWears.appearance, TEMIWA_ENTRY.wears);
});

test('the pack\'s words per field are kept while unchanged and follow the new keys (normalizeNpcRecord)', () => {
    const long = `Veil of grey gauze. ${Array.from({ length: 30 }, (_, i) => `Pendant number ${i} of carved bone on a thin cord`).join('. ')}.`;
    assert.ok(long.length > 1000);
    const made = madeTemiwa({ ...TEMIWA_ENTRY, wears: long });
    // The mechanics layer (before the appearance model resolves) keeps the pack's exact words for a field that still is them…
    const kept = normalizeNpcRecord({ ...createNpcRecord('Temiwa', []), appearance: long, castFrom: { key: 'k', first: { appearance: long } } });
    assert.equal(kept.appearance, long);
    // …and compacts a field that no longer is, or one with no pack words recorded under that key.
    const changed = normalizeNpcRecord({ ...createNpcRecord('Temiwa', []), appearance: `${long} Also a bell.`, castFrom: { key: 'k', first: { appearance: long } } });
    assert.notEqual(changed.appearance, `${long} Also a bell.`);
    const oldKey = normalizeNpcRecord({ ...createNpcRecord('Temiwa', []), appearance: long, castFrom: { key: 'k', first: { overallAppearance: long } } });
    assert.notEqual(oldKey.appearance, long, 'a pack word kept under overallAppearance does not hold current appearance');
});

test('the user\'s case: a scanner result on a dossier made from the entry keeps the body out of the outfit and the outfit out of the body, the tail once', () => {
    const made = madeTemiwa();
    const scanned = temiwaScan(made);
    assert.equal(scanned.overallAppearance, TEMIWA_ENTRY.look, 'the scene\'s physical words equal the pack\'s: unchanged');
    assert.doesNotMatch(scanned.overallAppearance, OUTFIT, 'physical has no clothing');
    const current = currentPresentationText(scanned);
    assert.equal(current, 'Veil pinned back, tail in a grey linen wrap', 'current has the outfit');
    assert.doesNotMatch(current, BODY);
    assert.equal(resolveNpcAppearance(scanned).match(/tail/gi).length, 2, 'one tail in the body words, one in the outfit: not the same tail described in two ways');
    assert.doesNotMatch(scanned.appearance, /sash|pendants/, 'the old outfit is replaced, not stacked');
    assert.ok(!/;\s*\d+\.\s*;/.test(scanned.appearance) && !/\b21\b/.test(scanned.appearance));
    assert.equal(scanned.appearanceForms.length, 0, 'no form was invented');
    assert.equal(scanned.unclassifiedAppearance, '');
    assert.equal(scanned.castFrom.first.appearance, TEMIWA_ENTRY.wears, 'the pack\'s words stay recorded as given');
    assert.equal(scanned.castFrom.first.overallAppearance, TEMIWA_ENTRY.look);
    // …and the same on the next normalization.
    const again = normalizeProduction(structuredClone(scanned));
    assert.deepEqual([again.overallAppearance, currentPresentationText(again)], [scanned.overallAppearance, current]);
});

test('the user\'s case on an older entry (no wears): the scanner fills the current appearance, the physical text stays the pack\'s look', () => {
    const made = madeTemiwa({ ...TEMIWA_ENTRY, wears: undefined });
    const scanned = temiwaScan(made);
    assert.equal(scanned.overallAppearance, TEMIWA_ENTRY.look);
    assert.doesNotMatch(scanned.overallAppearance, OUTFIT);
    assert.equal(currentPresentationText(scanned), 'Veil pinned back, tail in a grey linen wrap');
    assert.equal(scanned.appearance.match(/white-tipped tail/gi).length, 1, 'the body words once');
});

const sameWords = text => String(text).replace(/\.;\s/g, '. ');
// Whole sentences, each different, joined up to `max` characters.
const sentences = (label, max) => {
    const out = [];
    for (let i = 1; ; i += 1) {
        const next = [...out, `${label} ${i} of oiled leather with brass buckles and a stitched hem`].join('. ');
        if (next.length + 1 > max) break;
        out.push(`${label} ${i} of oiled leather with brass buckles and a stitched hem`);
    }
    return `${out.join('. ')}.`;
};
const LONG_LOOK = sentences('Body trait', 600);
const LONG_WEARS = sentences('Outfit piece', 300);

test('B1: a long look (600) and a long wears (300) are kept whole at creation and after every normalization; all outfit sentences stay', () => {
    assert.ok(LONG_LOOK.length > 500 && LONG_WEARS.length > 250 && LONG_LOOK.length <= 600 && LONG_WEARS.length <= 300 && (LONG_LOOK.match(/\./g) || []).length > 6 && (LONG_WEARS.match(/\./g) || []).length >= 4, 'a fixture beyond the old canon (10 sentences, 800 characters in all)');
    const entry = { ...TEMIWA_ENTRY, look: LONG_LOOK, wears: LONG_WEARS };
    const made = madeTemiwa(entry);
    assert.ok(`${LONG_LOOK}; ${LONG_WEARS}`.length > 800, 'together over the old 800');
    assert.equal(made.overallAppearance, LONG_LOOK);
    assert.equal(sameWords(currentPresentationText(made)), LONG_WEARS, 'every outfit sentence, whole');
    assert.equal(made.appearance, `${LONG_LOOK.replace(/[\s.;,]+$/, '')}; ${LONG_WEARS}`, 'the resolved text is body then outfit, unclipped');
    let again = made;
    for (let i = 0; i < 3; i += 1) again = normalizeProduction(structuredClone(again));
    assert.deepEqual([again.overallAppearance, again.appearance], [made.overallAppearance, made.appearance], 'normalized again and again: identical');
    assert.equal(sameWords(currentPresentationText(again)), LONG_WEARS);
    // The mechanics layer alone (a save/load of the stored record) keeps it too.
    const stored = normalizeNpcRecord(structuredClone(made));
    assert.equal(stored.appearance, made.appearance);
    assert.match(resolveNpcAppearance(again), /Outfit piece 4/);
});

test('F2: a look beyond 800 characters is kept whole (physical and resolved), with or without wears', () => {
    const look = sentences('Body trait', 1500);
    assert.ok(look.length > 1000);
    const noWears = madeTemiwa({ ...TEMIWA_ENTRY, look, wears: undefined });
    assert.equal(noWears.overallAppearance, look);
    assert.equal(noWears.appearance, look, 'the narrator and portrait get the whole look');
    assert.equal(normalizeProduction(structuredClone(noWears)).appearance, look, 'and after the next load');
    const withWears = madeTemiwa({ ...TEMIWA_ENTRY, look, wears: LONG_WEARS });
    assert.equal(withWears.overallAppearance, look);
    assert.equal(sameWords(currentPresentationText(normalizeProduction(structuredClone(withWears)))), LONG_WEARS);
});

test('B1: after a scanner changes the outfit the normal canon applies to the outfit alone; the pack\'s physical words stay in front', () => {
    const made = madeTemiwa({ ...TEMIWA_ENTRY, look: LONG_LOOK, wears: LONG_WEARS });
    const longOutfit = sentences('New garment', 1200);
    const edited = normalizeProduction({ ...made, appearance: `${LONG_LOOK.replace(/[\s.;,]+$/, '')}; ${longOutfit}` });
    assert.equal(edited.overallAppearance, LONG_LOOK, 'the physical words untouched');
    const part = currentPresentationText(edited);
    assert.ok((part.match(/\./g) || []).length <= 10 && part.length <= 800, 'the outfit is compacted by the usual canon (10 sentences, 800 characters)');
    assert.ok(part.startsWith('New garment 1'), 'and starts as given');
    assert.deepEqual(normalizeProduction(structuredClone(edited)).appearance, edited.appearance, 'and is stable');
    // A scanner-style change in the Temiwa case (short entry): as before.
    const scanned = temiwaScan(madeTemiwa());
    assert.equal(currentPresentationText(scanned), 'Veil pinned back, tail in a grey linen wrap');
    // Body changed by a scan, outfit still the pack's: the outfit stays whole.
    const bodyChanged = normalizeProduction({ ...made, overallAppearance: 'Slender fox-woman with a notched ear.', appearance: `Slender fox-woman with a notched ear; ${LONG_WEARS}` });
    assert.equal(sameWords(currentPresentationText(bodyChanged)), LONG_WEARS);
});

test('a dossier made before this change is read as stored: no migration', () => {
    // The old shape: look in appearance, castFrom.first.appearance = look, no overallAppearance.
    const old = normalizeProduction({
        ...createNpcRecord('Temiwa', []), appearance: 'Slender fox-woman, amber eyes; veil of grey gauze, grey sash.',
        castFrom: { key: 'ersveil:temiwa', pack: 'ersveil', id: 'temiwa', first: { appearance: 'Slender fox-woman, amber eyes; veil of grey gauze, grey sash.' } },
    });
    assert.equal(old.overallAppearance, '', 'physical stays empty');
    assert.equal(old.appearance, 'Slender fox-woman, amber eyes; veil of grey gauze, grey sash.', 'current stays as it was');
    assert.deepEqual(old.castFrom.first, { appearance: 'Slender fox-woman, amber eyes; veil of grey gauze, grey sash.' });
});
