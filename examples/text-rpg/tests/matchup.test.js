// The matchup each reply is told: foes weight against the party's weight, four words, told in the tail with its rule and kept for the card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { foesWeight, matchupBand, memberWeight } from '../src/rules/matchup.js';
import { matchupOf } from '../src/module-parts/matchup.js';
import { beforeGenerate } from '../src/module-parts/hooks.js';
import { tailOf } from '../src/module-parts/tail.js';
import { astra, sliceOf } from './helpers/fake-ctx.js';
import { withFoes } from './helpers/foes.js';

const hero = (extra = {}, name = 'Astra', id = 'ac_astra001') => astra({ id, name, ...extra });
const view = (slice, extra = {}) => ({ state: { domains: { textRpg: slice } }, feature: id => id === 'text-rpg.on', query: () => null, settings: () => ({}), chat: {}, ...extra });

test('a foe weighs by threat (far beneath ¼, beneath ½, fair 1, above 2, far above 3, beyond 4) times how many stand', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(threat => foesWeight([{ left: 4, threat }])), [1, 2, 4, 8, 12, 16]);
    assert.equal(foesWeight([{ left: 24, threat: 1 }, { left: 0, threat: 5 }, { left: 2, threat: 3 }]), 16, 'the fallen weigh nothing');
    assert.equal(foesWeight([]), 0);
    assert.equal(foesWeight(null), 0);
});

test('a member weighs 1 × the health factor (Unhurt 1, Scratched .9, Hurt .7, Wounded .5, Badly wounded .25) × the stamina factor (Fresh and Steady 1, Low .8, Drained and Empty .6); Down weighs nothing', () => {
    assert.deepEqual([0, 1, 2, 3, 4].map(stage => memberWeight(stage, 0)), [1, 0.9, 0.7, 0.5, 0.25]);
    assert.deepEqual([0, 1, 2, 3, 4].map(stage => memberWeight(0, stage)), [1, 1, 0.8, 0.6, 0.6]);
    assert.ok(Math.abs(memberWeight(3, 3) - 0.3) < 1e-9);
    assert.equal(memberWeight(5, 0), 0, 'Down');
    assert.equal(memberWeight(-1, 0), 0);
});

test('the ratio of foes to party: favoured up to ½, even up to 1½, outmatched up to 4, hopeless above; no party is hopeless', () => {
    assert.deepEqual([[1, 2], [0.5, 1], [0.51, 1], [1.5, 1], [1.51, 1], [4, 1], [4.01, 1], [30, 1]].map(([foes, party]) => matchupBand(foes, party)),
        ['favoured', 'favoured', 'even', 'even', 'outmatched', 'outmatched', 'hopeless', 'hopeless']);
    assert.equal(matchupBand(1, 0), 'hopeless');
    assert.equal(matchupBand(0, 1), 'favoured');
});

test('no foes record, or none standing: no matchup', () => {
    assert.equal(matchupOf(sliceOf([hero()])), null);
    assert.equal(matchupOf(withFoes(sliceOf([hero()]), [['rats', 5, 1, 0]])), null);
});

test('the matchup is read from the standing foes and each member\'s health and stamina, and says why', () => {
    const wounded = hero({ wounds: 3 });
    const slice = withFoes(sliceOf([wounded]), [['rats', 24, 1]]);
    assert.deepEqual(matchupOf(slice), { band: 'hopeless', why: '24 rats beneath, Astra wounded' }, '12 against ½');
    const even = withFoes(sliceOf([hero(), hero({}, 'Bram', 'ac_bram0001')]), [['wolves', 3, 2]]);
    assert.deepEqual(matchupOf(even), { band: 'even', why: '3 wolves a fair match, the party unhurt' }, '3 against 2');
    const fresh = withFoes(sliceOf([hero(), hero({}, 'Bram', 'ac_bram0001')]), [['thugs', 1, 1]]);
    assert.equal(matchupOf(fresh).band, 'favoured');
    const tired = hero();
    tired.pools.sp.now = 1;
    const low = withFoes(sliceOf([tired]), [['rats', 2, 2], ['bandits', 2, 3]]);
    assert.deepEqual(matchupOf(low), { band: 'hopeless', why: '2 rats a fair match, 2 bandits above, Astra drained' }, '6 against .6');
});

test('Down and fallen members count nothing; a party that cannot act is hopeless', () => {
    const down = hero({}, 'Bram', 'ac_bram0001');
    down.down = true;
    const gone = hero({ fallen: { how: 'x' } }, 'Edda', 'ac_edda0001');
    const slice = withFoes(sliceOf([hero(), down, gone]), [['rats', 2, 2]]);
    assert.deepEqual(matchupOf(slice), { band: 'outmatched', why: '2 rats a fair match, Bram down' }, '2 against 1');
    const alone = hero();
    alone.down = true;
    assert.equal(matchupOf(withFoes(sliceOf([alone]), [['rats', 1, 0]])).band, 'hopeless');
});

test('every band is told in the tail with its rule; with no foes the tail has no matchup line', () => {
    const slice = withFoes(sliceOf([hero({ wounds: 3 })], { list: [11, 3, 20], floor: 0 }), [['rats', 24, 1]]);
    const { lines } = tailOf(view(slice, { query: name => (name === 'textRpg.dice' ? slice.dice.sw_reply0001 : null) }));
    const told = lines.find(text => text.startsWith('Matchup:'));
    assert.match(told, /^Matchup: hopeless \(24 rats beneath, Astra wounded\)\. Favoured: they should win\. Even: the dice decide\. Outmatched: they lose unless an edge was set up before\. Hopeless: no roll saves them\.$/);
    assert.ok(lines.indexOf(told) > 0 && lines.indexOf(told) < lines.findIndex(text => text.startsWith('Astra (')), 'after the note, before the members');
    assert.ok(!tailOf(view(sliceOf([hero()]))).lines.some(text => text.startsWith('Matchup:')));
});

test('the dice step the reply is offered with keeps the matchup for the card', () => {
    const slice = withFoes(sliceOf([hero()], null), [['rats', 24, 1]]);
    const payload = beforeGenerate(view(slice), { type: 'normal' }).commands[0].payload;
    assert.deepEqual(payload.matchup, { band: 'hopeless', why: '24 rats beneath, the party unhurt' });
    assert.equal(beforeGenerate(view(sliceOf([hero()], null)), { type: 'normal' }).commands[0].payload.matchup, undefined, 'no foes: no matchup');
});
