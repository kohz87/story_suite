// The roll planner and the Classic rules are gone: a pack that asks for Classic is
// refused in plain words (Standard is accepted), and a message in a fight makes no model call at all, with the fight board on or off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost, hostAvailable } from '../../../testkit/index.js';
import { LEAN_RPG_FEATURE, createLeanRpgPart } from '../../../modules/rpg/index.js';
import { validatePack } from '../../../packs/validate.js';
import { pack } from '../../packs/helpers/fixtures.js';
import { OWNER, PARTY, fakeModel, sheetDomain } from './helpers.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;

test('a pack with content.rpg.formula "classic" is refused in plain words; "standard" is accepted', () => {
    const refused = validatePack(JSON.stringify(pack({ kind: 'game', content: { rpg: { formula: 'classic' } } })));
    assert.equal(refused.ok, false);
    const hit = refused.errors.find(error => error.path === 'content.rpg.formula');
    assert.ok(hit, JSON.stringify(refused.errors));
    assert.equal(hit.code, 'BAD_CONTENT');
    assert.match(hit.message, /"classic" is no longer supported/);
    assert.match(hit.message, /Use "v1" or leave the formula out/);
    for (const formula of ['standard', undefined]) {
        const result = validatePack(JSON.stringify(pack({ kind: 'game', content: { rpg: { formula, numbers: { foeBase: 6 } } } })));
        assert.equal(result.ok, true, JSON.stringify(result.errors));
    }
});

// A host with the real RPG part (no planner behind it) and a model that is counted: the host's own callModel, not only the part's.
async function hostWithModel() {
    const model = fakeModel('pace: normal\nact Wessel | skill: Iron Breath | stat: STR | target: Sluice Rats');
    let host = null;
    const part = createLeanRpgPart({ chat: () => host.ctx.chat, metadata: () => host.ctx.chatMetadata ?? null, moduleId: OWNER });
    const module = {
        id: OWNER, name: 'Story Block (RPG test)', version: '0.0.1',
        features: [{ id: LEAN_RPG_FEATURE, label: 'RPG', describe: 'Test.', default: false }],
        domains: { dataModules: { initial: () => sheetDomain(PARTY()) } },
        commands: { ...part.commands }, queries: { ...part.queries }, hooks: { ...part.hooks, replayGuard: part.guard }, settings: { defaults: { ...part.settings.defaults } },
    };
    host = await createHost({ core: false, modules: [module], callModel: model });
    host.features.set(LEAN_RPG_FEATURE, true);
    return { host, model };
}

{
    test('a risky message in an open fight makes no model call', { skip }, async () => {
        const { host, model } = await hostWithModel();
        const sent = await host.send('I attack the sluice rats', 'The rats scatter.');
        assert.equal(model.calls.length, 0, 'no planner, no other model call');
        const rolls = host.ctx.chat.flatMap(message => message.extra?.storySuite?.receipts ?? []).filter(receipt => receipt.type === 'rpg.dice');
        assert.deepEqual(rolls, [], 'and no roll was made before the reply');
        host.close();
    });
}
