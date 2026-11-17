// A new chat with the RPG on and no character (mockup sections 7 and 7b; src/v2/lean-rpg/view/start.js, start.js): Home's "Your character" card and
// "Not now" (kept per chat), the persona's description in the wizard's Who step, and the first Send held in a dialog (Create then send, Send
// without the RPG for now, closing puts the text back, asked once per chat), all on the real page with the RPG feature on and nothing held with it off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost, hostAvailable } from '../../../../testkit/index.js';
import { CORE_FEATURE } from '../../../../core/features.js';
import { RPG_START_WIDGET } from '../../../../ui/legacy/screens/home.js';
import { setStartNotes, skipOf, startNotes } from '../../../../modules/rpg/start.js';
import { HOLD_SCREEN_ID, HOLD_WIDGET, START_WIDGET, createHoldScreen } from '../../../../modules/rpg/view/start.js';
import { WIZARD_SCREEN_ID } from '../../../../modules/rpg/view/wizard.js';
import { begin, makeBlocks, page, party, settle } from './page.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;
const HOME = 'story-block/home';
const PERSONA = 'A river-barge hand from the Confederacy, twenty-two, wiry and sunburnt, who signed on at Bluewatch to pay off his father\'s lock tolls.';
const wizardOf = dialog => dialog?.root.querySelector('.ss-w-rpg-wizard');
const holdOf = dialog => dialog?.root.querySelector('.ss-w-rpg-hold');
const cardOf = doc => doc.querySelector(`.ss-gameview [data-ss-screen="${HOME}"] .rpg-start`);
const click = (root, text) => root.querySelectorAll('button').find(node => node.textContent === text)?.click();
const notes = ctx => startNotes(ctx.host.ctx.chatMetadata);

async function home(ctx) {
    ctx.ui.mounts.screen.open(HOME);
    await settle();
    return ctx.doc.querySelector(`.ss-gameview [data-ss-screen="${HOME}"]`);
}

// The page's message box and Send button, and the way a click reaches them: the capture listeners of the document first (they may hold it),
// then the button's own (what SillyTavern sends with).
function sendBox(ctx, text = '') {
    const { doc } = ctx;
    const field = doc.createElement('textarea'); field.id = 'send_textarea'; field.value = text;
    const button = doc.createElement('div'); button.id = 'send_but';
    doc.body.append(field, button);
    doc.getElementById = id => doc.querySelector(`#${id}`);
    const sent = [];
    button.addEventListener('click', () => { sent.push(field.value); field.value = ''; });
    const through = (type, target, init = {}) => {
        const event = { type, target, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; }, ...init };
        for (const entry of [...doc.listeners]) if (entry.type === type && entry.capture && !event.stopped) entry.fn(event);
        if (!event.stopped && type === 'click') target.dispatch('click');
        return event;
    };
    return { field, button, sent, press: () => through('click', button), enter: (init = {}) => { doc.activeElement = field; return through('keydown', field, { key: 'Enter', ...init }); } };
}

// ---- what the chat remembers ---------------------------------------------------------------------------------------------------------

test('the chat remembers three things in its own metadata, never in the game: Not now, asked once, and "no dice for the next reply"', () => {
    const meta = {};
    assert.deepEqual(startNotes(meta), { hidden: false, asked: false, skip: false });
    assert.deepEqual(startNotes(null), { hidden: false, asked: false, skip: false });
    assert.equal(setStartNotes(null, { hidden: true }), false);
    setStartNotes(meta, { hidden: true });
    setStartNotes(meta, { asked: true, skip: true });
    assert.deepEqual(meta, { storySuite: { rpgStart: { hidden: true, asked: true, skip: true } } });
    const next = skipOf(() => meta);
    assert.equal(next.peek(), true);
    assert.equal(next.peek(), true, 'asking does not take it');
    next.clear();
    assert.deepEqual([next.peek(), startNotes(meta).asked, startNotes(meta).hidden], [false, true, true]);
    setStartNotes(meta, { hidden: false, asked: false });
    assert.deepEqual(meta, { storySuite: {} }, 'nothing left over');
    assert.equal(skipOf(() => { throw new Error('no chat'); }).peek(), false);
    assert.equal(START_WIDGET, RPG_START_WIDGET, 'the host\'s stand-in and the RPG\'s card are one name');
    assert.deepEqual([createHoldScreen().id, createHoldScreen().mounts, HOLD_SCREEN_ID, HOLD_WIDGET], [HOLD_SCREEN_ID, ['dialog'], 'story-block/rpg-hold', 'rpg.hold']);
});

// ---- Home's card -------------------------------------------------------------------------------------------------------------------------

