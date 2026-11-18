// The "planned again" note after a delete is one row (the newest), however many deletes there were, and the Tools card does not count it as a problem.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { selectSent } from '../../ui/select/tools.js';

test('REPLANNED rows fold into the newest one; other rows stay', async t => {
    const host = await createHost();
    t.after(() => host.close());
    host.turn.report({ code: 'REPLANNED', quiet: true, message: 'first' });
    host.turn.report({ code: 'LIMITED', quiet: true, message: 'kept' });
    host.turn.report({ code: 'REPLANNED', quiet: true, message: 'second' });
    host.turn.report({ code: 'REPLANNED', quiet: true, message: 'third' });
    const rows = host.turn.problems();
    assert.deepEqual(rows.map(row => row.message), ['kept', 'third']);
});

test('the Tools problem count leaves the "planned again" note out', () => {
    const sent = selectSent({ size: { tail: 1, static: 1, total: 2, own: [] }, budget: 10, text: '' }, { items: [{ code: 'REPLANNED' }, { code: 'LIMITED' }], rebuild: null });
    assert.match(sent.tools[1].hint, /^1 problem to look at/);
    const only = selectSent({ size: { tail: 1, static: 1, total: 2, own: [] }, budget: 10, text: '' }, { items: [{ code: 'REPLANNED' }], rebuild: null });
    assert.equal(only.tools[1].hint, 'none right now');
});
