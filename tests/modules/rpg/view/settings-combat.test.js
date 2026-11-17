// Settings → RPG (src/v2/lean-rpg/view/settings.js and settings-data.js): the Combat rules text saved through the real host and settings-data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CORE_FEATURE } from '../../../../core/features.js';
import { DIFFICULTY_SETTING, STANDARD, STANDARD_PRESETS, STANDARD_SETTING } from '../../../../modules/rpg/index.js';
import { CHOOSER_TEMPLATES } from '../../../../modules/rpg/templates.js';
import { COMBAT_DEFAULT, COMBAT_MAX, combatBlock, combatTemplate, customOf, oddsView, withPrompt } from '../../../../modules/rpg/view/settings-data.js';
import { reload } from '../../data-modules/helpers.js';
import { settle } from './page.js';
import { characterDefinition, fakeState, roleOf, skillsDefinition } from './helpers.js';
import { open, promptOf, typeInto } from './settings.helpers.js';

test('Combat: the chat\'s Combat rules text is edited here and saved as an edit of that block; it reaches the narrator and survives a rebuild and a reload', async t => {
    const { host, root, card, win } = await open(t, { rules: true });
    host.features.set(CORE_FEATURE.fightBoard, false);
    const area = card('combat').querySelector('textarea');
    assert.equal(area.value, COMBAT_DEFAULT, 'the block\'s own text');
    assert.equal(card('combat').querySelector('.rpg-set-count').textContent, `${[...COMBAT_DEFAULT].length} / 1200`);
    assert.match(card('combat').textContent, /The Combat rules block of this chat\. Each chat can have its own; new chats start from the default\./);
    const hashBefore = host.head().domains.dataModules.active['pack.chat/combat-rules'].hash;
    const text = '[COMBAT SYSTEM] Fights are short and cruel. {{user}} loses against odds.';
    typeInto(area, text);
    await settle();
    assert.equal(promptOf(host), text);
    const active = host.head().domains.dataModules.active['pack.chat/combat-rules'];
    assert.notEqual(active.hash, hashBefore, 'a new definition hash');
    assert.ok(active.generation > 1, 'a new generation of the block');
    assert.equal(root.querySelector('.rpg-set-status').textContent, 'Saved on the latest reply: swipe or delete that reply to take it back.');
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
    await reload(host);
    assert.equal(promptOf(host), text);
    win.close();
});

test('Combat: an edit rides on the latest reply, so deleting that reply takes it back', async t => {
    const { host, card } = await open(t, { rules: true });
    await host.send('Go on.', 'A later reply, so the block itself is older than the edit.');
    typeInto(card('combat').querySelector('textarea'), 'Only this.');
    await settle();
    assert.equal(promptOf(host), 'Only this.');
    await host.st.deleteMessage(host.store.headIndex());
    assert.equal(promptOf(host), COMBAT_DEFAULT);
});

test('Combat: Reset to the default puts the template\'s text back; an unchanged or too long text is not saved', async t => {
    const { host, root, card } = await open(t, { rules: true });
    typeInto(card('combat').querySelector('textarea'), 'Short.');
    await settle();
    assert.equal(promptOf(host), 'Short.');
    root.querySelector('[data-act="combat-reset"]').click();
    await settle();
    assert.equal(promptOf(host), COMBAT_DEFAULT, 'the template\'s text, as a block keeps it');
    assert.equal(root.querySelector('[data-field="combat"]').value, COMBAT_DEFAULT);
    const generation = () => host.head().domains.dataModules.active['pack.chat/combat-rules'].generation;
    const was = generation();
    typeInto(root.querySelector('[data-field="combat"]'), COMBAT_DEFAULT);
    await settle();
    assert.equal(generation(), was, 'the same text is no edit');
    const area = root.querySelector('[data-field="combat"]');
    typeInto(area, 'x'.repeat(COMBAT_MAX + 1), 'input');
    assert.equal(root.querySelector('[data-card="combat"] .rpg-set-count').textContent, `${COMBAT_MAX + 1} / 1200`);
    assert.ok(root.querySelector('[data-card="combat"] .rpg-set-count').classList.contains('rpg-over'));
    area.dispatch('change');
    await settle();
    assert.equal(generation(), was, 'too long: nothing is saved');
    assert.equal(root.querySelector('.rpg-set-status').textContent, 'That is more than 1200 characters; shorten it to save.');
    assert.equal(promptOf(host), COMBAT_DEFAULT);
    typeInto(area, 'x'.repeat(COMBAT_MAX));
    await settle();
    assert.equal([...promptOf(host)].length, COMBAT_MAX, 'exactly the limit is fine');
});

