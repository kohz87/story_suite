// The lore digest (world events, job G): entries from both sources, one line each, a revision that follows the text, the scene's entries in full
// within a cap, the cache read again only when the text changed, and nothing asked or answered while the world-events switch is off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createHost } from '../../../testkit/index.js';
import { createModule } from '../../../modules/director/module.js';
import { WORLD_EVENTS_FEATURE } from '../../../modules/arc/index.js';
import { loreEntries } from '../../../modules/arc/lore-digest/entries.js';
import { buildDigest } from '../../../modules/arc/lore-digest/digest.js';
import { loreFor } from '../../../modules/arc/lore-digest/match.js';
import { createLoreCache } from '../../../modules/arc/lore-digest/cache.js';

const book = [
    { title: 'Auvoth', keys: ['Auvoth', 'the Guild city'], content: 'Auvoth is the Guild city. Its Depths were sealed by Veyr in CY 384 and no one goes down.' },
    { title: '[storysuite:pack] Ersveil', keys: [], content: '{"id":"x"}' },
    { title: 'Veyr the Unbound [protected]', keys: ['Veyr'], content: 'Veyr sealed the Depths and may not be freed by any happening.' },
    { title: 'Empty', keys: ['nothing'], content: '   ' },
];
const pack = [{ title: 'Heron Ford', keys: ['Heron Ford', 'the ford'], text: 'A river crossing held by the Confederacy.', protected: false }];

test('entries: both sources, tagged Story Suite entries and empty ones left out, protected flags, first title wins', () => {
    const list = loreEntries({ pack: [...pack, { title: 'auvoth', text: 'pack copy' }], lorebook: book });
    assert.deepEqual(list.map(entry => [entry.title, entry.source, entry.protected]), [
        ['Heron Ford', 'pack', false], ['auvoth', 'pack', false], ['Veyr the Unbound', 'lorebook', true],
    ]);
    assert.equal(loreEntries({ pack: [{ title: 'Seal', text: 'x', protected: true }] })[0].protected, true);
    assert.deepEqual(loreEntries({}), []);
});

test('digest: one short line per entry, protected carried, rev follows any edit of title, keys or text', () => {
    const list = loreEntries({ pack, lorebook: book });
    const digest = buildDigest(list);
    assert.equal(digest.lines.length, 3);
    assert.equal(digest.lines[1].line, 'Auvoth is the Guild city.');
    assert.equal(digest.lines[2].protected, true);
    assert.equal('protected' in digest.lines[0], false);
    assert.equal(buildDigest(list).rev, digest.rev);
    const edited = loreEntries({ pack, lorebook: book.map(entry => (entry.title === 'Auvoth' ? { ...entry, content: `${entry.content} More.` } : entry)) });
    assert.notEqual(buildDigest(edited).rev, digest.rev);
    assert.notEqual(buildDigest(list.slice(0, 2)).rev, digest.rev);
});

test('loreFor: matches keys and titles by whole words, place first, each once, the full text', () => {
    const list = loreEntries({ pack, lorebook: book });
    const found = loreFor(list, { place: 'Heron Ford', factions: ['the guild city'], people: ['Veyr', 'veyr'] });
    assert.deepEqual(found.entries.map(entry => entry.title), ['Heron Ford', 'Auvoth', 'Veyr the Unbound']);
    assert.equal(found.entries[2].protected, true);
    assert.match(found.text, /^Heron Ford: A river crossing/);
    assert.match(found.text, /Auvoth: Auvoth is the Guild city\. Its Depths were sealed by Veyr in CY 384/);
    assert.equal(found.truncated, false);
    assert.deepEqual(loreFor(list, { place: 'Nowhere Hollow' }).entries, []);
    assert.deepEqual(loreFor(list, {}).entries, []);
    assert.equal(loreFor(list, { place: 'Ford' }).entries[0].title, 'Heron Ford', 'a term inside a key');
    assert.deepEqual(loreFor(list, { place: 'Fordham' }).entries, [], 'whole words only');
});

test('loreFor: the cap cuts the last entry and says so', () => {
    const big = [{ title: 'Long', keys: ['long'], text: 'word '.repeat(2000), protected: false }, { title: 'Next', keys: ['long'], text: 'after', protected: false }];
    const found = loreFor(big, { place: 'long' }, 400);
    assert.equal(found.entries.length, 1);
    assert.equal(found.truncated, true);
    assert.ok(found.text.length <= 400);
});

test('cache: read again each refresh, rebuilt only when the text changed (edited Re-read, another card), never throws', async () => {
    let entries = book;
    let reads = 0;
    const cache = createLoreCache({ readLorebook: async () => { reads += 1; return { entries }; } });
    assert.deepEqual(cache.digest(), { lines: [], rev: '' });
    const first = await cache.refresh({ packLore: pack });
    assert.equal(first.lines.length, 3);
    assert.equal(await cache.refresh({ packLore: pack }), first, 'same sources: the same digest object');
    assert.equal(reads, 2);
    entries = book.map(entry => (entry.title === 'Auvoth' ? { ...entry, content: 'Auvoth fell.' } : entry));
    const grown = await cache.refresh({ packLore: pack });
    assert.notEqual(grown.rev, first.rev);
    assert.equal(grown.lines[1].line, 'Auvoth fell.');
    entries = book;
    assert.equal((await cache.refresh({ packLore: pack })).rev, first.rev, 'back to the first text: the first revision');
    entries = [];
    assert.equal((await cache.refresh({ packLore: [] })).lines.length, 0, 'a card with no lorebook and no pack lore');
    const broken = createLoreCache({ readLorebook: async () => { throw new Error('no'); } });
    assert.equal((await broken.refresh({ packLore: pack })).lines.length, 1, 'the pack\'s lore stays when the lorebook cannot be read');
});

test('live host: the switch is off by default, queries answer null; on, they answer the digest', async t => {
    const host = await createHost({ modules: [createModule({ host: { settings: () => null, substitute: text => text } })] });
    t.after(() => host.close?.());
    assert.equal(host.features.get?.(WORLD_EVENTS_FEATURE) ?? false, false);
    assert.equal(host.sdk.query('director.loreDigest'), null);
    assert.equal(host.sdk.query('director.loreFor', { place: 'Auvoth' }), null);
    host.features.set(WORLD_EVENTS_FEATURE, true);
    assert.deepEqual(host.sdk.query('director.loreDigest'), { lines: [], rev: '' });
    assert.deepEqual(host.sdk.query('director.loreFor', { place: 'Auvoth' }).entries, []);
});

test('Ersveil: the whole lore file digests to a small digest', () => {
    const file = JSON.parse(readFileSync(new URL('../../../examples/packs/ersveil/ersveil-lore.json', import.meta.url), 'utf8'));
    const lorebook = Object.values(file.entries).map(entry => ({ title: entry.comment, keys: Array.isArray(entry.key) ? entry.key : [], content: entry.content }));
    const digest = buildDigest(loreEntries({ lorebook }));
    assert.ok(digest.lines.length > 100);
    assert.ok(digest.lines.filter(line => line.keys.length).length > 100, 'the lorebook\'s keys are read');
    const chars = digest.lines.map(line => `${line.title} [${line.keys.join(', ')}]: ${line.line}`).join('\n').length;
    console.log(`ersveil digest: ${digest.lines.length} entries, ~${Math.round(chars / 4)} tokens`);
    assert.ok(chars / 4 < 10000);
    assert.ok(digest.lines.every(line => line.keys.length <= 4 && line.line.length <= 100));
});
