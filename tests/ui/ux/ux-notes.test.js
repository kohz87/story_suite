// Story Block's UX pieces (MODULES §F40, §F41) on the real runtime (the testkit host)
// and the fake DOM: the note under a reply that came without change lines and its Re-read, the edited
// note, and the refused lines in the changes card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { problemReason, refusedFrom, warnedFrom } from '../../../ui/legacy/reply-notes.js';
import { THIS_REPLY_ID } from '../../../ui/legacy/reply-cards.js';
import { STRINGS } from '../../../core/strings.js';
import { CORE_FEATURE } from '../../../core/features.js';
import { WITH_LINES, page } from './ux.helpers.js';

// ---------------------------------------------------------------------------------------------------
// §F40: a reply without change lines

test('a reply without change lines gets the warning; the greeting, the reader and a reply with lines do not', async () => {
    const { host, draw, noteAt } = await page({ reread: false });
    await host.send('hi', WITH_LINES);
    await host.send('and now?', 'Nothing much happens.');
    draw();
    assert.equal(noteAt(0), null, 'the greeting');
    assert.equal(noteAt(1), null, 'the reader');
    assert.equal(noteAt(2), null, 'a reply with its block');
    const note = noteAt(4);
    assert.ok(note);
    assert.equal(note.getAttribute('data-kind'), 'missing');
    assert.equal(note.getAttribute('role'), 'note');
    assert.equal(note.querySelector('.story-suite-reply-note-text').textContent, STRINGS.notes.missing);
    assert.equal(note.querySelector('.story-suite-reply-note-reread'), null, 'no Re-read without the runtime\'s');
    // Under the reply's text.
    const text = note.parentNode.querySelector('.mes_text');
    assert.equal(text.nextElementSibling, note);
});

// The extractor's call answers (here: nothing to add). One that fails leaves the note (C2-ext,
// break/c2-extractor-failed-no-note); with no model to call, this test's extractor failed before.
test('with the after-reply extractor on, no warning', async () => {
    const { host, draw, noteAt } = await page({ settings: { modules: { 'story-block': { assistExtractor: true } } }, callModel: async () => 'none' });
    await host.send('and now?', 'Nothing much happens.');
    await new Promise(resolve => setTimeout(resolve, 10));
    draw();
    assert.equal(host.sdk.settings('story-block').assistExtractor, true);
    assert.equal(noteAt(2), null);
});

test('a reply from before v2 (no record) gets no warning', async () => {
    const { host, draw, noteAt } = await page();
    await host.send('and now?', 'Nothing much happens.');
    delete host.ctx.chat[2].extra.storySuite;
    draw();
    assert.equal(noteAt(2), null);
});

test('Re-read: the button runs sdk.reread(index), shows it is busy, and the note goes once the reply has lines', async () => {
    let release;
    const { host, draw, noteAt, calls } = await page({
        reread: (index, h) => new Promise(resolve => { release = () => { h.ctx.chat[index].mes = WITH_LINES; resolve({ ok: true, problems: [] }); }; }),
    });
    await host.send('and now?', 'Nothing much happens.');
    draw();
    const button = noteAt(2).querySelector('.story-suite-reply-note-reread');
    assert.equal(button.textContent, STRINGS.notes.reread);
    assert.equal(button.getAttribute('title'), STRINGS.notes.rereadTitle);
    button.click();
    assert.deepEqual(calls, [2]);
    assert.equal(button.textContent, STRINGS.notes.rereading);
    assert.equal(button.disabled, true);
    button.click();
    assert.deepEqual(calls, [2], 'one Re-read at a time');
    release();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(noteAt(2), null);
});

test('Re-read that fails says why and keeps the note', async () => {
    const { host, draw, noteAt } = await page({ reread: () => ({ ok: false, code: 'FAILED', message: 'The reply is gone.' }) });
    await host.send('and now?', 'Nothing much happens.');
    draw();
    noteAt(2).querySelector('.story-suite-reply-note-reread').click();
    await new Promise(resolve => setImmediate(resolve));
    const error = noteAt(2).querySelector('.story-suite-reply-note-error');
    assert.equal(error.hidden, false);
    assert.equal(error.textContent, 'Re-read did not work: The reply is gone.');
    assert.equal(error.getAttribute('role'), 'alert');
});

test('an edited reply gets the edited note with Re-read (only when Re-read exists); Re-read clears it', async () => {
    const plain = await page({ reread: false });
    await plain.host.send('hi', WITH_LINES);
    plain.draw();
    await plain.host.st.editMessage(2, `${WITH_LINES}\nedited`);
    assert.equal(plain.noteAt(2), null);

    const { host, draw, noteAt, calls } = await page({ reread: () => ({ ok: true }) });
    await host.send('hi', WITH_LINES);
    draw();
    await host.st.editMessage(2, `${host.ctx.chat[2].mes}\nAnd a knife.`);
    const note = noteAt(2);
    assert.equal(note.getAttribute('data-kind'), 'edited');
    assert.equal(note.querySelector('.story-suite-reply-note-text').textContent, STRINGS.notes.edited);
    note.querySelector('.story-suite-reply-note-reread').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, [2]);
    assert.equal(noteAt(2), null);
});

