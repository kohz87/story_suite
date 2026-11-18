// The Combat rules text (modules/rpg/view/settings-data.js): the text is saved as an edit of the chat's Combat rules block (`dm.redefine`) through the real host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CORE_FEATURE } from '../../../../core/features.js';
import { DIFFICULTY_SETTING, STANDARD, STANDARD_PRESETS, STANDARD_SETTING } from '../../../../modules/rpg/index.js';
import { CHOOSER_TEMPLATES } from '../../../../modules/rpg/templates.js';
import { COMBAT_DEFAULT, COMBAT_MAX, combatBlock, combatTemplate, customOf, withPrompt } from '../../../../modules/rpg/view/settings-data.js';
import { reload } from '../../data-modules/helpers.js';
import { characterDefinition, fakeState, roleOf, skillsDefinition } from './helpers.js';
import { combat, open, promptOf, saveCombat } from './settings.helpers.js';

test('Combat: the chat\'s Combat rules text is saved as an edit of that block; it reaches the narrator and survives a rebuild and a reload', async t => {
    const { host } = await open(t, { rules: true });
    host.features.set(CORE_FEATURE.fightBoard, false);
    assert.equal(promptOf(host), COMBAT_DEFAULT, 'the block\'s own text');
    const hashBefore = host.head().domains.dataModules.active['pack.chat/combat-rules'].hash;
    const text = '[COMBAT SYSTEM] Fights are short and cruel. {{user}} loses against odds.';
    assert.equal((await saveCombat(host, text)).ok, true);
    assert.equal(promptOf(host), text);
    const active = host.head().domains.dataModules.active['pack.chat/combat-rules'];
    assert.notEqual(active.hash, hashBefore, 'a new definition hash');
    assert.ok(active.generation > 1, 'a new generation of the block');
    const head = host.store.headIndex();
    const receipts = host.ctx.chat[head].extra.storySuite.receipts.filter(receipt => receipt.type === 'dm.redefine');
    assert.equal(receipts.length, 1, 'one recorded edit on the latest reply');
    assert.equal(receipts[0].summary, 'You changed Combat rules.');
    // The narrator reads it in the prompt of a reply with a fight (lean prompt, 3 Nov: a quiet reply leaves the combat text out; lean-rpg/read.js isQuiet).
    const { request: quiet } = await host.send('I draw.', 'Steel rings.');
    assert.ok(!quiet.chat.some(message => message.content?.includes('Fights are short and cruel.')), 'a quiet reply does not carry it');
    assert.equal((await host.sdk.command('dm.define', { definition: structuredClone(CHOOSER_TEMPLATES.find(entry => entry.name === 'Foes').definition) })).ok, true);
    await host.send('A hound leaps.', `The hound leaps.\n<Changes>\n+ dm foes — it attacks | kind: set-slot-1 | name: Silt Hound | count: 1 | level: 5\n</Changes>`);
    const { request } = await host.send('I strike.', 'Steel rings.');
    assert.ok(request.chat.some(message => message.content?.includes('Fights are short and cruel.')), 'in the prompt');
    assert.ok(!request.chat.some(message => message.content?.includes('No Plot Armor')), 'and the old text is gone');
    host.store.rebuild();
    assert.equal(promptOf(host), text, 'rebuild = live');
    await reload(host);
    assert.equal(promptOf(host), text, 'reload = live');
});

test('Combat: an edit rides on the latest reply, so deleting that reply takes it back', async t => {
    const { host } = await open(t, { rules: true });
    await host.send('Go on.', 'A later reply, so the block itself is older than the edit.');
    assert.equal((await saveCombat(host, 'Only this.')).ok, true);
    assert.equal(promptOf(host), 'Only this.');
    await host.st.deleteMessage(host.store.headIndex());
    assert.equal(promptOf(host), COMBAT_DEFAULT);
});

test('Combat: a swipe of the reply that carried an edit takes it back', async t => {
    const { host } = await open(t, { rules: true });
    await host.send('Go on.', 'Quiet.');
    assert.equal((await saveCombat(host, 'Only this.')).ok, true);
    await host.swipe('Another reply.');
    assert.equal(promptOf(host), COMBAT_DEFAULT, 'the swipe takes the edit back');
});

