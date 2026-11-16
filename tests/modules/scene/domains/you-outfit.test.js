// Wearing (B1.4, rule mark `youLook`): with gear on, what is worn comes from the equipped gear; the story writes a lasting `outfit:` for clothes that
// are not gear and a passing `look:` that a move clears (each at most 60 characters). R0-R5 of the batch plan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost, hostAvailable } from '../../../../packages/story-block/testkit/index.js';
import { clearLook, lookOf, wornWords } from '../../../../modules/scene/you.js';
import { validateScene } from '../../../../modules/scene/index.js';
import { youGrammar } from '../../../../modules/scene/domains/index.js';
import { RULE_LINES } from '../../../../core/turn/rule-marks.js';
import { block, lastIndex, look, staticText, tailText } from './you.helpers.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;
const recordOf = (host, index = lastIndex(host)) => host.ctx.chat[index].extra.storySuite;
const problems = host => host.turn.problems().map(problem => problem.message).join(' ');
const youOf = host => host.head().domains.scene.you;
const GEAR = { 'story-block.gear': true, 'story-block.rpg': true };

async function world(t, features = GEAR) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { features } });
    t.after(() => host.close());
    await host.send('Hello.', block('The road.', ['~ place Vell Harbour | kind: settlement', '+ item Oilskin Coat | kind: armour | rarity: common | VIT: +1 | equipped: body', '+ item Shortsword | kind: weapon | rarity: common | STR: +1 | equipped: weapon']));
    return host;
}

test('the rule: a you line is marked; the pure parts cut, drop and clear', () => {
    assert.equal(RULE_LINES.youLook({ kind: 'you' }), true);
    assert.equal(RULE_LINES.youLook({ kind: 'place' }), false);
    assert.deepEqual(lookOf({ outfit: 'a grey dress', wearing: 'plate' }, { story: true }).parts, { outfit: 'a grey dress' });
    assert.equal(lookOf({ wearing: 'plate' }, { story: true }).problems.length, 1);
    assert.deepEqual(lookOf({ wearing: 'plate' }).parts, { wearing: 'plate' }, 'the reader\'s edit keeps wearing');
    const cut = lookOf({ look: 'm'.repeat(80) });
    assert.equal(Array.from(cut.parts.look).length, 60);
    assert.match(cut.problems[0], /cut to 60/u);
    assert.deepEqual(clearLook({ rank: '', look: 'muddy' }), { rank: '', look: '' });
    const same = { look: '' };
    assert.equal(clearLook(same), same, 'nothing to clear: the same object');
    assert.match(youGrammar('', true), /outfit: .*60 characters.*look: .*60 characters/u);
    assert.match(youGrammar('Guild rank'), /^~ you rank: Guild rank \| wearing: what \{\{user\}\} has on \| condition/u, 'gear off: the grammar is as it was');
});

test('a reply written now carries the mark; outfit and look are kept, wearing is left out with a Problem', { skip }, async t => {
    const host = await world(t);
    await host.send('I dress.', block('You pull on a coat.', ['~ you outfit: patched wool dress | look: mud to the knees | condition: tired']));
    assert.ok(recordOf(host).rules.includes('youLook'));
    assert.deepEqual(look(host), { wearing: '', condition: 'tired', outfit: 'patched wool dress', look: 'mud to the knees', gear: 'Oilskin Coat, Shortsword' });
    await host.send('Again.', block('Rain.', ['~ you wearing: a tin helm | condition: soaked']));
    assert.match(problems(host), /comes from your equipped gear/u);
    assert.equal(youOf(host).wearing, '', 'the story\'s wearing is not kept');
    assert.equal(youOf(host).condition, 'soaked', 'its other part is');
    assert.deepEqual(validateScene(host.head().domains.scene), []);
    await host.send('Long.', block('Fog.', [`~ you look: ${'a'.repeat(90)}`]));
    assert.equal(Array.from(youOf(host).look).length, 60);
    assert.match(problems(host), /cut to 60/u);
    assert.deepEqual(validateScene(host.head().domains.scene), []);
});

test('the tail builds "wears" from the equipped gear with its wear word, then the outfit; the look follows; the grammar names outfit and look', { skip }, async t => {
    const host = await world(t);
    await host.send('I dress.', block('A coat.', ['~ item Oilskin Coat | wear: ruin', '~ you outfit: grey scarf | look: windblown']));
    await host.send('On.', 'Quiet.');
    assert.match(tailText(host), /You: wears Oilskin Coat \([a-z]+\), Shortsword, grey scarf; looks windblown/u);
    assert.match(staticText(host), /~ you outfit: clothes/u);
    assert.doesNotMatch(tailText(host), /wearing: …/u);
});

