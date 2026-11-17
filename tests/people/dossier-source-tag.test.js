import test from 'node:test';
import assert from 'node:assert/strict';
import { lastRelationshipChangeHtml } from '../../modules/people/legacy/dossier-ui-relationship-parts/last-change.js';

test('the dossier shows a reason\'s leading [mN] message tag as #N', () => {
    const html = lastRelationshipChangeHtml({
        impact: 'positive', delta: { trust: 1, affection: 0, desire: 0, tension: 0 }, reason: '[m12] she laughed', hosted: false, events: [],
    });
    assert.match(html, /#12 — she laughed/);
    assert.doesNotMatch(html, /\[m12\]/);
});