test('Home: with the RPG on and no You, a "Your character" card at the top with the words of the mockup; Create opens the wizard', { skip }, async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const screen = await home(ctx);
    const card = cardOf(ctx.doc);
    assert.ok(card, 'the card');
    assert.equal(card.querySelector('h4').textContent, ' Your character');
    assert.equal(card.querySelector('.rpg-start-text').textContent, 'The RPG is on, and this story has no character yet. Make yours to roll for what you do; your persona fills in the name and who you are.');
    assert.deepEqual(card.querySelectorAll('button').map(node => node.textContent), ['Create your character', 'Not now']);
    const slots = screen.querySelectorAll('ss-widget').map(node => node.getAttribute('name'));
    assert.equal(slots[0], 'story-block.rpg-start', 'at the top of Home');
    card.querySelector('.rpg-start-create').click();
    await settle();
    const dialog = ctx.ui.mounts.dialog.current();
    assert.equal(dialog.screenId, WIZARD_SCREEN_ID, 'the New character wizard');
    assert.equal(wizardOf(dialog).querySelector('[data-wiz="name"]').value, 'Wessel');
    dialog.close();
});

test('Home: Not now hides the card for this chat (stored in the chat), and the Party tab\'s own Create your character stays', { skip }, async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    await home(ctx);
    cardOf(ctx.doc).querySelector('.rpg-start-later').click();
    await settle();
    assert.equal(cardOf(ctx.doc), null, 'gone');
    assert.equal(notes(ctx).hidden, true);
    assert.deepEqual(ctx.host.ctx.chatMetadata.storySuite.rpgStart, { hidden: true }, 'in the chat\'s metadata, nothing else');
    await ctx.host.send('On.', 'Reply.');
    await home(ctx);
    assert.equal(cardOf(ctx.doc), null, 'still gone');
    ctx.ui.mounts.screen.open('story-block/party');
    await settle();
    assert.ok(party(ctx.doc).querySelector('.rpg-create'), 'the Party tab still offers it');
    // Another chat has its own say.
    ctx.host.ctx.chatMetadata = {};
    await home(ctx);
    ctx.ui.mounts.screen.open(HOME);
    await settle();
    assert.ok(cardOf(ctx.doc), 'a chat that never said Not now');
});

test('Home: the card is gone as soon as a You exists, shown again while only companions are there, and never drawn with the RPG off', { skip }, async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    await makeBlocks(ctx.host, { who: 'Ren' });
    await home(ctx);
    assert.ok(cardOf(ctx.doc), 'a companion is not you');
    await makeBlocks(ctx.host, { who: 'Wessel' });
    await ctx.host.send('On.', 'Reply.');
    await home(ctx);
    assert.equal(cardOf(ctx.doc), null, 'a character named like the persona is you');
    ctx.host.features.set(CORE_FEATURE.leanRpg, false);
    await settle();
    assert.equal(cardOf(ctx.doc), null);

    const off = await page(t, { feature: false, persona: 'Wessel' });
    await begin(off.host);
    const screen = await home(off);
    assert.equal(cardOf(off.doc), null, 'the RPG off: nothing');
    assert.equal(screen.querySelectorAll('.rpg-start').length, 0);
    assert.deepEqual(off.loads, [], 'and the RPG screens were never loaded');
    off.host.features.set(CORE_FEATURE.leanRpg, true);
    for (let n = 0; n < 40 && !off.loads.length; n += 1) await new Promise(resolve => setTimeout(resolve, 10));
    await settle();
    assert.ok(cardOf(off.doc), 'switched on: the card comes');
});

// ---- the persona ---------------------------------------------------------------------------------------------------------------------------

async function whoStep(ctx, { empty = true } = {}) {
    ctx.ui.mounts.screen.open('story-block/party');
    await settle();
    party(ctx.doc).querySelector(empty ? '.rpg-create' : '.rpg-new').click();
    await settle();
    return ctx.ui.mounts.dialog.current();
}

test('Who: the wizard makes a You only: the name is the persona\'s, there is no You or companion choice and no "Who they are" box, and the persona\'s description is never read', { skip }, async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    const seen = [];
    ctx.host.ctx.powerUserSettings = new Proxy({ persona_description: PERSONA }, { get: (target, key) => { seen.push(String(key)); return target[key]; } });
    await begin(ctx.host);
    const dialog = await whoStep(ctx);
    const who = wizardOf(dialog);
    assert.equal(who.querySelector('[data-wiz="name"]').value, 'Wessel');
    assert.equal(who.querySelector('.rpg-wiz-seg'), null, 'no You or companion choice');
    assert.equal(who.querySelector('[data-wiz="about"]'), null, 'no Who they are');
    assert.equal(who.querySelector('[data-wiz="persona-note"]'), null);
    assert.deepEqual([...new Set(seen)], [], 'the persona\'s description was not read');
    dialog.close();
    // A story with a You already: the Party tab has no New character button.
    await makeBlocks(ctx.host, { who: 'Wessel' });
    await ctx.host.send('On.', 'Reply.');
    ctx.ui.mounts.screen.open('story-block/party');
    await settle();
    assert.equal(party(ctx.doc).querySelector('.rpg-new'), null);
    assert.equal(party(ctx.doc).querySelector('.rpg-create'), null);
});

