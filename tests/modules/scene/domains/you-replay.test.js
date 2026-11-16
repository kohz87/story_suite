// Your look (MODULES §F126, src/v2/domains/scene.js): reader's edit, replay, Home header and rank packs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost } from '../../../testkit/index.js';
import { validatePack } from '../../../../../packs/validate.js';
import { YOU_CHARS, YOU_FEATURE, validateScene } from '../../../src/v2/domains/scene.js';
import { mountUi } from '../../../../../ui/legacy/ui-host.js';
import { gameHeroProps } from '../../../../../ui/legacy/view/game-header.js';
import { checkInvariants } from '../../../../../tests/suite/qa/helpers/oracle.js';
import { setupDom } from '../../../../../tests/ui/view/mounts/helpers.js';
import { NONE, block, fresh, lastIndex, look, rankPack, settle, staticText, tailText } from './you.helpers.js';

// ---------------------------------------------------------------------------------------------------
// The reader's edit

test('scene.you from the reader: each part replaces its own, empty clears, long is cut; the story is refused; an edit is marked', async t => {
    const host = await fresh(t);
    const run = payload => host.sdk.command('scene.you', payload);
    const first = await run({ rank: 'F-rank', wearing: 'a grey coat' });
    assert.equal(first.ok, true, first.message);
    assert.equal(first.receipt.data.edit, true);
    assert.equal(first.receipt.narrate, false);
    assert.deepEqual(look(host), { rank: 'F-rank', wearing: 'a grey coat', condition: '' });
    assert.equal((await run({ condition: 'tired' })).ok, true);
    assert.deepEqual(look(host), { rank: 'F-rank', wearing: 'a grey coat', condition: 'tired' });
    assert.equal((await run({ wearing: '' })).ok, true);
    assert.deepEqual(look(host), { rank: 'F-rank', wearing: '', condition: 'tired' });
    assert.equal((await run({ rank: '' })).ok, true);
    assert.deepEqual(look(host), { rank: '', wearing: '', condition: 'tired' });
    assert.equal((await run({ wearing: `<i>${'w'.repeat(200)}</i>` })).ok, true);
    assert.equal(Array.from(look(host).wearing).length, YOU_CHARS);
    assert.equal(look(host).wearing.includes('<'), false);
    const same = await run({ condition: 'tired' });
    assert.equal(same.ok, true);
    assert.equal(same.receipt.data.same, true, 'the same again changes nothing');
    assert.equal((await run({})).ok, false, 'nothing to set');
    assert.equal((await run({ wearing: 4 })).ok, false, 'text only');
    assert.equal((await run({ rank: 4 })).ok, false, 'text only');
    assert.deepEqual(validateScene(host.head().domains.scene), []);
    // A module's call is the same command; the story itself writes `~ you` and is refused the command.
    const ctxFail = [];
    const { sceneCommands } = await import('../../../src/v2/domains/scene.js');
    const refused = (() => {
        try { sceneCommands['scene.you']({ cause: 'story', fail: (code, message) => { ctxFail.push(code); throw new Error(message); }, draft: () => ({}) }, { wearing: 'x' }); } catch (error) { return error.message; }
        return '';
    })();
    assert.deepEqual(ctxFail, ['REFUSED']);
    assert.match(refused, /~ you line/);
});

// ---------------------------------------------------------------------------------------------------
// Replay: Re-read, swipes, a middle delete, a reload