test('Combat: saving the default again puts the template\'s text back; a text of exactly the limit is fine', async t => {
    const { host } = await open(t, { rules: true });
    assert.equal((await saveCombat(host, 'Short.')).ok, true);
    assert.equal(promptOf(host), 'Short.');
    assert.equal((await saveCombat(host, COMBAT_DEFAULT)).ok, true);
    assert.equal(promptOf(host), COMBAT_DEFAULT, 'the template\'s text, as a block keeps it');
    assert.equal((await saveCombat(host, 'x'.repeat(COMBAT_MAX))).ok, true);
    assert.equal([...promptOf(host)].length, COMBAT_MAX, 'exactly the limit is fine');
});

test('Combat: with no Combat rules block there is none to read, and the template\'s block can be made', async t => {
    const { host } = await open(t);
    assert.equal(combatBlock(host.head(), {}), null);
    assert.equal((await host.sdk.command('dm.define', { definition: combat() })).ok, true);
    assert.equal(promptOf(host), COMBAT_DEFAULT, 'the template\'s block was made');
});

// ---- the pure parts ---------------------------------------------------------------------------------------------------------------

test('settings-data: the Combat block is the first block with the role rules; withPrompt changes only the prompt', async t => {
    const { host } = await open(t, { rules: true });
    const block = combatBlock(host.head());
    assert.equal(block.module, 'pack.chat/combat-rules');
    assert.equal(block.prompt, COMBAT_DEFAULT, 'the template\'s text as a block keeps it: one line');
    assert.ok([...COMBAT_DEFAULT].length <= COMBAT_MAX);
    const before = JSON.stringify(block.definition);
    const next = withPrompt(block.definition, 'New.');
    assert.equal(JSON.stringify(block.definition), before, 'the pinned definition is not touched');
    assert.equal(next.prompt, 'New.');
    assert.ok(!('id' in next) && !('pack' in next), 'a definition sent to redefine has neither');
    const { prompt: _a, ...rest } = next, { prompt: _b, id: _i, pack: _p, ...kept } = block.definition;
    assert.deepEqual(rest, kept);
    assert.equal(combatBlock(fakeState([]), { roleOf }), null);
    assert.equal(combatTemplate(CHOOSER_TEMPLATES).role, 'rules');
});

test('settings-data: customOf keeps the stored numbers, else the numbers in force', () => {
    assert.deepEqual(customOf({}), STANDARD);
    assert.deepEqual(customOf({ [DIFFICULTY_SETTING]: 'harsh' }), STANDARD_PRESETS.harsh);
    assert.deepEqual(customOf({ [DIFFICULTY_SETTING]: 'harsh', [STANDARD_SETTING]: { foeBase: 12 } }), { ...STANDARD, foeBase: 12 });
    assert.deepEqual(customOf({ [DIFFICULTY_SETTING]: 'custom' }), STANDARD);
});

test('B17 (views): a refused save because the chat holds as many block versions as it can is said in plain words', async t => {
    const { host } = await open(t, { rules: true });
    const refuse = (type, payload) => (type === 'dm.redefine' && payload.definition.prompt !== COMBAT_DEFAULT
        ? { ok: false, code: 'DM_BUDGET', message: 'Combat rules: Retained pin budget exhausted; nothing applied.' }
        : host.sdk.command(type, payload));
    const { refusalText } = await import('../../../../core/strings.js');
    const refused = await saveCombat(host, 'A new text.', refuse);
    assert.equal(refusalText(refused), 'This chat has kept as many block versions as it can. Try again after your next message.');
    assert.equal(promptOf(host), COMBAT_DEFAULT, 'nothing changed');
    // The words are the helper's, so the other screens say it too (the wizard's Create, a block edit).
    assert.equal(refusalText({ ok: false, code: 'DM_BUDGET', message: 'x: Retained pin budget exhausted; nothing applied.' }), 'This chat has kept as many block versions as it can. Try again after your next message.');
    assert.match(refusalText({ ok: false, code: 'DM_BUDGET', message: 'Data module reply budget exhausted.' }), /^This reply already holds as many changes/);
    // The default is the text already pinned, and goes through.
    assert.equal((await saveCombat(host, 'Another.')).ok, true);
    assert.equal(promptOf(host), 'Another.');
});
