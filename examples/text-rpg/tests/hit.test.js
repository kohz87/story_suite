// A roll wounds only with `| hit: …` (the story shows the roller struck): the band sets the stages; foes standing or not change nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTry } from '../src/module-parts/kinds/try.js';
import { rollsOf } from '../src/module-parts/rolls.js';
import { rollCards } from '../src/module-parts/roll-cards.js';
import { woundsOf } from '../src/module-parts/standing.js';
import { astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';
import { withFoes } from './helpers/foes.js';
import { astraOf, reply, tries, withAstra } from './helpers/host.js';

// With the narrator's word `ordinary` (15) and no foes: 13 is a success at a cost, 9 a failure, 5 a bad failure, 15 a success.
const roll = (die, { hit, foes = false, what = 'Lore' } = {}) => {
    const slice = sliceOf([astra()], { list: [die, 10, 10], floor: 0 });
    if (foes) withFoes(slice, [['Foes', 3, 2]]);
    const done = run(applyTry, fakeCtx(slice), line('try', 'Astra', `${what}; ordinary`, hit === undefined ? {} : { hit }));
    assert.equal(done.ok, true, done.message);
    return { me: slice.members.ac_astra001, data: done.result.data };
};
const seen = ({ me, data }) => [data.band, me.wounds, data.paid, data.hit];

test('a failure wounds one stage with a hit and none without, with foes standing or not', () => {
    for (const foes of [false, true]) {
        assert.deepEqual(seen(roll(9, { foes, hit: 'a boar' })), ['failure', 1, 'wound', 'a boar']);
        assert.deepEqual(seen(roll(9, { foes })), ['failure', 0, 'none', undefined]);
    }
});

test('a bad failure wounds two stages with a hit and none without, out of danger too', () => {
    for (const foes of [false, true]) {
        assert.deepEqual(seen(roll(5, { foes, hit: 'a fall' })), ['bad', 2, 'wound', 'a fall']);
        assert.deepEqual(seen(roll(5, { foes })), ['bad', 0, 'none', undefined]);
    }
});

test('a success at a cost with no hit, foes standing, pays the skill again, else stamina; a hit wounds instead', () => {
    const skill = roll(13, { foes: true, what: 'Obscure' });
    assert.deepEqual([...seen(skill), skill.me.pools.sp.now], ['cost', 0, 'skill', undefined, 10]);
    const stamina = roll(13, { foes: true });
    assert.deepEqual([...seen(stamina), stamina.me.pools.sp.now], ['cost', 0, 'stamina', undefined, 10]);
    const struck = roll(13, { foes: true, hit: 'a blade' });
    assert.deepEqual([...seen(struck), struck.me.pools.sp.now], ['cost', 1, 'wound', 'a blade', 14]);
});

test('a success keeps no hit; an empty hit is none; a long one is tidied and cut to 80 characters', () => {
    assert.deepEqual(seen(roll(15, { hit: 'a blade' })), ['success', 0, 'none', undefined]);
    assert.deepEqual(seen(roll(9, { hit: '   ' })), ['failure', 0, 'none', undefined]);
    assert.equal(roll(9, { hit: `  tusk   to the thigh ${'x'.repeat(100)}` }).data.hit, `tusk to the thigh ${'x'.repeat(62)}`);
});

test('the card says what struck, and an old receipt with no hit says just "a wound"', () => {
    const data = roll(9, { hit: 'tusk to the thigh' }).data;
    const textOf = stored => {
        const entries = [{ index: 2, receipt: { type: 'capture.try', data: stored } }];
        const card = Object.values(rollCards())[0].for({}, null, { index: 2, query: () => rollsOf(entries, 2, () => 'Astra') });
        return card.rows[0].text;
    };
    assert.match(textOf(data), / · a wound \(tusk to the thigh\)/);
    const { hit, ...old } = data;
    assert.equal(hit, 'tusk to the thigh');
    assert.match(textOf(old), / · a wound( · |$)/);
});

test('on the host: a hit line replays as it ran (Re-read and rebuild == live), and a line with no hit does not wound', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        // A -3 roll (not on the sheet) at near impossible always fails, whatever the die.
        await host.send('One.', reply('First.', ['? try Astra | Juggling | near impossible']));
        assert.equal(woundsOf(astraOf(host)), 0);
        await host.send('Two.', reply('Second.', ['? try Astra | Juggling | near impossible | hit: tusk to the thigh']));
        const at = host.ctx.chat.length - 1;
        const [, { data }] = tries(host);
        assert.equal(data.hit, 'tusk to the thigh');
        assert.equal(woundsOf(astraOf(host)), data.band === 'bad' ? 2 : 1);
        const live = JSON.stringify(host.head());
        assert.equal((await host.sdk.reread(at)).ok, true);
        assert.equal(JSON.stringify(host.head()), live, 'an unchanged Re-read changes nothing');
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, 'rebuild == live');
        assert.deepEqual(host.store.problems(), []);
    } finally {
        host.close();
    }
});
