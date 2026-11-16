// The page side (ui-host/send-note.js) on the widget tests' fake DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SEND_NOTE_TEXT } from '../../ui/legacy/ui-host/send-note.js';
import { rig, pageRig } from './send-pending.helpers.js';

test('send note: busy at the press shows a role=status pill right above #send_form, then re-sends once and says Sent for 2 s', () => {
    const r = pageRig();
    r.page.busy = true;
    r.press();
    assert.equal(r.pill().getAttribute('role'), 'status');
    assert.equal(r.pill().querySelector('.ss-send-note-text').textContent, SEND_NOTE_TEXT.pending);
    assert.equal(r.pill().parentNode.nextElementSibling, r.form);
    assert.equal(r.page.clicks, 1, 'only the reader\'s own click so far');
    r.clock.advance(1000);
    assert.equal(r.page.clicks, 1);
    r.page.busy = false;
    r.page.ignore = false;
    r.clock.advance(250);
    assert.equal(r.page.clicks, 1, 'not at once: the story must stay free for a few polls (SillyTavern is still closing the last reply)');
    r.clock.advance(750);
    assert.equal(r.page.clicks, 2, 'one re-send');
    assert.equal(r.pill().querySelector('.ss-send-note-text').textContent, SEND_NOTE_TEXT.sent, 'the box emptied: SillyTavern took it');
    r.clock.advance(2000);
    assert.equal(r.pill(), null);
    r.clock.advance(10000);
    assert.equal(r.page.clicks, 2);
});

test('send note: a free press that SillyTavern ignored is sent again once; one it took leaves no note', () => {
    const r = pageRig();
    r.press();
    assert.equal(r.pill(), null);
    r.clock.advance(1500);
    r.clock.advance(1000);
    assert.equal(r.page.clicks, 2);
    assert.equal(r.pill().querySelector('.ss-send-note-text').textContent, SEND_NOTE_TEXT.pending, 'ignored again: never "Sent" with the text still there');
    const t = pageRig();
    t.page.ignore = false;
    t.press();
    t.clock.advance(5000);
    assert.equal(t.page.clicks, 1);
    assert.equal(t.pill(), null);
    const g = pageRig();
    g.press();
    g.page.handlers.forEach(fn => fn('normal', {}, false));
    g.clock.advance(5000);
    assert.equal(g.page.clicks, 1, 'Generate was entered (a hold or interceptor may have kept the text): not ignored');
    assert.equal(g.page.handlers.length, 2, 'both events are listened to');
});

test('send note: a press another handler swallowed (a hold, a fight pause) is never re-sent', () => {
    const r = pageRig();
    r.doc.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); }, true);
    r.press();
    r.clock.advance(10000);
    assert.equal(r.page.clicks, 0);
    assert.equal(r.pill(), null);
    // Another click on the page (the hold's own buttons) between the press and the check must not count as the press arriving.
    const o = pageRig();
    o.doc.addEventListener('click', event => { if (event.target === o.send) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
    o.press();
    const other = o.doc.createElement('button'); o.doc.body.append(other);
    o.doc.fire('click', {}, other);
    o.clock.advance(10000);
    assert.equal(o.page.clicks, 0, 'an unrelated click is not the press');
    const k = pageRig();
    k.doc.addEventListener('click', event => event.preventDefault(), true);
    k.press();
    k.clock.advance(10000);
    assert.equal(k.page.clicks, 1, 'a cancelled press is not re-sent either (only the reader\'s own press)');
});

test('send note: a dry run or a quiet call is not a Send being taken', () => {
    const r = pageRig();
    r.press();
    r.page.handlers.forEach(fn => { fn('normal', {}, true); fn('quiet', {}, false); });
    r.clock.advance(1500);
    r.clock.advance(1000);
    assert.equal(r.page.clicks, 2, 'ignored press re-sent once');
});

test('send note: a re-send SillyTavern also ignored is tried again twice at most, never called "Sent" while the text is still there (pending look), then says Not sent yet', () => {
    const r = pageRig();
    r.page.busy = true;
    r.press();
    r.page.busy = false;
    r.clock.advance(1000);
    assert.equal(r.page.clicks, 2, 'the first re-send');
    assert.equal(r.pill().querySelector('.ss-send-note-text').textContent, SEND_NOTE_TEXT.pending, 'pending, not Sent, while the text is still there');
    r.clock.advance(60000);
    assert.equal(r.page.clicks, 4, 'two more tries and no more');
    assert.equal(r.pill().querySelector('.ss-send-note-text').textContent, SEND_NOTE_TEXT.stalled);
    assert.equal(r.box.value, 'I knock on the cabin door and wait.');
    r.page.ignore = false;
    r.pill().querySelectorAll('.ss-send-note-btn')[0].click();
    r.clock.advance(1000);
    assert.equal(r.page.clicks, 5, 'Send again goes once more');
});

