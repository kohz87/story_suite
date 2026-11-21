// A fight with two heroes: the stance carry follows each hero's own last pick (one off, one on) across steps that lack a hero's input, replies and Auto; the end card pays each member their own XP at their own level.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { characterV1 } from '../../../../modules/rpg/templates-parts/v1-character.js';
import { skillsV1 } from '../../../../modules/rpg/templates-parts/v1-skills.js';
import { actorIdOf } from '../../../../modules/rpg/roster.js';
import { api, HERO_ID, openFight, stage, v1Blocks } from './v1.helpers.js';
import { setup } from '../helpers.js';

const REN_ID = actorIdOf('pack.chat/ren');
const make = (role, definition, over) => ({ role, definition: { rules: [], cards: [], ...definition }, fields: { ...Object.fromEntries(Object.entries(definition.state).map(([key, spec]) => [key, spec.default ?? (spec.type === 'text' ? '' : 0)])), ...over } });
const twoHeroes = async (renLevel = 2, foes = { count: 2, level: 5 }) => {
    const blocks = v1Blocks(foes);
    blocks.skills.fields = { ...blocks.skills.fields, skill2: 'Shield work', stat2: 'str', type2: 'defence', practice2: 100, rank2: 1 };
    blocks.ren = make('character', characterV1, { who: 'Ren', hp: 30, 'hp-max': 30, mp: 12, 'mp-max': 12, sp: 12, 'sp-max': 12, str: 14, vit: 10, agi: 10, dex: 10, int: 8, wis: 8, cha: 5, level: renLevel, cap: 99 });
    blocks['ren-skills'] = make('skills', skillsV1, { who: 'Ren', skill1: 'Cut', about1: 'A hard cut', stat1: 'str', type1: 'attack', practice1: 100, rank1: 1, skill2: 'Shield work', stat2: 'str', type2: 'defence', practice2: 100, rank2: 1 });
    return (await setup({ blocks, board: true, planner: false })).host;
};
const pick = (actor, args) => ({ actor, choice: 'normal', args });
const open = host => host.ctx.chatMetadata.storySuiteInteraction.open;
const rows = host => Object.fromEntries(api(host).current().view.result.rounds.at(-1).filter(row => row[0] === 'stance').map(row => [row[1], row[2]]));

test('two heroes: Astra off and Ren on stay that way when a later step has only Ren, across the next reply and Auto', async () => {
    const restore = seedCrypto(21);
    try {
        const host = await twoHeroes();
        assert.equal(openFight(host).ok, true);
        assert.equal(stage(host, { inputs: [pick(HERO_ID, { target: '1.1', stance: false }), pick(REN_ID, { target: '1.1', stance: true })] }).ok, true);
        assert.equal(stage(host, { inputs: [pick(REN_ID, { target: '1.1' })] }).ok, true, 'a step with only Ren (Astra staged nothing)');
        assert.equal(api(host).auto(open(host).id, 1).ok, true);
        assert.deepEqual(rows(host).Astra, [], 'Auto does not pay the stance Astra was left off');
        await host.send('Go.', 'Done.');
        assert.equal(open(host).setup.stance[HERO_ID], false, 'the next reply carries Astra off');
        assert.equal(open(host).setup.stance[REN_ID], undefined, 'and Ren on');
    } finally { restore(); }
});

test('the carry is the same after a swipe, swipe back and a reload', async () => {
    const restore = seedCrypto(22);
    try {
        const host = await twoHeroes(2, { count: 6, level: 12 });
        openFight(host);
        stage(host, { inputs: [pick(HERO_ID, { target: '1.1', stance: false }), pick(REN_ID, { target: '1.1' })] });
        stage(host, { inputs: [pick(REN_ID, { target: '1.1' })] });
        await host.send('Go.', 'Done.');
        await host.send('Again.', 'Done again.');
        const want = JSON.stringify(open(host).setup.stance);
        assert.equal(JSON.parse(want)[HERO_ID], false, 'Astra is carried off');
        await host.swipe('Told.');
        assert.equal(JSON.stringify(open(host).setup.stance), want, 'swipe');
        await host.st.swipeTo(host.ctx.chat.length - 1, 0);
        assert.equal(JSON.stringify(open(host).setup.stance), want, 'swipe back');
        await host.store.flush();
        const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
        await host.st.loadChat(chat, 'party-carry');
        host.ctx.chatMetadata = meta;
        assert.equal(JSON.stringify(open(host).setup.stance), want, 'reload');
    } finally { restore(); }
});

test('a won fight with a level 5 and a level 9 member: the end card gives each their own XP', async () => {
    const restore = seedCrypto(23);
    const host = await twoHeroes(9);
    try {
        assert.equal(openFight(host).ok, true);
        for (let at = 0; at < 30 && api(host).current().view.state !== 'end'; at += 1) stage(host, { inputs: [pick(HERO_ID, { target: '1.1' }), pick(REN_ID, { target: '1.1' })] });
        const end = api(host).current().view.end;
        assert.equal(end.outcome, 'won');
        const [astra, ren] = ['astra', 'ren'].map(id => end.members.find(member => member.id === id));
        assert.deepEqual([astra.xp, ren.xp], [30, 18], 'each member is paid at their own level (5 and 9 against level 5 foes), 15 for each foe');
        assert.equal(end.xpEach, null, 'no single shared figure');
    } finally { host.close(); restore(); }
});
