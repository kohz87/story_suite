// With the fight board OFF the RPG behaves as before the board existed: a regenerate is not blocked by a remembered fight,
// but a staged fight with exchanges still is (it cannot silently leave the story).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInteractionHooks } from '../../../../src/v2/interaction/hooks.js';
import { fightKind } from '../../../../src/v2/lean-rpg/board/interaction.js';
import { LEAN_RPG_FEATURE } from '../../../../src/v2/lean-rpg/names.js';

// The fight's hold on a send is the core's hook now (interaction/hooks.js), whatever the board setting says.
const BOARD = 'story-block.fight-board';
const remembered = { key: 'i:x:a:0', anchor: 'a', kindId: 'story-block/fight', steps: [] };
const make = meta => {
    const messages = [{ is_user: false, mes: 'The rats close in.' }, { is_user: true, mes: 'I hit the lead rat.', extra: { storySuiteInteractionLinks: { [remembered.key]: true } } }];
    return createInteractionHooks({ chat: () => messages, metadata: () => meta, kindOf: () => fightKind });
};
const viewOf = board => ({ feature: id => id === LEAN_RPG_FEATURE || (board && id === BOARD), query: () => null, state: { domains: {} } });
const regenerate = { commit: true, type: 'regenerate' };

test('board OFF, no staged exchanges: a regenerate is allowed exactly as before the board existed', () => {
    const hooks = make({ storySuiteInteraction: { last: structuredClone(remembered) } });
    assert.equal(hooks.canGenerate(viewOf(false), regenerate), null);
});

test('board OFF, a live staged fight (exchanges): the regenerate stays blocked', () => {
    const hooks = make({ storySuiteInteraction: { open: { id: 'zzz:0:story-block/fight', kindId: 'story-block/fight', anchor: 'zzz', attempt: 0, offset: 0, setup: {}, steps: [{ inputs: [] }] } } });
    const refused = hooks.canGenerate(viewOf(false), regenerate);
    assert.equal(refused?.ok, false);
    assert.match(refused.reason, /fight/i);
});