test('Re-read, swipes, a middle delete and a reload keep the look as a rebuild does, each part from the replies still there', async t => {
    const host = await fresh(t);
    await host.send('We walk.', block('Rain.', ['~ you rank: F-rank | wearing: a coat | condition: wet']));
    const first = lastIndex(host);
    await host.send('On.', block('Fog.', ['~ you condition: chilled']));
    const second = lastIndex(host);
    // Re-read of the unchanged reply.
    assert.equal((await host.turn.reread(second)).ok, true);
    assert.deepEqual(look(host), { rank: 'F-rank', wearing: 'a coat', condition: 'chilled' });
    // A swipe has its own look; the other swipe without one rolls back to the reply before.
    await host.swipe(block('Sun.', ['~ you wearing: a straw hat']));
    assert.deepEqual(look(host), { rank: 'F-rank', wearing: 'a straw hat', condition: 'wet' });
    await host.swipe('No change this time.');
    assert.deepEqual(look(host), { rank: 'F-rank', wearing: 'a coat', condition: 'wet' });
    await host.st.swipeTo(second, 0);
    assert.deepEqual(look(host), { rank: 'F-rank', wearing: 'a coat', condition: 'chilled' });
    checkInvariants(host, 'after the swipes');
    // Deleting the reply that first wrote the look: the later reply's part replays, the first's other part is gone with it.
    await host.st.deleteMessage(first);
    await host.st.deleteMessage(first - 1);
    assert.deepEqual(host.store.problems(), [], 'nothing skipped');
    assert.deepEqual(look(host), { rank: '', wearing: '', condition: 'chilled' });
    assert.deepEqual(validateScene(host.head().domains.scene), []);
    checkInvariants(host, 'after the middle delete');
    // Deleting the last one: nothing again.
    await host.st.deleteMessage(lastIndex(host));
    assert.deepEqual(look(host), NONE);
    // A fresh host over the saved chat (a reload) reads the same.
    await host.send('On.', block('Hail.', ['~ you rank: E-rank | wearing: a hood | condition: damp']));
    const other = await createHost({ st: { chat: host.ctx.chat, extensionSettings: structuredClone(host.ctx.extensionSettings) } });
    t.after(() => other.close());
    assert.deepEqual(look(other), { rank: 'E-rank', wearing: 'a hood', condition: 'damp' });
    assert.deepEqual(other.head(), host.head());
});

