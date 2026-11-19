// The three stances on the v1 fight board (the hero's mastery is 2: the best rank over its skills, Cut or Spark at Apprentice) (Defence, Speed, Focus): each one is held and paid in a real fight, the switch says what Speed and Focus add,
// a Focus stance makes an INT skill hit harder, and the fight replays as live (rebuild, swipe and swipe back, an edited Re-read, a reload).
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { api, openFight, stage, step, v1Blocks } from './v1.helpers.js';
import { setup } from '../helpers.js';

const STANCES = {
    defence: { skill1: 'Cut', stat1: 'str', skill2: 'Shield work', stat2: 'vit', pool: 'Stamina', adds: undefined },
    speed: { skill1: 'Cut', stat1: 'str', skill2: 'Swift feet', stat2: 'agi', pool: 'Stamina', adds: 'evasion and tempo +1' },
    focus: { skill1: 'Spark', stat1: 'int', skill2: 'Calm mind', stat2: 'wis', pool: 'Mana', adds: 'INT and WIS skills +10%' },
};
async function hostWith(type) {
    const s = STANCES[type], blocks = v1Blocks({ count: 2, level: 3, hero: { int: 30 } });
    blocks.skills.fields = { ...blocks.skills.fields, skill1: s.skill1, stat1: s.stat1, skill2: s.skill2, about2: 'A stance.', stat2: s.stat2, type2: type, practice2: 0, rank2: 0 };
    return (await setup({ blocks, board: true, planner: false })).host;
}
const view = host => api(host).current().view;
const state = host => JSON.stringify(host.head().domains.dataModules.instances);

for (const type of Object.keys(STANCES)) {
    test(`a ${type} stance: held and paid each exchange, its switch says what it adds, and the fight replays as live`, async () => {
        const restore = seedCrypto(11);
        try {
            const host = await hostWith(type), s = STANCES[type];
            assert.equal(openFight(host).ok, true);
            const { stance } = view(host).actors[0];
            assert.deepEqual([stance.name, stance.pool, stance.cost, stance.on, stance.adds], [s.skill2, s.pool, 1, true, s.adds]);
            assert.equal(stage(host, step('attack')).ok, true);
            assert.equal(stage(host, step('attack')).ok, true);
            const rows = view(host).result.rounds.flat().filter(row => row[0] === 'stance');
            assert.deepEqual(rows.map(row => row[2]), [[type], [type]], 'on in both exchanges');
            const live = JSON.stringify(view(host));
            host.store.rebuild();
            assert.equal(JSON.stringify(view(host)), live, 'rebuilt: the same view');
            await host.send('Go.', 'Done.');
            const sent = state(host);
            await host.swipe('Told again.');
            assert.equal(state(host), sent, 'swipe');
            await host.st.swipeTo(2, 0);
            assert.equal(state(host), sent, 'swipe back');
            const text = host.ctx.chat[2].mes;
            await host.st.editMessage(2, `${text}\nAnd more words.`);
            assert.equal((await host.sdk.reread(2)).ok, true);
            assert.equal(state(host), sent, 'an edited Re-read');
            await host.store.flush();
            const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
            await host.st.loadChat(chat, `stance-${type}`);
            host.ctx.chatMetadata = meta;
            assert.equal(state(host), sent, 'a reload');
        } finally { restore(); }
    });
}

test('on the board, a Focus stance multiplies an INT skill\'s damage; switched off, the same dice hit for the plain amount', async () => {
    const restore = seedCrypto(12), hits = [];
    try {
        for (const args of [{ target: '1.1' }, { target: '1.1', stance: false }]) {
            const host = await hostWith('focus');
            assert.equal(openFight(host).ok, true);
            assert.equal(stage(host, step('attack', args)).ok, true);
            hits.push(view(host).result.rounds[0].filter(row => row[0] === 'attack' && row[2] === 'skill' && ['hit', 'decisive'].includes(row[8])).map(row => [row[8], row[9]]));
        }
    } finally { restore(); }
    // Spark: INT 30 ÷ 2 + mastery 2 = 17; Focus at mastery 2: × 110 ÷ 100 = 18 (decisive × 1.5: 27); off: 17 (decisive 25)
    const want = { on: { hit: 18, decisive: 27 }, off: { hit: 17, decisive: 25 } };
    assert.ok(hits[0].length && hits[1].length, JSON.stringify(hits));
    for (const [outcome, damage] of hits[0]) assert.equal(damage, want.on[outcome], `on ${outcome}`);
    for (const [outcome, damage] of hits[1]) assert.equal(damage, want.off[outcome], `off ${outcome}`);
});