test('send note: a retry that SillyTavern takes ends the round (the box empties, no further click)', () => {
    const r = pageRig();
    r.page.busy = true;
    r.press();
    r.page.busy = false;
    r.clock.advance(1000);
    r.page.ignore = false;
    r.clock.advance(1500);
    assert.equal(r.page.clicks, 3, 'the retry');
    r.clock.advance(60000);
    assert.equal(r.page.clicks, 3);
    assert.equal(r.pill(), null);
});

test('send note: a busy blip resets the calm count (no re-send while the story is still working)', () => {
    const r = pageRig();
    r.page.busy = true;
    r.press();
    r.page.busy = false;
    r.clock.advance(500);
    r.page.busy = true;
    r.clock.advance(250);
    r.page.busy = false;
    r.clock.advance(500);
    assert.equal(r.page.clicks, 1);
    r.clock.advance(500);
    assert.equal(r.page.clicks, 2);
});

test('send note: the Stop button showing counts as busy; Enter in the box is a press too', () => {
    const r = pageRig();
    r.stop.style = { display: 'flex' };
    r.doc.activeElement = r.box;
    r.doc.fire('keydown', { key: 'Enter' }, r.box);
    assert.equal(r.pill().querySelector('.ss-send-note-text').textContent, SEND_NOTE_TEXT.pending);
    r.doc.fire('keydown', { key: 'Enter', shiftKey: true }, r.box);
    assert.equal(r.page.clicks, 0);
});

test('send note: ✕ and typing drop the note and leave the text; nothing is sent', () => {
    const r = pageRig();
    r.page.busy = true;
    r.press();
    r.pill().querySelector('.ss-send-note-btn').click();
    assert.equal(r.pill(), null);
    r.press();
    r.box.value = 'something else';
    r.doc.fire('input', {}, r.box);
    assert.equal(r.pill(), null);
    r.page.busy = false;
    r.clock.advance(10000);
    assert.equal(r.page.clicks, 2, 'only the reader\'s two own presses, no re-send');
    assert.equal(r.box.value, 'something else');
});

test('send note: still busy after 6 s says so; Send again tries once more', () => {
    const r = pageRig();
    r.page.busy = true;
    r.press();
    r.clock.advance(6100);
    assert.equal(r.pill().querySelector('.ss-send-note-text').textContent, SEND_NOTE_TEXT.stalled);
    r.page.busy = false;
    const again = r.pill().querySelectorAll('.ss-send-note-btn')[0];
    assert.equal(again.textContent, SEND_NOTE_TEXT.again);
    again.click();
    r.clock.advance(1000);
    assert.equal(r.page.clicks, 2);
});

test('send note: a fight hold shows "Open fight board", which opens the board; the hold clearing ends the note with no send', () => {
    const r = pageRig();
    r.page.held = true;
    r.press();
    assert.equal(r.pill().querySelector('.ss-send-note-text').textContent, SEND_NOTE_TEXT.fightHeld);
    r.pill().querySelector('.ss-send-note-btn').click();
    assert.equal(r.page.boards, 1);
    r.page.held = false;
    r.clock.advance(300);
    assert.equal(r.pill(), null);
    assert.equal(r.page.clicks, 1);
});

test('send note: switched off, nothing is drawn or re-sent; destroy leaves no listeners', () => {
    const r = pageRig();
    r.page.on = false;
    r.page.busy = true;
    r.press();
    assert.equal(r.pill(), null);
    r.note.destroy();
    assert.equal(r.doc.docListeners.length, 0);
});