test('Who: Create makes the character with no About field, whatever the persona describes', { skip }, async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    ctx.host.ctx.powerUserSettings = { persona_description: PERSONA };
    await begin(ctx.host);
    const dialog = await whoStep(ctx);
    ctx.ui.mounts.dialog.current().goTo(3);
    await settle();
    wizardOf(dialog).querySelector('.rpg-wiz-create').click();
    await settle();
    const made = ctx.host.sdk.query('dataModules.view', { module: 'pack.chat/wessel' }).chat;
    assert.equal(made.who, 'Wessel');
    assert.equal(Object.hasOwn(made, 'about'), false);
});

// ---- the first send ---------------------------------------------------------------------------------------------------------------------

test('Send with no character: the message is held (never leaves the box) and "Make your character first" opens with the message quoted', { skip }, async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const box = sendBox(ctx, 'I step into the Guild Office.');
    const event = box.press();
    assert.equal(event.defaultPrevented, true, 'held');
    assert.deepEqual(box.sent, [], 'not sent');
    assert.equal(box.field.value, 'I step into the Guild Office.', 'the text stays where it is');
    const dialog = ctx.ui.mounts.dialog.current();
    assert.equal(dialog.screenId, HOLD_SCREEN_ID);
    assert.equal(dialog.root.querySelector('.ss-dialog-title').textContent, 'Make your character first');
    const hold = holdOf(dialog);
    assert.equal(hold.querySelector('.rpg-hold-text').textContent, 'The RPG is on, but this story has no character for you yet, so there is nothing to roll for. Your message is kept; it is sent as soon as you choose.');
    assert.equal(hold.querySelector('.rpg-hold-quote').textContent, 'I step into the Guild Office.');
    assert.deepEqual(hold.querySelectorAll('button').map(node => node.textContent), ['Send without the RPG for now', 'Create your character, then send']);
    // Enter while it is open holds too and does not open a second one.
    assert.equal(box.enter().defaultPrevented, true);
    assert.equal(ctx.ui.mounts.dialog.current(), dialog);
    // Closing puts the text back (it never left) and nothing is remembered: the next Send asks again.
    dialog.close();
    await settle();
    assert.deepEqual([box.field.value, box.sent, notes(ctx)], ['I step into the Guild Office.', [], { hidden: false, asked: false, skip: false }]);
    assert.equal(box.press().defaultPrevented, true);
    assert.equal(ctx.ui.mounts.dialog.current()?.screenId, HOLD_SCREEN_ID);
    ctx.ui.mounts.dialog.closeAll();
});

test('Send without the RPG for now: sent as usual, no dice that reply, and never asked again in this chat', { skip }, async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const box = sendBox(ctx, 'I step into the Guild Office.');
    box.press();
    click(holdOf(ctx.ui.mounts.dialog.current()), 'Send without the RPG for now');
    await settle();
    assert.deepEqual(box.sent, ['I step into the Guild Office.'], 'sent once, by the button itself');
    assert.equal(ctx.ui.mounts.dialog.current(), null);
    assert.deepEqual(notes(ctx), { hidden: false, asked: true, skip: true });
    box.field.value = 'Second.';
    const second = box.press();
    assert.equal(second.defaultPrevented, false, 'never asked again');
    assert.deepEqual(box.sent, ['I step into the Guild Office.', 'Second.']);
    // The Home card still reminds.
    await home(ctx);
    assert.ok(cardOf(ctx.doc));
});