test('an older chat with no look in its state reads empty, validates, and takes the first line', async t => {
    const host = await fresh(t);
    assert.equal('you' in host.head().domains.scene, false);
    assert.deepEqual(validateScene(host.head().domains.scene), []);
    assert.deepEqual(look(host), NONE);
    const other = await createHost({ st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
    t.after(() => other.close());
    await other.send('On.', block('Rain.', ['~ you condition: soaked']));
    assert.deepEqual(look(other), { rank: '', wearing: '', condition: 'soaked' });
});

// ---------------------------------------------------------------------------------------------------
// Home: the header's rows

test('the game view\'s header: props from the query (none while the feature is off or with no query), Wearing and Condition rows as plain lines, edited in the header\'s one editor', async t => {
    // The props: null query answer → no `you` at all.
    const props = answer => gameHeroProps({ state: { meta: { rev: 1 } }, query: name => (name === 'scene.you' ? answer : null) });
    assert.equal('you' in props(null), false);
    assert.equal(props({ rank: 'F', rankLabel: 'Guild rank', wearing: '', condition: '' }).you.rankLabel, 'Guild rank');
    assert.equal('you' in gameHeroProps({ state: { meta: { rev: 1 } }, query: () => { throw new Error('no query'); } }), false);
    assert.deepEqual(props({ rank: ' F ', rankLabel: 'Guild rank', wearing: ' a coat ', condition: '' }).you, { rank: 'F', rankLabel: 'Guild rank', wearing: 'a coat', condition: '', command: 'scene.you' });
    assert.deepEqual(props({ wearing: ' a coat ', condition: '' }).you, { wearing: 'a coat', condition: '', command: 'scene.you' }, 'no pack that gives a Rank: no rank part');
    assert.equal(props({ wearing: 'x'.repeat(300), condition: 'y' }).you.wearing.length, 120);

    const doc = setupDom(), form = doc.createElement('div');
    form.id = 'send_form';
    doc.body.appendChild(form);
    const host = await createHost();
    assert.equal((await host.packs.packs.install(rankPack())).ok, true);
    const ui = mountUi({ runtime: host, ctx: host.ctx, doc });
    t.after(() => { ui.destroy(); host.close(); });
    await host.send('Look.', 'A quiet road.');
    assert.equal(ui.mounts.screen.open('story-block/home'), true);
    const row = () => doc.querySelector('.ss-gameview-hero .ss-hero-you');
    const part = name => row()?.querySelector(`.ss-hero-you-part[data-part="${name}"]`);
    // Nothing set yet: the rows are there with a dash (the header's Edit button sets them).
    assert.ok(row(), 'the rows are drawn while both are empty');
    assert.deepEqual(['rank', 'wearing', 'condition'].map(name => part(name).querySelector('.ss-hero-you-label').textContent), ['Guild rank', 'Wearing', 'Condition']);
    assert.deepEqual(['rank', 'wearing', 'condition'].map(name => part(name).querySelector('.ss-hero-you-text').textContent), ['—', '—', '—']);
    assert.deepEqual(row().querySelectorAll('.ss-hero-you-part').map(item => item.getAttribute('data-part')), ['rank', 'wearing', 'condition'], 'Rank first');
    assert.equal(row().querySelectorAll('button').length, 0, 'the rows are plain lines: no pencil (UI cleanup, Nov 2)');
    // The editor's Character group: Guild rank (the pack's word), Wearing, Condition.
    const editor = () => doc.querySelector('.ss-gameview-hero .ss-hero-editor');
    const field = label => editor().querySelectorAll('label').find(each => each.querySelector('span').textContent === label)?.querySelector('input');
    doc.querySelector('.ss-gameview-hero .ss-hero-edit').click();
    assert.deepEqual(editor().querySelectorAll('legend').map(node => node.textContent), ['Story', 'Character']);
    assert.deepEqual(['Guild rank', 'Wearing', 'Condition'].map(label => field(label)?.value), ['', '', '']);
    editor().querySelector('.ss-w-editable-cancel').click();
    // The story sets them: the rows show the words.
    await host.send('We walk.', block('Rain.', ['~ you rank: F-rank | wearing: oilskin coat, boots | condition: tired, cold']));
    assert.equal(part('rank').querySelector('.ss-hero-you-text').textContent, 'F-rank');
    assert.equal(part('wearing').querySelector('.ss-hero-you-text').textContent, 'oilskin coat, boots');
    assert.equal(part('condition').querySelector('.ss-hero-you-text').textContent, 'tired, cold');
    // The editor: one `scene.you` edit for the part that changed, and the row follows.
    doc.querySelector('.ss-gameview-hero .ss-hero-edit').click();
    assert.deepEqual(['Guild rank', 'Wearing', 'Condition'].map(label => field(label).value), ['F-rank', 'oilskin coat, boots', 'tired, cold']);
    field('Condition').value = 'rested';
    editor().querySelector('.ss-w-editable-save').click();
    await settle();
    assert.deepEqual(look(host), { rank: 'F-rank', wearing: 'oilskin coat, boots', condition: 'rested' });
    assert.equal(host.store.receipts().at(-1)?.receipt?.type ?? host.store.receipts().at(-1)?.type, 'scene.you');
    assert.equal(part('condition').querySelector('.ss-hero-you-text').textContent, 'rested');
    // An empty save clears the part.
    doc.querySelector('.ss-gameview-hero .ss-hero-edit').click();
    field('Wearing').value = '';
    editor().querySelector('.ss-w-editable-save').click();
    await settle();
    assert.deepEqual(look(host), { rank: 'F-rank', wearing: '', condition: 'rested' });
    assert.equal(part('wearing').querySelector('.ss-hero-you-text').textContent, '—');
    // Off: no rows at all; on again: they return.
    host.features.set(YOU_FEATURE, false);
    assert.equal(row()?.hidden ?? true, true, 'hidden while the feature is off');
    host.features.set(YOU_FEATURE, true);
    assert.equal(row().hidden, false);
    assert.equal(part('condition').querySelector('.ss-hero-you-text').textContent, 'rested');
});

// ---------------------------------------------------------------------------------------------------
// Rank comes from a pack (`content.you.rank`): other kinds of game have none

test('no pack gives a Rank: none anywhere (no grammar word, no answer, no tail word, no Home line); `~ you rank:` drops only the rank part; the rest works', async t => {
    const host = await fresh(t, { rank: false });
    assert.equal(host.sdk.query('packs.youRank'), null);
    const line = staticText(host).split('\n').find(item => item.startsWith('~ you '));
    assert.equal(line, '~ you wearing: what You has on | condition: how You is (only when one changes; each at most 120 characters)');
    assert.doesNotMatch(staticText(host), /rank/i, 'the instructions never say rank');
    assert.deepEqual(host.sdk.query('scene.you'), { wearing: '', condition: '' }, 'no rank, no label in the answer');
    await host.send('We walk.', block('Rain.', ['~ you rank: F-rank | wearing: a coat']));
    const told = host.turn.problems().filter(item => item.index === lastIndex(host));
    assert.equal(told.length, 1, 'one plain Problem');
    assert.match(told[0].message, /This story has no rank/);
    assert.deepEqual(host.sdk.query('scene.you'), { wearing: 'a coat', condition: '' }, 'only the rank part was left out: the wearing is kept');
    assert.equal(host.head().domains.scene.you.rank, '', 'no rank saved');
    // The rank alone is still refused whole (nothing to keep).
    await host.send('Rain.', block('Rain.', ['~ you rank: F-rank']));
    assert.equal(host.turn.problems().filter(item => item.index === lastIndex(host)).length, 1);
    assert.deepEqual(host.sdk.query('scene.you'), { wearing: 'a coat', condition: '' });
    await host.send('On.', block('Rain.', ['~ you wearing: a coat | condition: wet']));
    assert.deepEqual(host.sdk.query('scene.you'), { wearing: 'a coat', condition: 'wet' });
    // An empty rank part, wearing and condition: wearing and condition apply, the rank part is one Problem.
    await host.send('On.', block('Rain.', ['~ you rank: | wearing: a hat | condition: dry']));
    assert.equal(host.turn.problems().filter(item => item.index === lastIndex(host)).length, 1);
    assert.deepEqual(host.sdk.query('scene.you'), { wearing: 'a hat', condition: 'dry' });
    await host.send('On.', block('Rain.', ['~ you wearing: a coat | condition: wet']));
    await host.send('On.', 'On.');
    assert.match(tailText(host), /^You: wears a coat; condition wet$/m);
    assert.doesNotMatch(tailText(host), /rank/i);
    const refused = await host.sdk.command('scene.you', { rank: 'F-rank' });
    assert.equal(refused.ok, false, 'the reader\'s pencil does not exist either: the command refuses');
    assert.match(refused.message, /no rank/);
    assert.equal((await host.sdk.command('scene.you', { wearing: 'a hat' })).ok, true);
    // The header has no Rank part.
    assert.equal('rank' in gameHeroProps({ state: { meta: { rev: 1 } }, query: () => host.sdk.query('scene.you') }).you, false);
});

test('a pack with content.you.rank gives the Rank its word everywhere; the first enabled pack that has one wins; turned off, the Rank is hidden and its value kept', async t => {
    const host = await fresh(t, { rank: false });
    assert.equal((await host.packs.packs.install(rankPack('first', 'Guild rank'))).ok, true);
    assert.equal((await host.packs.packs.install(rankPack('second', 'Standing'))).ok, true);
    assert.deepEqual(host.sdk.query('packs.youRank'), { pack: 'first', label: 'Guild rank' }, 'the first enabled pack wins');
    await host.send('We walk.', block('Rain.', ['~ you rank: F-rank, Adventurer Guild | wearing: a coat']));
    assert.deepEqual(host.sdk.query('scene.you'), { rank: 'F-rank, Adventurer Guild', rankLabel: 'Guild rank', wearing: 'a coat', condition: '' });
    assert.equal(staticText(host).split('\n').find(item => item.startsWith('~ you ')), '~ you rank: Guild rank | wearing: what You has on | condition: how You is (only when one changes; each at most 120 characters)');
    await host.send('On.', 'On.');
    assert.match(tailText(host), /^You: Guild rank F-rank, Adventurer Guild; wears a coat$/m);
    // The first pack off: the next one's word; both off: no Rank (the instructions change back), the value stays stored.
    assert.equal(await host.packs.packs.setEnabled('first', false), true);
    assert.equal(host.sdk.query('scene.you').rankLabel, 'Standing');
    assert.equal(await host.packs.packs.setEnabled('second', false), true);
    assert.deepEqual(host.sdk.query('scene.you'), { wearing: 'a coat', condition: '' });
    await host.send('On.', 'On.');
    assert.doesNotMatch(staticText(host), /rank/i);
    assert.doesNotMatch(tailText(host), /rank/i);
    assert.equal(host.head().domains.scene.you.rank, 'F-rank, Adventurer Guild', 'kept while no pack gives a Rank');
    // Turned on again: it is back.
    assert.equal(await host.packs.packs.setEnabled('first', true), true);
    assert.deepEqual(host.sdk.query('scene.you'), { rank: 'F-rank, Adventurer Guild', rankLabel: 'Guild rank', wearing: 'a coat', condition: '' });
    await host.send('On.', 'On.');
    assert.match(tailText(host), /^You: Guild rank F-rank, Adventurer Guild; wears a coat$/m);
});

test('the Ersveil example pack gives the Rank the word "Guild rank"; its content.you checks like the rest of a pack', async t => {
    const ersveil = JSON.parse(readFileSync(new URL('../../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8'));
    assert.deepEqual(ersveil.content.you, { rank: { label: 'Guild rank' } });
    const host = await fresh(t, { rank: false });
    assert.equal((await host.packs.packs.install(ersveil)).ok, true);
    assert.deepEqual(host.sdk.query('packs.youRank'), { pack: ersveil.id, label: 'Guild rank' });
    await host.send('I register.', block('The clerk writes it down.', ['~ you rank: F-rank, Adventurer Guild (provisional)']));
    assert.equal(host.sdk.query('scene.you').rankLabel, 'Guild rank');
    assert.equal(host.sdk.query('scene.you').rank, 'F-rank, Adventurer Guild (provisional)');
    // The validator: the shape, the label and unknown keys.
    const check = you => validatePack({ id: 'p', version: '1.0.0', requires: { storyBlock: '^2' }, content: { you } });
    assert.equal(check({ rank: { label: 'Guild rank' } }).ok, true);
    assert.deepEqual(check({ rank: { label: ' Guild   rank ' } }).pack.content.you, { rank: { label: 'Guild rank' } });
    assert.deepEqual(check({}).pack.content.you, {}, 'nothing to opt in to');
    const bad = (you, code, path) => {
        const result = check(you);
        assert.equal(result.ok, false, JSON.stringify(you));
        assert.ok(result.errors.some(error => error.code === code && error.path === path), `${JSON.stringify(you)}: ${JSON.stringify(result.errors.map(error => [error.code, error.path]))}`);
    };
    bad({ rank: { label: 'x'.repeat(31) } }, 'BAD_CONTENT', 'content.you.rank.label');
    bad({ rank: { label: '' } }, 'BAD_CONTENT', 'content.you.rank.label');
    bad({ rank: {} }, 'BAD_CONTENT', 'content.you.rank.label');
    bad({ rank: { label: 5 } }, 'BAD_CONTENT', 'content.you.rank.label');
    bad({ rank: { label: '<b>Rank</b>' } }, 'BAD_CONTENT', 'content.you.rank.label');
    bad({ rank: { label: '{{user}} rank' } }, 'BAD_CONTENT', 'content.you.rank.label');
    bad({ rank: { label: 'Rank', colour: 'red' } }, 'UNKNOWN_FIELD', 'content.you.rank.colour');
    bad({ rank: { label: 'Rank' }, title: 'x' }, 'UNKNOWN_FIELD', 'content.you.title');
    bad({ rank: 'Guild rank' }, 'BAD_CONTENT', 'content.you.rank');
    bad(['rank'], 'BAD_CONTENT', 'content.you');
    // A pack that does not use it normalizes as it always did (no `you` key).
    assert.equal('you' in validatePack({ id: 'p', version: '1.0.0', requires: { storyBlock: '^2' }, content: {} }).pack.content, false);
});