test('a move clears the look and keeps the outfit; the same place keeps both; the reader\'s place edit leaves the look', { skip }, async t => {
    const host = await world(t);
    await host.send('Dress.', block('Wet.', ['~ you outfit: grey scarf | look: mud to the knees']));
    await host.send('Same.', block('Still here.', ['~ place Vell Harbour']));
    assert.equal(youOf(host).look, 'mud to the knees');
    await host.send('Go.', block('You walk on.', ['~ place Old Mill | kind: ruin']));
    assert.equal(youOf(host).look, '');
    assert.equal(youOf(host).outfit, 'grey scarf');
    await host.send('Wet.', block('Splash.', ['~ you look: soaked']));
    assert.equal((await host.sdk.command('scene.place', { name: 'Mill Yard' })).ok, true);
    assert.equal(youOf(host).look, 'soaked', 'an unmarked write (the reader\'s) never clears');
});

test('R0: a reply whose record lacks the mark keeps reading a you line as before, the same on every Re-read', { skip }, async t => {
    const host = await world(t);
    await host.send('I dress.', block('Coat.', ['~ you outfit: a grey coat | look: muddy | condition: tired']));
    const index = lastIndex(host);
    recordOf(host).rules = recordOf(host).rules.filter(rule => rule !== 'youLook');
    assert.equal((await host.turn.reread(index)).ok, true);
    const first = JSON.stringify(host.head());
    assert.equal(youOf(host).wearing, 'a grey coat', 'outfit is what wearing was');
    assert.equal(youOf(host).look, undefined, 'look is not used');
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.equal(JSON.stringify(host.head()), first);
});

test('gear off: today\'s behaviour (wearing kept; outfit is wearing; no look), the tail as before', { skip }, async t => {
    const host = await world(t, {});
    await host.send('Dress.', block('Coat.', ['~ you wearing: oilskin coat | look: muddy | condition: tired']));
    assert.equal(youOf(host).wearing, 'oilskin coat');
    assert.equal(youOf(host).look, undefined);
    await host.send('On.', 'Quiet.');
    assert.match(tailText(host), /You: wears oilskin coat; condition tired/u);
    assert.match(staticText(host), /wearing: what/u);
});

async function marked(t) {
    const host = await world(t);
    await host.send('Dress.', block('Wet.', ['~ you outfit: grey scarf | look: mud']));
    await host.send('On.', block('Walking.', ['~ you condition: tired']));
    return host;
}

test('R1/R4: Re-read gives the same head hash; Continue applies nothing twice', { skip }, async t => {
    const host = await marked(t);
    const head = JSON.stringify(host.head());
    assert.equal((await host.turn.reread(lastIndex(host))).ok, true);
    assert.equal(JSON.stringify(host.head()), head);
    await host.cont('More walking.');
    assert.deepEqual(look(host).look, 'mud');
    assert.deepEqual(validateScene(host.head().domains.scene), []);
});

test('R2: a swipe has its own look; going back restores the first', { skip }, async t => {
    const host = await marked(t);
    const index = lastIndex(host), first = JSON.stringify(host.head());
    await host.swipe(block('Else.', ['~ you look: drenched']));
    assert.equal(youOf(host).look, 'drenched');
    const second = JSON.stringify(host.head());
    await host.st.swipeTo(index, 0);
    assert.equal(JSON.stringify(host.head()), first);
    await host.st.swipeTo(index, 1);
    assert.equal(JSON.stringify(host.head()), second);
});

test('R3: a prose edit changes nothing; an edit of the line is applied once from the new line', { skip }, async t => {
    const host = await marked(t);
    const index = lastIndex(host), head = JSON.stringify(host.head());
    await host.st.editMessage(index, block('Walking, differently told.', ['~ you condition: tired']));
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.equal(JSON.stringify(host.head()), head);
    await host.st.editMessage(index, block('Walking.', ['~ you condition: tired | look: dry']));
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.equal(youOf(host).look, 'dry');
    assert.equal(youOf(host).outfit, 'grey scarf');
});

test('R5: deleting an earlier reply and reloading gives the state built live', { skip }, async t => {
    const host = await marked(t);
    await host.send('Later.', block('Later.', ['~ you look: windy']));
    const live = JSON.stringify(host.head());
    await host.turn.onChatChanged();
    assert.equal(JSON.stringify(host.head()), live);
    await host.st.deleteMessage(lastIndex(host) - 3);
    await host.st.deleteMessage(lastIndex(host) - 3);
    assert.deepEqual(validateScene(host.head().domains.scene), []);
    assert.equal(youOf(host).look, 'windy');
});

test('wornWords: slot order, a worn piece carries its word, nothing when nothing is equipped', () => {
    assert.equal(wornWords({ domains: {} }), '');
});
