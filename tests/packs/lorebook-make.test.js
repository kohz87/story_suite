// The world pack's lore as a SillyTavern World Info book (packs/lorebook-make): the entry shape, hidden lore left out, the protected tag,
// the logic words, stable uids, the marker and the book's name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lorebookFromPack, LOREBOOK_FORMAT } from '../../packs/lorebook-make/convert.js';
import { LOREBOOK_TAG, isLorebookTitle, lorebookName, readMarker } from '../../packs/lorebook-make/marker.js';
import { loreEntries } from '../../modules/arc/lore-digest/entries.js';

const ersveil = JSON.parse(readFileSync(new URL('../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8'));
// SillyTavern's newWorldInfoEntryTemplate keys (public/scripts/world-info.js), which every entry it saves carries.
const ST_KEYS = ['key', 'keysecondary', 'comment', 'content', 'constant', 'vectorized', 'selective', 'selectiveLogic', 'addMemo', 'order', 'position', 'disable',
    'ignoreBudget', 'excludeRecursion', 'preventRecursion', 'matchPersonaDescription', 'matchCharacterDescription', 'matchCharacterPersonality', 'matchCharacterDepthPrompt',
    'matchScenario', 'matchCreatorNotes', 'delayUntilRecursion', 'probability', 'useProbability', 'depth', 'outletName', 'group', 'groupOverride', 'groupWeight', 'scanDepth',
    'caseSensitive', 'matchWholeWords', 'useGroupScoring', 'automationId', 'role', 'sticky', 'cooldown', 'delay', 'triggers'];
const world = lore => ({ id: 'tiny', version: '1.2.0', name: 'Tiny World', kind: 'world', format: 4, content: { lore } });
const entriesOf = book => Object.values(book.entries);
const loreOnly = book => entriesOf(book).filter(entry => !isLorebookTitle(entry.comment));

test('Ersveil: 213 lore entries and the marker, 5 hidden kept out, named after the pack', () => {
    const { name, book, counts } = lorebookFromPack(ersveil);
    assert.equal(name, 'Ersveil (open world) (Story Suite)');
    assert.deepEqual(counts, { entries: 213, hidden: 5 });
    assert.equal(entriesOf(book).length, 214);
    assert.deepEqual(readMarker(book), { pack: 'ersveil', version: '4.1.0', format: LOREBOOK_FORMAT });
    assert.equal(lorebookFromPack(ersveil, { packName: 'Ersveil' }).name, 'Ersveil (Story Suite)');
});

test('no hidden entry reaches the book: not its title, text or keys', () => {
    const { book } = lorebookFromPack(ersveil);
    const json = JSON.stringify(book);
    const hidden = ersveil.content.lore.filter(record => record.hidden === true);
    assert.equal(hidden.length, 5);
    for (const record of hidden) {
        assert.equal(json.includes(JSON.stringify(record.text).slice(1, -1)), false, record.title);
        assert.equal(entriesOf(book).some(entry => entry.comment.includes(record.title)), false, record.title);
    }
    const tiny = lorebookFromPack(world([
        { title: 'Open', keys: ['harbour'], text: 'The harbour is open.' },
        { title: 'Sealed vault', keys: ['zz-sealed-key'], secondaryKeys: ['zz-second'], text: 'zz secret text', hidden: true, gate: 'fact:x' },
    ]));
    assert.deepEqual(tiny.counts, { entries: 1, hidden: 1 });
    assert.equal(/zz-|Sealed vault|secret/.test(JSON.stringify(tiny.book)), false);
});

test('each entry has SillyTavern’s own fields; constant before the definitions, keyed at depth 0 (beside the turn\'s note, so older messages stay the same for the prompt cache)', () => {
    const { book } = lorebookFromPack(ersveil);
    for (const entry of entriesOf(book)) {
        for (const key of ST_KEYS) assert.ok(Object.hasOwn(entry, key), `${entry.comment}: ${key}`);
        assert.ok(Number.isInteger(entry.uid) && entry.uid >= 0 && entry.uid < 1_000_000);
        assert.equal(book.entries[String(entry.uid)], entry);
    }
    const premise = loreOnly(book).find(entry => entry.comment.startsWith('Premise and Tone'));
    assert.equal(premise.constant, true);
    assert.equal(premise.position, 0);
    assert.equal(premise.order, 1000);
    const keyed = loreOnly(book).find(entry => !entry.constant);
    assert.equal(keyed.position, 4);
    assert.equal(keyed.depth, 0);
    assert.equal(keyed.order, 100);
    assert.equal(keyed.disable, false);
    assert.ok(keyed.key.length > 0);
});

test('the logic words map to SillyTavern’s numbers by name; selective only with secondary keys', () => {
    const pick = (logic, secondaryKeys) => loreOnly(lorebookFromPack(world([{ title: 'A', keys: ['a'], text: 'a', ...(logic ? { logic } : {}), ...(secondaryKeys ? { secondaryKeys } : {}) }])).book)[0];
    assert.equal(pick('and any', ['b']).selectiveLogic, 0);
    assert.equal(pick('not all', ['b']).selectiveLogic, 1);
    assert.equal(pick('not any', ['b']).selectiveLogic, 2);
    assert.equal(pick('and all', ['b']).selectiveLogic, 3);
    assert.equal(pick('and all', ['b']).selective, true);
    assert.deepEqual(pick('and all', ['b']).keysecondary, ['b']);
    assert.equal(pick(null, null).selective, false);
    assert.equal(pick(null, null).selectiveLogic, 0);
});

test('protected entries keep a [protected] title tag the Director reads the same as the pack’s flag', () => {
    const { book } = lorebookFromPack(ersveil);
    const tagged = loreOnly(book).filter(entry => /\[protected\]/.test(entry.comment));
    assert.equal(tagged.length, ersveil.content.lore.filter(record => record.protected === true && !record.hidden).length);
    const fromBook = loreEntries({ lorebook: entriesOf(book).map(entry => ({ title: entry.comment, keys: entry.key, content: entry.content })) });
    const fromPack = loreEntries({ pack: ersveil.content.lore.filter(record => !record.hidden) });
    assert.equal(fromBook.length, fromPack.length);   // (the marker is not lore)
    const pairs = list => list.map(entry => [entry.title, entry.protected, entry.text]).sort((a, b) => a[0].localeCompare(b[0]));
    assert.deepEqual(pairs(fromBook), pairs(fromPack));
});

test('uids are stable: by title, not by place, and a hidden entry coming or going moves none', () => {
    const base = [{ title: 'One', keys: ['a'], text: '1' }, { title: 'Two', keys: ['b'], text: '2' }, { title: 'Three', keys: ['c'], text: '3' }];
    const uids = lore => Object.fromEntries(loreOnly(lorebookFromPack(world(lore)).book).map(entry => [entry.comment, entry.uid]));
    const before = uids(base);
    assert.deepEqual(uids(base), before);
    assert.deepEqual(uids([base[2], base[0], base[1]]), before);
    assert.deepEqual(uids([...base, { title: 'Gated', keys: [], text: 'g', hidden: true, gate: 'fact:x' }]), before);
    const fewer = uids([base[0], base[2]]);
    assert.equal(fewer.One, before.One);
    assert.equal(fewer.Three, before.Three);
    const all = loreOnly(lorebookFromPack(ersveil).book).map(entry => entry.uid);
    assert.equal(new Set(all).size, all.length);
    assert.equal(all.includes(0), false);
    // (an object's integer keys run by number, so the editor's order is displayIndex: the pack's order)
    const byShown = loreOnly(lorebookFromPack(ersveil).book).sort((a, b) => a.displayIndex - b.displayIndex);
    assert.deepEqual(byShown.map(entry => entry.displayIndex), all.map((_, index) => index + 1));
    assert.deepEqual(byShown.map(entry => entry.comment.replace(' [protected]', '')), ersveil.content.lore.filter(record => !record.hidden).map(record => record.title));
});

test('the marker: disabled, tagged, read back; a plain or edited book has none', () => {
    const { book } = lorebookFromPack(world([{ title: 'A', keys: ['a'], text: 'a' }]));
    const marker = book.entries[0];
    assert.equal(marker.disable, true);
    assert.ok(marker.comment.startsWith(LOREBOOK_TAG));
    assert.deepEqual(readMarker(book), { pack: 'tiny', version: '1.2.0', format: LOREBOOK_FORMAT });
    assert.equal(readMarker({ entries: { 1: { comment: 'Some lore', content: '{"pack":"tiny"}' } } }), null);
    assert.equal(readMarker({ entries: { 0: { comment: LOREBOOK_TAG, content: 'edited' } } }), null);
    assert.equal(readMarker(null), null);
    assert.equal(isLorebookTitle('[StorySuite : Lorebook] x'), true);
});

test('the book name is safe as a file name', () => {
    assert.equal(lorebookName('Ersveil (open world)'), 'Ersveil (open world) (Story Suite)');
    assert.equal(lorebookName('A/B: "C"? <D>|*'), 'A B C D (Story Suite)');
    assert.equal(lorebookName('Trailing...'), 'Trailing (Story Suite)');
    assert.equal(lorebookName(''), 'World pack (Story Suite)');
});

test('a pack with no lore gives just the marker; the converter imports nothing from the host', () => {
    const { book, counts } = lorebookFromPack({ id: 'empty', version: '1.0.0', name: 'Empty', content: {} });
    assert.deepEqual(counts, { entries: 0, hidden: 0 });
    assert.equal(entriesOf(book).length, 1);
    for (const file of ['convert.js', 'marker.js']) {
        const source = readFileSync(new URL(`../../packs/lorebook-make/${file}`, import.meta.url), 'utf8');
        const imports = [...source.matchAll(/from '([^']+)'/g)].map(match => match[1]);
        assert.ok(imports.every(path => path === './marker.js'), `${file}: ${imports}`);
    }
});

test('an older book (no format in its marker) reads as format 1, and a same-version book of an older format is offered an Update', () => {
  const old = { entries: { 0: { comment: '[storysuite:lorebook] Old', content: JSON.stringify({ pack: 'tiny', version: '1.0.0' }) } } };
  assert.deepEqual(readMarker(old), { pack: 'tiny', version: '1.0.0', format: 1 });
});
