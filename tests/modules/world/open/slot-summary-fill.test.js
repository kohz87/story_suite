// SFW6 (W10): the Director is shown the template's summary with {place}, {region} and {realm} filled in, never a bare placeholder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { slotView } from '../../../../modules/world/chronicle/world-daily/open-context.js';

const ws = { declared: new Map(), table: {}, day: 3, people: new Map(), cast: {}, geo: null };
const def = { id: 'open-ambition', summary: 'Someone in {region} reaches for what they want, near {place}, under {realm}.', open: { menu: {}, facts: [] } };

test('a slot view fills the summary\'s placeholders from the slot', () => {
    const view = slotView(ws, def, { key: 'k', place: 'Ledger Locks', region: 'reedmere', regionName: 'Reedmere', realm: 'the Confederacy' }, {});
    assert.doesNotMatch(view.summary, /[{}]/);
    assert.match(view.summary, /^Someone in Reedmere reaches for what they want/);
    assert.match(view.summary, /under the Confederacy\.$/);
});
