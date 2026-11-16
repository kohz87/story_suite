// With the fight board OFF the RPG behaves as before the board existed: a regenerate is not blocked by a remembered fight,
// but a staged fight with exchanges still is (it cannot silently leave the story).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInteractionHooks } from '../../../../src/v2/interaction/hooks.js';
import { interactionInputError } from '../../../../src/v2/interaction/watch.js';
import { fightKind } from '../../../../src/v2/lean-rpg/board/interaction.js';
import { LEAN_RPG_FEATURE } from '../../../../src/v2/lean-rpg/names.js';
import { seedCrypto } from '../../qa/helpers/seeded.js';
import { potionBoard, potionHost } from './commit.helpers.js';

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

test('board switched OFF with a fight staged: the refused send names the feature as the reader sees it, never its id, and keeps the way out', async () => {
    const restore = seedCrypto(11), host = await potionHost();
    try {
        potionBoard(host, [{ who: 'Astra', kind: 'attack', target: 11 }]);
        host.features.set(BOARD, false);
        const sent = await host.send('I strike.', 'She strikes.');
        assert.equal(sent.aborted, true, 'the send is refused');
        const said = host.st.notices.map(item => item.reason).join(' | ');
        assert.match(said, /Turn on the Fight board feature or discard the Fight\./);
        assert.doesNotMatch(said, /story-block\./, 'no internal id reaches the reader');
    } finally { host.close(); restore(); }
});

test('a feature with no name found: the refusal says where to turn it on, never the id, and keeps "or discard"', () => {
    for (const featureLabel of [undefined, () => null, () => { throw new Error('x'); }]) {
        const said = interactionInputError({}, { kindId: 'story-block/fight' }, { kindOf: () => fightKind, featureOn: () => false, featureLabel });
        assert.equal(said, 'Turn on its feature in the Features or discard the Fight.');
    }
});