test('Combat: with no Combat rules block the page says so and offers to add one', async t => {
    const { host, root, card } = await open(t);
    assert.match(card('combat').querySelector('.rpg-combat-none').textContent, /This chat has no Combat rules block/);
    assert.equal(card('combat').querySelector('textarea'), null);
    root.querySelector('[data-act="combat-add"]').click();
    await settle();
    assert.equal(promptOf(host), COMBAT_DEFAULT, 'the template\'s block was made');
    const fresh = root.querySelector('[data-card="combat"]');
    assert.equal(fresh.querySelector('textarea').value, COMBAT_DEFAULT, 'and the page shows its text');
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

test('settings-data: the odds view for a state with and without a character', () => {
    const wessel = { definition: { ...characterDefinition('wessel', 'Wessel'), role: 'character' }, fields: { who: 'Wessel', str: 12, soul: 1 } };
    const skills = { definition: { ...skillsDefinition('wessel-skills', 'Wessel'), role: 'skills' }, fields: { who: 'Wessel', skill1: 'Iron Breath', rank1: 1 } };
    const view = oddsView(fakeState([wessel, skills]), 'Wessel', STANDARD);
    assert.equal(view.label, 'Wessel (STR 12 with DEX 10, Level 1, Adept) against a Level 1 foe');
    assert.deepEqual(view.now, { success: 69, cost: 7, fail: 25 });
    assert.deepEqual(view.compare.map(item => item.name), ['gentle', 'harsh']);
    assert.deepEqual(oddsView(fakeState([wessel, skills]), 'Wessel', { ...STANDARD, foeBase: 9 }).compare.map(item => item.name), ['gentle', 'standard', 'harsh'], 'Custom: all three');
    assert.equal(oddsView(fakeState([]), 'Wessel', STANDARD), null);
});

test('the page\'s stylesheet: the odds bar is solid, three tones; the numbers wrap to two columns on a phone; theme tokens only', () => {
    const css = readFileSync(new URL('../../../../modules/rpg/view/lean-rpg.css', import.meta.url), 'utf8');
    assert.match(css, /\.rpg-set-nums \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(css, /@media \(max-width: 600px\) \{ \.rpg-set-nums \{ grid-template-columns: 1fr 1fr; \} \}/);
    assert.match(css, /\.rpg-odds-success \{ background: var\(--ss-good\)/);
    assert.match(css, /\.rpg-odds-cost \{ background: var\(--ss-warn\)/);
    assert.match(css, /\.rpg-odds-fail \{ background: var\(--ss-bad\)/);
});

test('B17 (views): a refused save because the chat holds as many block versions as it can is said in plain words, and Reset still works', async t => {
    let refuse = true;
    const wrap = (type, payload, options, run) => (refuse && type === 'dm.redefine' && payload.definition.prompt !== COMBAT_DEFAULT
        ? { ok: false, code: 'DM_BUDGET', message: 'Combat rules: Retained pin budget exhausted; nothing applied.' }
        : run(type, payload, options));
    const { host, root, card } = await open(t, { rules: true, wrap });
    typeInto(card('combat').querySelector('textarea'), 'A new text.');
    await settle();
    assert.equal(root.querySelector('.rpg-set-status').textContent, 'This chat has kept as many block versions as it can. Reset to the default, or try again after your next message.');
    assert.equal(promptOf(host), COMBAT_DEFAULT, 'nothing changed');
    // The words are the helper's, so the other screens say it too (the wizard's Create, a block edit).
    const { refusalText } = await import('../../../../core/strings.js');
    assert.equal(refusalText({ ok: false, code: 'DM_BUDGET', message: 'x: Retained pin budget exhausted; nothing applied.' }), 'This chat has kept as many block versions as it can. Try again after your next message.');
    assert.match(refusalText({ ok: false, code: 'DM_BUDGET', message: 'Data module reply budget exhausted.' }), /^This reply already holds as many changes/);
    // Reset to the default is the text already pinned, and goes through.
    refuse = false;
    typeInto(card('combat').querySelector('textarea'), 'Another.');
    await settle();
    assert.equal(promptOf(host), 'Another.');
});

test('F1: text typed in the Combat box is saved when the settings window is closed with the box still holding it (no change event comes)', async t => {
    const { host, card, win } = await open(t, { rules: true });
    const area = card('combat').querySelector('textarea');
    typeInto(area, 'Typed, then Escape.', 'input');
    assert.equal(promptOf(host), COMBAT_DEFAULT, 'nothing saved yet: only typed');
    win.close();
    await settle();
    assert.equal(promptOf(host), 'Typed, then Escape.');
    assert.equal(host.ctx.chat[host.store.headIndex()].extra.storySuite.receipts.filter(receipt => receipt.type === 'dm.redefine').length, 1, 'one edit');
});

test('F1: the page going out of sight saves what is typed, once; leaving the box after that does not save it again', async t => {
    const { host, doc, card, root } = await open(t, { rules: true });
    const area = card('combat').querySelector('textarea');
    typeInto(area, 'Typed, then the tab is hidden.', 'input');
    doc.visibilityState = 'hidden';
    const hide = doc.listeners.filter(entry => entry.type === 'visibilitychange');
    assert.ok(hide.length >= 1, 'the page listens');
    for (const entry of hide) entry.fn();
    area.dispatch('focusout');
    area.dispatch('change');
    await settle();
    assert.equal(promptOf(host), 'Typed, then the tab is hidden.');
    assert.equal(host.ctx.chat[host.store.headIndex()].extra.storySuite.receipts.filter(receipt => receipt.type === 'dm.redefine').length, 1, 'saved once, not once per event');
    assert.ok(root);
});

// Fix round 5, B8: the Combat text's saves are serialised, and the last action the reader took is the one that is kept.
test('B8: Reset clicked while the first Combat save is still running is saved after it, and the default wins', async t => {
    const slow = { on: true };
    const wrap = async (type, payload, options, run) => {
        // the host holds a save before it answers (the SDK can wait on one before it applies it), so the page does not know yet
        if (type === 'dm.redefine' && slow.on) await new Promise(resolve => setTimeout(resolve, 150));
        return run(type, payload, options);
    };
    const { host, root, card } = await open(t, { rules: true, wrap });
    const area = card('combat').querySelector('textarea');
    area.value = 'Unsaved edit';
    area.dispatch('focusout');
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(promptOf(host), COMBAT_DEFAULT, 'the first save is still waiting');
    root.querySelector('[data-act="combat-reset"]').click();
    await new Promise(resolve => setTimeout(resolve, 600));
    await settle();
    assert.equal(promptOf(host), COMBAT_DEFAULT, 'the default is what the story holds');
    assert.equal(root.querySelector('[data-field="combat"]').value, COMBAT_DEFAULT, 'and what the box shows');
    const head = host.store.headIndex();
    assert.equal(host.ctx.chat[head].extra.storySuite.receipts.filter(receipt => receipt.type === 'dm.redefine').length, 2, 'two saves, one after the other');
    // and the other way round: the same text asked twice while it is being saved is saved once
    const again = root.querySelector('[data-field="combat"]');
    again.value = 'Second edit';
    again.dispatch('focusout');
    again.dispatch('change');
    await new Promise(resolve => setTimeout(resolve, 600));
    await settle();
    assert.equal(promptOf(host), 'Second edit');
    assert.equal(host.ctx.chat[head].extra.storySuite.receipts.filter(receipt => receipt.type === 'dm.redefine').length, 3);
});
