// The interaction.view query gives the same copied snapshot as the sdk's current interaction.

import test from 'node:test';
import assert from 'node:assert/strict';
import { runQuery } from '../../../src/v2/sdk/queries.js';
import { createInteractionApi } from '../../../src/v2/sdk/interaction.js';
import { INTERACTION_VIEW, createInteractionView } from '../../../src/v2/interaction/view.js';
import { PROBE_ID, probeRegistry } from './helpers/probe-kind.js';

function host() {
    const meta = {}, state = { room: 1 };
    const api = createInteractionApi({
        registry: probeRegistry(),
        meta: () => meta,
        state: () => state,
        head: () => ({ sid: 'reply-1' }),
        persona: 'Astra',
    });
    const view = createInteractionView(api);
    const registry = { ...probeRegistry(), query: name => (name === INTERACTION_VIEW ? view : null) };
    return { api, meta, state, view, registry };
}

test('interaction.view is null without an open interaction and registers on a stub registry', () => {
    const h = host();
    assert.equal(INTERACTION_VIEW, 'interaction.view');
    assert.equal(runQuery(h.registry, h.state, INTERACTION_VIEW), null);
    assert.equal(h.view(), null);
});

test('interaction.view equals current(), returns a copy and follows discard and kind changes', () => {
    const h = host(), opened = h.api.open(PROBE_ID);
    h.api.stage(opened.id, { inputs: [{ actor: 'hero', choice: 'go' }] });
    const current = h.api.current();
    const answer = runQuery(h.registry, h.state, INTERACTION_VIEW);
    assert.deepEqual(answer, current);
    assert.notEqual(answer, current);
    answer.view.lines.push('not in the session');
    assert.deepEqual(h.api.current().view.lines, ['hero:go,mate:hum']);

    h.state.room = 4;
    assert.equal(runQuery(h.registry, h.state, INTERACTION_VIEW).view.room, 1, 'the setup room stays the session room');
    h.api.discard(opened.id);
    assert.equal(runQuery(h.registry, h.state, INTERACTION_VIEW), null);
});

test('the view query answers null instead of throwing when the api cannot read', () => {
    assert.equal(createInteractionView(() => { throw new Error('closed'); })(), null);
});
