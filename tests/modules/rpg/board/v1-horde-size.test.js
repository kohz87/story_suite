// A horde too long for one reply: 3 heroes (level 10, their bars from the Character block's own rules) against 3 × 4 standard Ghouls, 8 waves. Fought out in one reply its result
// would pass the 64 KB the settle saves; the port refuses the exchange that would, Auto stops there ('full'), the reply settles and the next goes on to the same end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { COMBAT_V1_TEMPLATES } from '../../../../modules/rpg/templates-combat.js';
import { fightKind } from '../../../../modules/rpg/board/interaction.js';
import { FIGHT_KIND } from '../../../../modules/rpg/board/port-session.js';
import { runAuto } from '../../../../modules/rpg/board/auto-run.js';
import { readSheet } from '../../../../modules/rpg/read.js';
import { dice } from '../../../../core/interaction/dice.js';
import { DEFAULT_LIMITS } from '../../../../core/interaction/contract.js';
import { boardApi } from '../../../core/helpers/board-port.js';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';

const def = role => structuredClone(COMBAT_V1_TEMPLATES.find(entry => entry.definition.role === role).definition);
const size = value => Buffer.byteLength(JSON.stringify(value));
const LIMIT = DEFAULT_LIMITS.resultBytes;

async function world(t) {
    t.mock.method(console, 'warn', () => {});
    const restore = seedCrypto(2);
    t.after(restore);
    const host = await createHost({ settings: { features: { 'story-block.rpg': true } } });
    t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    for (const who of ['Astra', 'Mara', 'Ilse']) {
        const character = def('character'), skills = def('skills'), slug = who === 'Astra' ? 'character' : who.toLowerCase();
        Object.assign(character, { slug, name: who });
        Object.assign(skills, { slug: slug === 'character' ? 'skills' : `${slug}-skills`, name: `${who}'s skills` });
        assert.equal((await host.sdk.command('dm.define', { definition: character })).ok, true);
        assert.equal((await host.sdk.command('dm.define', { definition: skills, after: `pack.chat/${slug}` })).ok, true);
        await host.sdk.command('dm.set', { module: `pack.chat/${slug}`, fields: { who } });
        // (the bars are the block's own: its rules work them out from the level and stats set here)
        await host.sdk.command('dm.set', { module: `pack.chat/${slug}`, fields: { level: 10, str: 14, vit: 26, agi: 26, dex: 14 } });
        await host.sdk.command('dm.set', { module: `pack.chat/${skills.slug}`, fields: { who, skill1: 'Sweeping Cleave', stat1: 'str', type1: 'area', skill2: 'Piercing Strike', stat2: 'str', type2: 'attack' } });
    }
    for (const role of ['foes', 'rules']) assert.equal((await host.sdk.command('dm.define', { definition: def(role) })).ok, true);
    const ghouls = Object.fromEntries([1, 2, 3].flatMap(n => [[`foe${n}`, 'Ghoul'], [`count${n}`, 4], [`level${n}`, 7], [`tier${n}`, 'standard']]));
    await host.sdk.command('dm.set', { module: 'pack.chat/foes', fields: { ...ghouls, waves: 8 } });
    return host;
}
const api = host => boardApi(host.ctx.chatMetadata, () => host.head(), host.store.carrierSid(host.store.headIndex()));
const open = host => host.ctx.chatMetadata.storySuiteInteraction?.open;

test('a horde too long for one reply stops at the reply\'s limit, settles, and the next reply plays it to the same end', async t => {
    const host = await world(t);
    const heroes = readSheet(host.head()).characters.filter(hero => hero.v1);
    assert.deepEqual(heroes.map(hero => [hero.level, hero.hp]), [[10, 18], [10, 18], [10, 18]], 'three level-10 heroes at the bars their blocks give');
    assert.equal(api(host).open(FIGHT_KIND, { rules: {} }).ok, true);
    const setup = structuredClone(open(host).setup);
    assert.equal(setup.horde.reserve.length, 12, 'the front again, cut at the reserve\'s 12 groups (48 foes)');

    const first = runAuto({ api: api(host), cap: Infinity });
    assert.equal(first.stop, 'full', 'Auto "until the end" stops where the reply is full');
    assert.ok(first.done > 1);
    const staged = open(host), now = api(host).current().view.result;
    assert.equal(now.stop, 'open');
    assert.ok(size(now) <= LIMIT, `the staged result fits (${size(now)} bytes)`);
    const refused = api(host).auto(staged.id, 1);
    assert.equal(refused.code, 'TOO_BIG');
    assert.equal(refused.message, 'The Fight holds all one reply can save. Send to go on.', 'the kind\'s title, as the port\'s other refusals');
    assert.equal(open(host).steps.length, staged.steps.length, 'the refused exchange is not stored');

    // (the same exchanges played on in one reply: the case is real, the result would be over the limit)
    const steps = structuredClone(staged.steps), more = { inputs: steps[0].inputs.map(input => ({ actor: input.actor, choice: 'auto', args: {} })) };
    const whole = fightKind.play(host.head(), setup, [...steps, ...Array.from({ length: 40 }, () => more)], dice(staged.seed, 0)).result;
    assert.equal(whole.stop, 'won');
    assert.ok(size(whole) > LIMIT, `one reply could not save the whole horde (${size(whole)} bytes)`);

    await host.send('We hold.', 'They keep coming.');
    const settled = host.ctx.chat.at(-1).extra.storySuite.receipts.find(receipt => receipt.type === 'interaction.settle');
    assert.ok(settled, 'the reply settled the fight: the settle took the result');
    assert.deepEqual([settled.data.v2.result.stop, settled.data.v2.result.exchanges], ['open', first.done]);
    const next = open(host);
    assert.ok(next, 'and the fight goes on');
    assert.equal(next.setup.start.offset, first.done, 'from the exchanges the first reply holds');
    assert.ok(next.setup.start.horde, 'with the horde\'s place in its reserve');
    const second = runAuto({ api: api(host), cap: Infinity });
    assert.equal(second.stop, 'won', 'the next reply plays it to the end');
    const end = api(host).current().view.result;
    assert.ok(size(end) <= LIMIT, `and its result fits too (${size(end)} bytes)`);
    assert.equal(end.end, whole.end);
    assert.equal(first.done + second.done, whole.exchanges, 'in as many exchanges as the whole horde in one reply');
    assert.deepEqual([...settled.data.v2.result.lines, ...end.lines], whole.lines, 'die for die');
    await host.send('They break.', 'The last of them fall.');
    const paid = host.ctx.chat.at(-1).extra.storySuite.receipts.find(receipt => receipt.type === 'interaction.settle').data.v2.result;
    assert.equal(paid.stop, 'won');
    assert.ok(paid.award.xp.length === 3 && paid.award.horde === 1, 'the won horde pays each hero once, at its end');
    assert.equal(settled.data.v2.result.award?.xp?.length ?? 0, 0, 'the first reply paid no XP');
});