test('Create your character, then send: the wizard opens and the message is sent when Create succeeds; cancelled, the text is back and the next Send asks again', { skip }, async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const box = sendBox(ctx, 'I step into the Guild Office.');
    box.press();
    click(holdOf(ctx.ui.mounts.dialog.current()), 'Create your character, then send');
    await settle();
    let dialog = ctx.ui.mounts.dialog.current();
    assert.equal(dialog.screenId, WIZARD_SCREEN_ID, 'the wizard, in place of the hold');
    assert.deepEqual(box.sent, [], 'not sent yet');
    // Cancelled.
    dialog.close();
    await settle();
    assert.deepEqual([box.sent, box.field.value, notes(ctx).asked], [[], 'I step into the Guild Office.', false]);
    assert.equal(box.press().defaultPrevented, true, 'asks again');
    // Now through to Create.
    click(holdOf(ctx.ui.mounts.dialog.current()), 'Create your character, then send');
    await settle();
    dialog = ctx.ui.mounts.dialog.current();
    dialog.goTo(3);
    await settle();
    wizardOf(dialog).querySelector('.rpg-wiz-create').click();
    await settle();
    assert.equal(ctx.ui.mounts.dialog.current(), null, 'the dialog closed');
    assert.deepEqual(box.sent, ['I step into the Guild Office.'], 'sent once Create worked');
    assert.equal(ctx.host.sdk.query('dataModules.view', { module: 'pack.chat/wessel' }).chat.who, 'Wessel');
    assert.equal(notes(ctx).asked, false, 'not the "without" choice');
});

test('what is not held: an empty box, a slash command, a Shift+Enter, a send while generating, a click elsewhere, a chat that has a You; and nothing at all with the RPG off', { skip }, async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const box = sendBox(ctx, '   ');
    assert.equal(box.press().defaultPrevented, false, 'an empty box is not a message');
    box.field.value = '/roll 1d20';
    assert.equal(box.press().defaultPrevented, false, 'a slash command is not a message');
    box.field.value = 'Hello.';
    assert.equal(box.enter({ shiftKey: true }).defaultPrevented, false, 'Shift+Enter is a line break');
    assert.equal(box.enter({ key: 'a' }).defaultPrevented, false);
    const stop = ctx.doc.createElement('div'); stop.id = 'mes_stop'; ctx.doc.body.appendChild(stop);
    ctx.doc.defaultView.getComputedStyle = node => ({ display: node === stop ? 'flex' : 'none' });
    assert.equal(box.press().defaultPrevented, false, 'a generation is running: the button does not send');
    ctx.doc.defaultView.getComputedStyle = () => ({ display: 'none' });
    const other = ctx.doc.createElement('div'); ctx.doc.body.appendChild(other);
    const elsewhere = { type: 'click', target: other, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() {} };
    for (const entry of ctx.doc.listeners) if (entry.type === 'click' && entry.capture) entry.fn(elsewhere);
    assert.equal(elsewhere.defaultPrevented, false, 'a click anywhere else');
    await makeBlocks(ctx.host, { who: 'Wessel' });
    await ctx.host.send('On.', 'Reply.');
    assert.equal(box.press().defaultPrevented, false, 'with a You there is nothing to hold');
    assert.equal(ctx.ui.mounts.dialog.current(), null);

    const off = await page(t, { feature: false, persona: 'Wessel' });
    await begin(off.host);
    const plain = sendBox(off, 'Hello.');
    assert.equal(plain.press().defaultPrevented, false);
    assert.deepEqual(plain.sent, ['Hello.'], 'with the RPG off nothing is held');
    const listening = () => off.doc.listeners.filter(entry => entry.capture && entry.type === 'click').length;
    assert.equal(listening(), 0, 'not even a listener');
    off.host.features.set(CORE_FEATURE.leanRpg, true);
    await settle();
    plain.field.value = 'Again.';
    assert.equal(listening(), 2, 'the character and fight holds listen while the RPG is on');
    assert.equal(plain.press().defaultPrevented, true, 'switched on: held');
    off.ui.mounts.dialog.closeAll();
    off.host.features.set(CORE_FEATURE.leanRpg, false);
    await settle();
    plain.field.value = 'Off again.';
    assert.equal(plain.press().defaultPrevented, false, 'switched off: the listeners are gone');
});

test('Enter sends only where SillyTavern says it does', { skip }, async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const box = sendBox(ctx, 'Hello.');
    globalThis.SillyTavern = { getContext: () => ({ shouldSendOnEnter: () => false }) };
    t.after(() => { delete globalThis.SillyTavern; });
    assert.equal(box.enter().defaultPrevented, false, 'Enter is a line break here: nothing is held');
    globalThis.SillyTavern = { getContext: () => ({ shouldSendOnEnter: () => true }) };
    assert.equal(box.enter().defaultPrevented, true);
    ctx.ui.mounts.dialog.closeAll();
});

test('the hold is never kept across a chat change: the dialog closes and the text is back', { skip }, async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const box = sendBox(ctx, 'Hello.');
    box.press();
    assert.equal(ctx.ui.mounts.dialog.current()?.screenId, HOLD_SCREEN_ID);
    ctx.ui.mounts.dialog.closeAll();
    await settle();
    assert.equal(box.field.value, 'Hello.');
    assert.equal(ctx.ui.mounts.dialog.current(), null);
});
