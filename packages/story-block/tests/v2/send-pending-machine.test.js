// The "Send pending" state machine (ui-host/send-pending.js) on a fake clock: every transition, one re-send per round,
// never a double send, never a send of changed or empty text, cancel and typing leave the text alone. No DOM, no SillyTavern.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rig } from './send-pending.helpers.js';

test('free and not held: a press goes straight through once and stays idle', () => {
    const { sp, page } = rig();
    assert.equal(sp.press(), 'passed');
    assert.deepEqual(page.sends, ['I knock on the cabin door and wait.']);
    assert.equal(sp.state().state, 'idle');
});

test('an empty box never sends', () => {
    const { sp, page, clock } = rig();
    page.box = '   ';
    assert.equal(sp.press(), 'empty');
    page.busy = true; page.box = '';
    assert.equal(sp.press(), 'empty');
    page.busy = false; clock.advance(5000);
    assert.deepEqual(page.sends, []);
    assert.equal(sp.state().state, 'idle');
});

test('click while busy -> pending; no send while busy', () => {
    const { sp, page, clock } = rig();
    page.busy = true;
    assert.equal(sp.press(), 'pending');
    assert.equal(sp.state().state, 'pending');
    clock.advance(3000);
    assert.deepEqual(page.sends, []);
    assert.equal(sp.state().state, 'pending');
});

test('pending -> free: exactly ONE re-send, then sent for 2 s, then idle', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press();
    clock.advance(1000);
    page.busy = false;
    clock.advance(250);
    assert.deepEqual(page.sends, ['I knock on the cabin door and wait.']);
    assert.equal(sp.state().state, 'sending', 'our click is not "sent" until SillyTavern took it');
    assert.equal(sp.taken(), true);
    assert.equal(sp.state().state, 'sent');
    clock.advance(1999);
    assert.equal(sp.state().state, 'sent');
    clock.advance(1);
    assert.equal(sp.state().state, 'idle');
    clock.advance(10000);
    assert.equal(page.sends.length, 1, 'no second re-send after sent');
});

test('the re-send happens on the first free poll, not on a timer after the story was free long ago', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press();
    page.busy = false;
    clock.advance(240);
    assert.equal(page.sends.length, 0, 'no re-send before the next poll');
    clock.advance(10);
    assert.equal(page.sends.length, 1);
});

test('still busy after 6 s -> stalled; nothing is sent later on its own', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press();
    clock.advance(5999);
    assert.equal(sp.state().state, 'pending');
    clock.advance(1);
    assert.equal(sp.state().state, 'stalled');
    page.busy = false;
    clock.advance(60000);
    assert.deepEqual(page.sends, [], 'a stalled round does not send by itself');
    assert.equal(sp.state().state, 'stalled');
    assert.equal(clock.pending(), 0, 'no timers left running once stalled');
});

test('stalled + Send again = one more pending round; it re-sends once the story is free', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press();
    clock.advance(6000);
    assert.equal(sp.state().state, 'stalled');
    assert.equal(sp.press(), 'pending');
    clock.advance(500);
    page.busy = false;
    clock.advance(250);
    assert.deepEqual(page.sends, ['I knock on the cabin door and wait.']);
    assert.equal(sp.state().state, 'sending');
});

test('stalled + Send again while the story is free sends once at once', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press();
    clock.advance(6000);
    page.busy = false;
    sp.press();
    assert.equal(page.sends.length, 1);
    assert.equal(sp.state().state, 'sending');
    sp.taken();
    assert.equal(sp.state().state, 'sent');
    clock.advance(5000);
    assert.equal(page.sends.length, 1);
});

test('a second press while pending is ignored (never double-sends)', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press();
    assert.equal(sp.press(), 'waiting');
    assert.equal(sp.press(), 'waiting');
    page.busy = false;
    clock.advance(1000);
    assert.equal(page.sends.length, 1);
});

test('a press while sent (free) goes through once and does not re-send the round', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press();
    page.busy = false; clock.advance(250);
    sp.taken();
    assert.equal(sp.state().state, 'sent');
    page.box = 'Next line.';
    assert.equal(sp.press(), 'passed');
    assert.deepEqual(page.sends, ['I knock on the cabin door and wait.', 'Next line.']);
    assert.equal(sp.state().state, 'idle');
    clock.advance(5000);
    assert.equal(page.sends.length, 2);
});

