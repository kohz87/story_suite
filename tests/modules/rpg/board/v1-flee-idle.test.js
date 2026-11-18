// The fight setup's `fleeIdle` mark reaches the engine through the board (SOAK2CORE #5): two members, a step where only Astra picks Flee and it gets away
// before Pell's turn. Opened under the mark, Pell holds no stance in that exchange; the same setup without the mark (a fight opened before it) plays as recorded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fightKind } from '../../../../modules/rpg/board/interaction.js';
import { dice } from '../../../../core/interaction/dice.js';
import { actorIdOf } from '../../../../modules/rpg/roster.js';
import { HERO_ID, headSid, v1Blocks } from './v1.helpers.js';
import { setup } from '../helpers.js';

const PELL = actorIdOf('pack.chat/pell');

async function twoHeroes() {
    const blocks = v1Blocks({ count: 1, level: 1 });
    const pell = structuredClone(v1Blocks().character), guard = structuredClone(v1Blocks({ skill: false }).skills);
    Object.assign(pell.fields, { who: 'Pell', agi: 4, dex: 4 });
    Object.assign(guard.fields, { who: 'Pell', skill1: 'Guard', about1: 'Takes the blow', stat1: 'vit', type1: 'defence', practice1: 100, rank1: 1 });
    return (await setup({ blocks: { character: blocks.character, skills: blocks.skills, pell, 'pell-skills': guard, foes: blocks.foes }, board: true, planner: false })).host;
}
const pellStance = result => (result?.rounds ?? []).flat().some(line => line[0] === 'stance' && line[1] === 'Pell');

test('a fight opened under fleeIdle: the member who picked nothing holds no stance when the party gets away first; without the mark, as recorded', async () => {
    const host = await twoHeroes();
    try {
        let found = null;
        // (a seed where the party moves first, Astra before Pell, and the flee gets away: the dice are the port's, so the case is looked for, then pinned by the asserts)
        for (let seed = 1; seed < 400 && !found; seed += 1) {
            const { setup: opened } = fightKind.open(host.head(), { anchor: headSid(host), seed, attempt: 0, args: { rules: {} } });
            const step = { inputs: [{ actor: HERO_ID, choice: 'flee', args: {} }] };
            const marked = fightKind.play(host.head(), opened, [step], dice(seed, 0)).result;
            if (marked?.stop !== 'fled') continue;
            const order = (marked.lines ?? marked.rounds?.flat() ?? []).find(line => line[0] === 'order');
            if (!order || order[3] !== 'party' || order[1][0] !== 'Astra') continue;
            const { fleeIdle, ...before } = opened;
            found = { fleeIdle, marked, old: fightKind.play(host.head(), before, [step], dice(seed, 0)).result };
        }
        assert.ok(found, 'a seed where the party moves first and Astra gets away');
        assert.equal(found.fleeIdle, 1, 'the open stamps the mark');
        assert.equal(pellStance(found.marked), false, 'marked: Pell holds no stance in the fled exchange');
        assert.equal(pellStance(found.old), true, 'unmarked: Pell holds it, as recorded before');
    } finally { host.close(); }
});
