// The owner's "a dozen of aggressive rats" (19 Nov): on a Combat Rules v1 sheet the pre-check answered 12 rats (tier mob) and the fight never started, because the
// v1 Foes block holds at most six a slot: the opening could not be written, the core dropped the offer quietly and the reply went on with "No foes are set".
// Whole host, a level 1 hero, no foe standing, the model's answer read as SillyTavern hands it back (a string or parsed content): the send is held for the fight with the rats cut to six.
import test from 'node:test';
import assert from 'node:assert/strict';
import { characterV1 } from '../../../../modules/rpg/templates-parts/v1-character.js';
import { skillsV1 } from '../../../../modules/rpg/templates-parts/v1-skills.js';
import { foesV1 } from '../../../../modules/rpg/templates-parts/v1-foes.js';
import { LEAN_RPG_FEATURE } from '../../../../modules/rpg/index.js';
import { CORE_FEATURE } from '../../../../core/features.js';
import { answerText } from '../../../../modules/assist/st-adapter.js';
import { pendingStart } from '../../../../core/interaction/start-hold.js';
import { success } from '../../data-modules/helpers.js';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';

const { createHost } = await import('../../../../testkit/index.js');
const RATS = 'I went down to the cellar. A dozen of aggressive rats was there, digging through the sack when I attack them. After the fight, I took their carcasses back upstairs.';
const groups = { groups: [{ name: 'aggressive rats', count: 12, level: 1, tier: 'mob' }] };
const BODIES = { 'JSON text': { choices: [{ message: { content: JSON.stringify(groups) } }] }, 'parsed content': { choices: [{ message: { content: groups } }] }, 'the proxy\'s shape': { content: groups } };

async function crowdHost(t, body) {
    const restore = seedCrypto(1911);
    const asked = [];
    const callModel = async prompt => { asked.push(prompt); return /enemy groups/i.test(String(prompt)) ? answerText(body) : 'none'; };
    const host = await createHost({ callModel });
    t.after(() => { host.close(); restore(); });
    host.features.set(LEAN_RPG_FEATURE, true);
    host.features.set(CORE_FEATURE.fightBoard, true);
    await host.send('Begin.', 'Opening.');
    for (const definition of [characterV1, skillsV1, foesV1]) success(await host.sdk.command('dm.define', { definition: structuredClone(definition) }));
    success(await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { who: 'Astra', int: 30, level: 1 } }));
    success(await host.sdk.command('dm.set', { module: 'pack.chat/skills', fields: { who: 'Astra', skill1: 'Gale', about1: 'A cutting wind', stat1: 'int', type1: 'attack' } }));
    host.ctx.name1 = 'Astra';
    return { host, asked };
}

for (const [shape, body] of Object.entries(BODIES)) {
    test(`a dozen mob rats (${shape}) hold the send for the fight, cut to the six a Foes slot holds`, async t => {
        const { host, asked } = await crowdHost(t, body);
        host.st.addUser(RATS);
        const held = await host.st.generate('normal', { reply: 'The narrator tells the whole fight.' });
        assert.equal(asked.filter(prompt => /enemy groups/i.test(prompt)).length, 1, 'the pre-check asked once');
        assert.equal(held.aborted, true, 'the send waits for the fight');
        const start = pendingStart(host.ctx.chatMetadata, host.ctx.chat);
        assert.ok(start?.opening, 'the opening was previewed and recorded with the hold');
        assert.deepEqual(start.opening.payload.setup.open.map(({ name, count, tier, level }) => [name, count, tier, level]), [['aggressive rats', 6, 'mob', 1]]);
        assert.equal(host.turn.problems().some(item => item.code === 'INTERACTION_START'), false, 'no quiet drop');
    });
}