test('a delete or a new chat forgets what was kept by index', async () => {
    const { host, ui, draw, noteAt } = await page({ reread: () => ({ ok: true }) });
    await host.send('hi', WITH_LINES);
    draw();
    await host.st.editMessage(2, `${host.ctx.chat[2].mes}\nmore`);
    assert.equal(noteAt(2).getAttribute('data-kind'), 'edited');
    assert.equal(ui.notes.refusedAt(2).length, 1);
    await host.st.deleteMessage(3);
    assert.equal(ui.notes.refusedAt(2).length, 0);
    assert.equal(noteAt(2), null);
});

// ---------------------------------------------------------------------------------------------------
// §F41: refused lines

test('refusedFrom and problemReason read the turn\'s problems for one reply', () => {
    const problems = [
        { index: 2, line: '- item Lantern | qty: 1', code: 'NOT_FOUND', message: '"- item Lantern | qty: 1" was not used: There is no Lantern in the inventory.' },
        { index: 2, line: '+ spell Fire', code: 'UNKNOWN_KIND', message: 'No module keeps "spell", so "+ spell Fire" was not used.' },
        { index: 2, code: 'UNREADABLE', message: 'Line 3 is not a change line: "hello".' },
        { index: 4, line: '+ item Rope', code: 'FAILED', message: '"+ item Rope" was not used: no.' },
        { index: 2, code: 'FAILED', message: 'beforeGenerate failed' },
    ];
    assert.deepEqual(refusedFrom(problems, 2), [
        { line: '- item Lantern | qty: 1', reason: 'There is no Lantern in the inventory.' },
        { line: '+ spell Fire', reason: 'no module keeps "spell"' },
        { line: 'Line 3 is not a change line: "hello".', reason: '' },
    ]);
    assert.deepEqual(refusedFrom(null, 2), []);
    assert.equal(problemReason({ line: 'x', message: 'odd text' }), 'odd text');
});

test('a LIMITED problem about an applied line is a warning: warnedFrom lists it, refusedFrom does not', () => {
    const repeat = 'Possible repeat: 70 from "fokke" was paid in a reply a moment ago and is paid again here. It was applied; undo it if the story paid the same find twice.';
    const problems = [
        { index: 2, line: '+ coin 7 silver | from: Fokke', code: 'LIMITED', message: repeat },
        { index: 2, line: '- item Lantern | qty: 1', code: 'NOT_FOUND', message: '"- item Lantern | qty: 1" was not used: There is no Lantern in the inventory.' },
        { index: 3, line: '+ coin 1 silver', code: 'LIMITED', message: 'other reply' },
    ];
    assert.deepEqual(refusedFrom(problems, 2), [{ line: '- item Lantern | qty: 1', reason: 'There is no Lantern in the inventory.' }]);
    assert.deepEqual(warnedFrom(problems, 2), [{ line: '+ coin 7 silver | from: Fokke', reason: problemReason(problems[0]) }]);
    assert.equal(warnedFrom(problems, 2)[0].reason.includes('Possible repeat'), true);
    assert.deepEqual(warnedFrom(null, 2), []);
});

test('the changes card shows an applied-with-warning line as "applied, check:", not under "not applied", and does not count it', async () => {
    const { doc, host, ui, draw } = await page();
    await host.send('hi', WITH_LINES);
    draw();
    ui.notes.onTurn({ index: 2, type: 'turn', problems: [
        { index: 2, line: '+ coin 7 silver | from: Fokke', code: 'LIMITED', message: 'Possible repeat: 7 from "fokke" was paid again. It was applied; undo it if wrong.' },
    ] });
    assert.deepEqual(ui.notes.refusedAt(2), []);
    assert.equal(ui.notes.warnedAt(2).length, 1);
    ui.mounts.card.refresh(2, { force: true });
    const card = doc.querySelector(`.mes[mesid="2"] [data-ss-card="${THIS_REPLY_ID}"]`);
    assert.ok(!/not applied/.test(card.querySelector('.ss-card-summary').textContent), 'no "not applied" count');
    ui.mounts.card.toggle(2, true);
    assert.equal(card.querySelector('.refused'), null);
    const text = card.querySelector('.warned').textContent.replace(/\s+/g, ' ').trim();
    assert.ok(text.startsWith('applied, check: + coin 7 silver | from: Fokke — Possible repeat'), text);
    assert.ok(!text.includes('not applied'));
});

