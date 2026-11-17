import test from 'node:test';
import assert from 'node:assert/strict';
import { lastRelationshipChangeHtml } from '../../modules/people/legacy/dossier-ui-relationship-parts/last-change.js';
import { pastSectionHtml } from '../../modules/people/legacy/dossier-ui-sections-parts/past-section.js';
import { normalizeName } from '../../modules/people/core/core-text.js';

test('the dossier shows a reason\'s leading [mN] message tag as #N', () => {
    const html = lastRelationshipChangeHtml({
        impact: 'positive', delta: { trust: 1, affection: 0, desire: 0, tension: 0 }, reason: '[m12] she laughed', hosted: false, events: [],
    });
    assert.match(html, /#12 — she laughed/);
    assert.doesNotMatch(html, /\[m12\]/);
});

test('the Past section shows a memory\'s leading [mN] tag as #N and its date stamp still resolves', () => {
    const memory = '[m12] she laughed';
    const html = pastSectionHtml({ memories: [memory], memoryStamps: { [normalizeName(memory)]: { m: 12, d: 'Icewane 27' } } });
    assert.match(html, /<span>#12 — she laughed<\/span>/);
    assert.doesNotMatch(html, /\[m12\]/);
    assert.match(html, /delta-mem-when">Icewane 27 · #12</);
});