test('cancel -> idle with the text untouched and nothing sent', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press();
    assert.equal(sp.cancel(), true);
    assert.equal(sp.state().state, 'idle');
    assert.equal(page.box, 'I knock on the cabin door and wait.');
    page.busy = false; clock.advance(10000);
    assert.deepEqual(page.sends, []);
    assert.equal(clock.pending(), 0);
});

test('cancel while stalled or held -> idle; cancel while idle reports nothing to do', () => {
    const { sp, page, clock } = rig();
    assert.equal(sp.cancel(), false);
    page.busy = true; sp.press(); clock.advance(6000);
    assert.equal(sp.cancel(), true);
    assert.equal(sp.state().state, 'idle');
    page.busy = false; page.held = true; sp.press();
    assert.equal(sp.cancel(), true);
    assert.equal(sp.state().state, 'idle');
    page.held = false; clock.advance(1000);
    assert.deepEqual(page.sends, []);
});

test('typing in the box clears the note (stalled) and drops a live round without sending', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press(); clock.advance(6000);
    assert.equal(sp.typed(), true);
    assert.equal(sp.state().state, 'idle');
    assert.equal(sp.typed(), false);

    const second = rig();
    second.page.busy = true; second.sp.press();
    second.page.box = 'Changed my mind.';
    second.page.busy = false;
    second.clock.advance(1000);
    assert.deepEqual(second.page.sends, [], 'changed text is never sent');
    assert.equal(second.sp.state().state, 'idle');
});

test('text changed without a typed() call still stops the round (poll check)', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press();
    page.box = 'Something else entirely';
    page.busy = false;
    clock.advance(1000);
    assert.deepEqual(page.sends, []);
    assert.equal(sp.state().state, 'idle');
});

test('text emptied during a round never sends', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press();
    page.box = '';
    page.busy = false;
    clock.advance(1000);
    assert.deepEqual(page.sends, []);
    assert.equal(sp.state().state, 'idle');
});

test('a fight start holding the Send -> interactionHeld, with an open-board action', () => {
    const { sp, page, clock } = rig();
    page.held = true;
    assert.equal(sp.press(), 'interactionHeld');
    assert.equal(sp.state().state, 'interactionHeld');
    assert.equal(sp.openHeld(), true);
    assert.equal(page.boardOpens, 1);
    clock.advance(10000);
    assert.deepEqual(page.sends, [], 'never sends while the fight holds it');
    assert.equal(sp.state().state, 'interactionHeld');
});

test('interactionHeld while busy: still held, no send; the hold can clear to idle without a send', () => {
    const { sp, page, clock } = rig();
    page.busy = true; page.held = true;
    assert.equal(sp.press(), 'interactionHeld');
    page.busy = false;
    clock.advance(1000);
    assert.deepEqual(page.sends, []);
    page.held = false;
    clock.advance(300);
    assert.equal(sp.state().state, 'idle');
    assert.deepEqual(page.sends, [], 'the fight path owns the message; no send from this note');
    assert.equal(clock.pending(), 0);
});

test('a hold that arrives during a pending round moves it to interactionHeld and it never sends', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press();
    page.held = true;
    clock.advance(500);
    assert.equal(sp.state().state, 'interactionHeld');
    page.busy = false; page.held = true;
    clock.advance(10000);
    assert.deepEqual(page.sends, []);
});

test('openHeld does nothing outside interactionHeld', () => {
    const { sp, page } = rig();
    assert.equal(sp.openHeld(), false);
    assert.equal(page.boardOpens, 0);
});

test('dispose clears every timer and sends nothing', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press();
    sp.dispose();
    assert.equal(clock.pending(), 0);
    page.busy = false; clock.advance(10000);
    assert.deepEqual(page.sends, []);
    assert.equal(sp.state().state, 'idle');
});

test('onChange reports each state change once, in order', () => {
    const { sp, page, clock, } = rig();
    page.busy = true; sp.press(); clock.advance(6000); sp.cancel();
    assert.deepEqual(page.changes, ['pending', 'stalled', 'idle']);
});

test('never double-sends across a full round with the story freeing mid-poll', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press();
    for (let i = 0; i < 10; i++) { clock.advance(100); sp.press(); }
    page.busy = false;
    clock.advance(5000);
    assert.equal(page.sends.length, 1);
});