test('problemReason gives a readable reason for every refused line: the safety net\'s mark is dropped, the friendly unknown-kind text stays, any other message loses the quoted line', () => {
    const line = '+ world Shornmarch Wolf-Push — skirmishers | state: ongoing';
    assert.equal(problemReason({ line, code: 'UNKNOWN_KIND', message: `(assist) No module keeps "world", so "${line}" was not used.` }), 'no module keeps "world"');
    assert.equal(problemReason({ line, code: 'REFUSED', message: `(assist) "${line}" was not used: the chronicle is full.` }), 'the chronicle is full.');
    assert.equal(problemReason({ line, code: 'MODULE_HELD', message: `(assist, from the previous reply) "${line}" was not used: story-director is held back.` }), 'story-director is held back.');
    assert.equal(problemReason({ line, code: 'ODD', message: `Could not place "${line}" in the chronicle.` }), 'Could not place in the chronicle.');
    assert.equal(problemReason({ line, code: 'ODD', message: `"${line}" was not used.` }), 'This line was not used.');
    assert.equal(problemReason({ line, code: 'ODD', message: '' }), 'This line was not used.');
    assert.equal(problemReason({ line, code: 'ODD', message: 'No line in it' }), 'No line in it');
});

test('the changes card lists the lines the code refused, faintly, and its summary counts them', async () => {
    const { doc, host, ui, draw } = await page();
    await host.send('hi', WITH_LINES);
    draw();
    assert.deepEqual(ui.notes.refusedAt(2), [{ line: '- item Lantern | qty: 1', reason: 'There is no Lantern in the inventory.' }]);
    ui.mounts.card.refresh(2, { force: true });
    const card = doc.querySelector(`.mes[mesid="2"] [data-ss-card="${THIS_REPLY_ID}"]`);
    assert.ok(card, 'the card is under the reply');
    assert.equal(card.querySelector('.ss-card-summary').textContent, '+1 Rope · 1 line not applied');
    ui.mounts.card.toggle(2, true);
    const refused = card.querySelector('.refused');
    assert.ok(refused, 'the refused list is drawn');
    const text = refused.textContent.replace(/\s+/g, ' ').trim();
    assert.equal(text, 'not applied: - item Lantern | qty: 1 — There is no Lantern in the inventory.');
    // The greeting's card has none.
    ui.mounts.card.refresh(0, { force: true });
    ui.mounts.card.toggle(0, true);
    assert.equal(doc.querySelector('.mes[mesid="0"] .refused'), null);
});

test('a held safety-net line is shown with its reason in Problems and the changes card even when no other line runs', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const probe = { id: 'story-director-probe', name: 'Story Director', version: '1.0.0',
        capture: { kinds: { world: { grammar: '+ world Name' } }, apply() { return { narrate: false }; } } };
    const line = '+ world Pier Lockdown — barges held';
    const { doc, host, ui, draw } = await page({ modules: [probe], callModel: async () => { await gate; return line; },
        settings: { modules: { 'story-block': { assistExtractor: true, assistExtractorKinds: '+ world' } } } });
    try {
        host.features.set(CORE_FEATURE.extractor, true);
        const sent = await host.send('Look.', 'Barges are held.');
        draw();
        host.registry.setRestore('pending', 'Restoring a save point.');
        release();
        await new Promise(resolve => setTimeout(resolve, 80));
        const found = host.turn.problems().filter(item => item.index === sent.index && item.code === 'MODULE_HELD');
        assert.equal(found.length, 1);
        const reason = 'Story Director was held back (Restoring a save point.); this line was not used.';
        assert.match(found[0].message, /Story Director was held back/);
        assert.deepEqual(ui.notes.refusedAt(sent.index), [{ line, reason }]);
        ui.mounts.card.refresh(sent.index, { force: true });
        ui.mounts.card.toggle(sent.index, true);
        const card = doc.querySelector(`.mes[mesid="${sent.index}"] [data-ss-card="${THIS_REPLY_ID}"]`);
        assert.match(card.querySelector('.refused').textContent, /Story Director was held back \(Restoring a save point\.\); this line was not used\./);
    } finally { host.close(); }
});

test('refused lines belong to the swipe that wrote them', async () => {
    const { host, ui } = await page();
    await host.send('hi', WITH_LINES);
    assert.equal(ui.notes.refusedAt(2).length, 1);
    await host.swipe('A cleaner reply.\n<Changes>\n+ item Rope | qty: 1\n</Changes>');
    assert.equal(host.ctx.chat[2].swipe_id, 1);
    assert.equal(ui.notes.refusedAt(2).length, 0);
    await host.st.swipeTo(2, 0);
    assert.equal(ui.notes.refusedAt(2).length, 1);
});
