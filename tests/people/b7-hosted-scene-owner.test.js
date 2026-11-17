// While hosted by Story Block v2 the scene belongs to the host: NPC State follows `scene.present`. The host probe says whether a v2 host is on the page.

import test from 'node:test';
import assert from 'node:assert/strict';

import { storyBlockIsV2 } from '../../modules/people/npc-api/host-probe.js';

test('a Story Block v2 host is detected, and nothing else is', () => {
    assert.equal(storyBlockIsV2({ apiVersion: 2 }), true);
    assert.equal(storyBlockIsV2({ apiVersion: 1 }), false);
    assert.equal(storyBlockIsV2(null), false);
    assert.equal(storyBlockIsV2({ get apiVersion() { throw new Error('boom'); } }), false);
});