test('send note CSS: container-decided layout, 44 px targets, tokens, motion guard; the setting is on by default', () => {
    const css = readFileSync(new URL('../../ui/legacy/view/send-note.css', import.meta.url), 'utf8');
    assert.match(css, /@container \(min-width: \d+px\)/);
    assert.doesNotMatch(css, /@media \((min|max)-width/);
    assert.match(css, /min-height: 44px; min-width: 44px/);
    for (const token of ['--ss-accent', '--ss-warn', '--ss-good', '--ss-text']) assert.ok(css.includes(token), token);
    assert.match(css, /prefers-reduced-motion/);
});

test('machine: fail() turns sending into stalled with the text kept, only from sending', () => {
    const r = rig();
    assert.equal(r.sp.fail(), false);
    r.page.busy = true;
    r.sp.press();
    r.page.busy = false;
    r.clock.advance(300);
    assert.equal(r.sp.state().state, 'sending');
    assert.equal(r.sp.fail(), true);
    assert.equal(r.sp.state().state, 'stalled');
    assert.equal(r.clock.pending(), 0, 'no timers left');
});

test('machine: taken() ends a waiting round with no click (the reader\'s own Enter got there first); a second press while sending waits', () => {
    const { sp, page, clock } = rig();
    page.busy = true; sp.press();
    assert.equal(sp.taken(), true);
    assert.equal(sp.state().state, 'idle');
    page.busy = false; clock.advance(5000);
    assert.deepEqual(page.sends, []);
    page.busy = true; sp.press(); page.busy = false; clock.advance(250);
    assert.equal(sp.state().state, 'sending');
    assert.equal(sp.press(), 'waiting');
    assert.equal(page.sends.length, 1);
});

test('send note: Generate starting while a round waits ends it with no second click; only the message box\'s typing cancels', () => {
    const r = pageRig();
    r.page.busy = true; r.press();
    const other = r.doc.createElement('input'); other.setAttribute('id', 'search'); r.doc.body.append(other);
    r.doc.fire('input', {}, other);
    assert.notEqual(r.pill(), null, 'typing elsewhere keeps the round');
    r.page.handlers.forEach(fn => fn('normal', {}, false));
    assert.equal(r.pill(), null, 'a real start (the reader\'s Enter) ends the round');
    r.page.busy = false; r.clock.advance(5000);
    assert.equal(r.page.clicks, 1, 'no click from the note');
    const q = pageRig();
    q.page.busy = true; q.press();
    q.doc.fire('input', {}, q.box);
    assert.equal(q.pill(), null, 'typing in the box cancels');
});

test('send note: a Send already on its way (Enter/click) holds the note\'s own click for the verify wait', () => {
    const r = pageRig();
    r.page.busy = true; r.press();
    r.page.busy = false;
    r.doc.activeElement = r.box;
    r.doc.fire('keydown', { key: 'Enter' }, r.box);
    r.clock.advance(1400);
    assert.equal(r.page.clicks, 1, 'no click while the reader\'s own Send may still be starting');
});

test('send note: an Enter ST handled first (preventDefault before our bubble listener) still counts as reached, and an ignored free press waits the calm interval', () => {
    const r = pageRig();
    r.doc.addEventListener('keydown', e => e.preventDefault?.(), false);
    r.doc.activeElement = r.box;
    r.doc.fire('keydown', { key: 'Enter', defaultPrevented: true, preventDefault() {} }, r.box);
    r.clock.advance(1500);
    assert.equal(r.page.clicks, 0, 'the click is only after the calm polls');
    assert.notEqual(r.pill(), null, 'ignored while free: the round started');
    r.clock.advance(750);
    assert.equal(r.page.clicks, 0 + 1);
});

test('send note: a dry run or a quiet call never ends a waiting round or makes a sending round "Sent"; the round still sends once when free', () => {
    const noise = r => r.page.handlers.forEach(fn => { fn('normal', {}, true); fn('quiet', {}, false); fn('extension', {}, false); fn('regenerate', {}, false); fn('swipe', {}, false); fn('continue', {}, false); fn('impersonate', {}, false); fn('normal', { quiet_prompt: 'x' }, false); });
    const text = r => r.pill()?.querySelector('.ss-send-note-text').textContent;
    const w = pageRig();
    w.page.busy = true;
    w.press();
    noise(w);
    assert.equal(text(w), SEND_NOTE_TEXT.pending, 'a waiting round survives the noise');
    w.page.busy = false;
    w.clock.advance(1000);
    assert.equal(w.page.clicks, 2, 'and still sends once');
    const s = pageRig();
    s.page.busy = true;
    s.press();
    s.page.busy = false;
    s.clock.advance(1000);
    assert.equal(s.page.clicks, 2);
    noise(s);
    assert.equal(text(s), SEND_NOTE_TEXT.pending, 'sending is not "Sent" after a dry run');
    assert.equal(s.box.value, 'I knock on the cabin door and wait.');
    s.page.handlers.forEach(fn => fn('normal', {}, false));
    assert.equal(text(s), SEND_NOTE_TEXT.sent, 'the real start makes it Sent');
    // The reader emptying the box themselves while sending, before any start, is not "Sent".
    const e = pageRig();
    e.page.busy = true;
    e.press();
    e.page.busy = false;
    e.clock.advance(1000);
    e.box.value = '';
    e.doc.fire('input', {}, e.box);
    assert.equal(e.pill(), null);
});
