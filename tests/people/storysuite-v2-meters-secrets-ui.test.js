import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID } from '../../modules/people/storysuite-v2.js';
import { MAX_SECRETS, normalizeGeneratedSecrets, normalizeSecrets, secretId, secretsFromLines, secretsToLines } from '../../modules/people/meters/npc-meters.js';
import { assemble } from '../../core/prompt.js';
import { escapeHtml } from '../../modules/people/util/html.js';
import { JOIN_LINE } from '../../modules/people/core/core-injection-parts-parts/join-line.js';

import { hiddenNotePromptRules } from '../../modules/people/core/core-mechanics.js';
import { buildScannerPrompt } from '../../modules/people/core/core.js';
import { ERSVEIL, EVENT, EVENT_SECRET, SECRET, SECRET_TWO, eventNote, fakeDelta, handedOver, host } from './storysuite-v2-meters.helpers.js';

test('secrets: the editor lists the notes with a Hidden/Opened choice; saving applies a changed choice (npc.open) and an edited line', async () => {
    const h = await host();
    h.reply('Nice.', '~ npc Mira | trust: +25');
    const html = h.adapter.editorHtml(h.delta.records.npc_mira);
    const id = secretId('trust', 30, SECRET);
    assert.match(html, new RegExp(`id="people_edit_secret_state_${id}"`));
    assert.match(html, /when the duke falls => \[title\] note/);
    const dossier = h.delta.records.npc_mira;
    const values = new Map([
        ['people_edit_secrets', secretsToLines(dossier.secrets)],
        [`people_edit_secret_state_${id}`, 'open'],
        [`people_edit_secret_state_${secretId('tension', -20, SECRET_TWO)}`, 'hidden'],
    ]);
    const edits = h.adapter.readEditor(key => values.get(key), dossier);
    assert.deepEqual(edits.noteStates, { open: [id], close: [] }, 'only a choice that changed counts');
    await h.adapter.applyEditor('Mira', edits);
    assert.deepEqual(h.npc('Mira').unlocked, [id]);
    assert.deepEqual(h.sent.map(item => item.type).slice(-2), ['npc.open', 'npc.refresh']);
    // A new line typed by the reader, with an event, is read back.
    values.set('people_edit_secrets', `${secretsToLines(dossier.secrets)}\nwhen the duke falls => A new note.`);
    const more = h.adapter.readEditor(key => values.get(key), dossier);
    assert.equal(more.secrets.length, 3);
    assert.equal(more.secrets[2].when, 'the duke falls');
});

test('secrets: the scanner prompt asks for layered notes and watches story events only when told; otherwise it is as before', () => {
    const base = { transcript: 'USER: hi\nASSISTANT: Mira laughs.', currentTranscript: 'Mira laughs.', existingNpcs: [], userName: 'Ari', charName: 'Narrator' };
    const plain = buildScannerPrompt(base);
    assert.equal(buildScannerPrompt({ ...base, layeredSecrets: false, eventWatch: [] }), plain, 'asked for nothing: byte-identical');
    assert.equal(plain.includes('HIDDEN NOTES'), false);
    const layered = buildScannerPrompt({ ...base, layeredSecrets: true });
    assert.match(layered, /\n16\. HIDDEN NOTES: for each NEW dossier-worthy NPC only/);
    assert.match(layered, /2 to 5 layered hidden notes, light to deep/);
    assert.equal(layered.startsWith(plain.slice(0, plain.indexOf('\n15. JSON only'))), true);
    const watched = buildScannerPrompt({ ...base, eventWatch: [{ key: 's1', name: 'Mira', event: EVENT }, { key: 's2', name: 'Oren', event: 'The bridge falls' }] });
    assert.match(watched, /\n16\. STORY EVENTS to look for[^\n]*s1 = Mira: The duke is exposed as a traitor \| s2 = Oren: The bridge falls\./);
    assert.match(watched, /"secretEvents"/);
    assert.match(watched, /CURRENT exchange/);
    assert.match(buildScannerPrompt({ ...base, layeredSecrets: true, eventWatch: [{ key: 's1', name: 'Mira', event: EVENT }] }), /\n16\. HIDDEN NOTES[^\n]*\n17\. STORY EVENTS/);
    assert.equal(hiddenNotePromptRules({ eventWatch: [{ name: 'x' }, null] }), '', 'an item with no key or event is no watch');
});

test('secrets: redactSent hides a join line whose own words hold a hidden-note marker', async () => {
    const hide = (await host()).def.hooks.redactSent;
    const join = 'After the lighthouse oath (hidden): ask at the pier.';
    const shown = hide(`- Mira: IDENTITY ferry hand; ${JOIN_LINE(join)}\n- Oren: IDENTITY clerk`);
    assert.equal(shown, '- Mira: IDENTITY ferry hand\n- Oren: IDENTITY clerk');
});

test('secrets: redactSent takes a part\'s whole multi-line text and redacts every locked line, leaving the rest as it is', async () => {
    const h = await host();
    const hide = h.def.hooks.redactSent;
    const secret = 'Trust me: she is the heir; hidden: never state or reveal'; // text that itself looks like the wording
    const text = [
        'NPC meters now: Mira trust 25, affection 0, desire 0, tension 0.',
        `Mira, known to the player now; may come out: ${SECRET}`,
        `Mira, hidden: never state or reveal; let it shape how they act: ${SECRET_TWO}`,
        '',
        `Oren, Duke of the Marches, hidden: never state or reveal; let it shape how they act: ${secret}`,
        `Mira, hidden: never state or reveal; let it shape how they act: ${SECRET}`,
        `Lines marked (hidden) are secrets: never state or reveal them; let them shape how that person acts.`,
        `Mira (hidden): ${SECRET_TWO}`,
        'A line that merely says hidden: never state or reveal.',
    ].join('\n');
    const shown = hide(text);
    assert.deepEqual(shown.split('\n'), [
        'NPC meters now: Mira trust 25, affection 0, desire 0, tension 0.',
        `Mira, known to the player now; may come out: ${SECRET}`,
        'Mira: 1 hidden note',
        '',
        'Oren, Duke of the Marches: 1 hidden note',
        'Mira: 1 hidden note',
        'Lines marked (hidden) are secrets: never state or reveal them; let them shape how that person acts.',
        'Mira: 1 hidden note',
        'A line that merely says hidden: never state or reveal.',
    ], 'four locked lines redacted wherever they stand; blank and other lines untouched');
    for (const locked of [SECRET_TWO, secret]) assert.equal(shown.includes(locked), false);
    assert.equal(hide(shown), shown, 'redacting again changes nothing');
    // Line breaks of either kind are kept.
    assert.equal(hide(`a\r\nMira, hidden: never state or reveal; let it shape how they act: ${SECRET}\r\nb`), 'a\r\nMira: 1 hidden note\r\nb');
    assert.equal(hide(`Mira, hidden: never state or reveal; let it shape how they act: ${SECRET}`), 'Mira: 1 hidden note', 'a single line');
    // A text with no locked line is returned as it is, whatever it is.
    for (const plain of ['', 'x', 'one\ntwo\n', h.def.context.static()]) assert.equal(hide(plain), plain);
    assert.equal(hide(null), '');
    // The very text the host builds, through the host's own assembler: nothing locked survives, everything else does.
    h.reply('Nice.', '~ npc Mira | trust: +25');
    const part = assemble({ registry: h.registry, view: h.view(), settings: { tailBudget: 1500 } }).parts.find(item => item.module === MODULE_ID && item.place === 'tail');
    const out = hide(part.text);
    const was = part.text.split('\n');
    const now = out.split('\n');
    assert.equal(now.length, was.length, 'same number of lines');
    was.forEach((line, i) => assert.equal(now[i], /^Mira \(hidden\): /.test(line) ? 'Mira: 1 hidden note' : line));
    assert.equal(now.filter(line => line === 'Mira: 1 hidden note').length, 2);
});

// ---- the dossier editor shows no locked note it did not write ----

const shownIn = (html, value) => html.includes(value) || html.includes(escapeHtml(value));

test('editor: every locked note of the 12 real entries is only "Hidden note n · opens …" (no title, text or event words anywhere in the form)', async () => {
    for (const entry of ERSVEIL) {
        const delta = fakeDelta();
        delta.records.npc_mira.secrets = normalizeSecrets(handedOver(entry.secrets));
        delta.records.npc_mira.relationship.trust = -50;
        const h = await host({ delta });
        h.reply('Nice.', '~ npc Mira | tension: +1');
        const html = h.adapter.editorHtml(delta.records.npc_mira);
        for (const note of entry.secrets) {
            for (const secret of [note.title, note.text, note.when].filter(Boolean)) assert.equal(shownIn(html, secret), false, `${entry.id}: "${secret.slice(0, 40)}" is not in the form`);
            // Not even the first words (a title or a text cut short).
            assert.equal(shownIn(html, note.text.slice(0, 24)), false);
        }
        const rows = [...html.matchAll(/<span>(Hidden note \d+ · opens [^<]*)<\/span><select[^>]*aria-label="(Hidden note \d+)"/g)];
        assert.equal(rows.length, entry.secrets.length, `${entry.id}: one row per hidden note`);
        rows.forEach((row, i) => {
            assert.match(row[1], new RegExp(`^Hidden note ${i + 1} · opens (?:at \\w+ -?\\d+|with the story)$`));
            assert.equal(row[2], `Hidden note ${i + 1}`);
        });
        assert.match(html, /<textarea id="people_edit_secrets"[^>]*><\/textarea>/, 'the box is empty: nothing of the reader\'s own and nothing opened');
        assert.equal((html.match(/data-delta-secret=/g) || []).length, entry.secrets.length, 'every note keeps its open/shut control');
    }
});

test('editor: pack and scan notes stay hidden while locked; an older note with no marker is the reader\'s, shown and editable', async () => {
    const delta = fakeDelta();
    const generated = normalizeGeneratedSecrets([
        { title: 'Generated layer', text: 'A generated secret text.', meter: 'trust', at: 50, from: 'reader' },
        { title: 'Generated event', text: 'A generated event text.', when: 'something happens in the story', from: '' },
    ]);
    assert.deepEqual(generated.map(note => note.from), ['scan', 'scan'], 'a model cannot choose what a note says it came from');
    const packed = normalizeSecrets([{ title: 'Packed', text: 'A pack\'s secret text.', meter: 'trust', at: 60, from: 'pack' }]);
    assert.equal(packed[0].from, 'pack');
    assert.equal(normalizeSecrets([{ text: 'x', meter: 'trust', at: 1, from: 'reader' }, { text: 'y', meter: 'trust', at: 2, from: { a: 1 } }]).some(note => 'from' in note), false, 'only "pack" and "scan" are kept');
    const old = normalizeSecrets([{ title: 'Mine', text: 'I wrote this one in an older version.', meter: 'trust', at: 70 }])[0];
    assert.equal('from' in old, false);
    const opened = normalizeSecrets([{ title: 'Known', text: 'Already open to the player.', meter: 'trust', at: 5, from: 'pack' }])[0];
    delta.records.npc_mira.secrets = [...generated, ...packed, old, opened];
    const h = await host({ delta });
    h.reply('Nice.', '~ npc Mira | tension: +1');
    assert.deepEqual(h.npc('Mira').unlocked, [opened.id]);
    const html = h.adapter.editorHtml(delta.records.npc_mira);
    for (const secret of ['Generated layer', 'A generated secret text.', 'Generated event', 'A generated event text.', 'something happens in the story', 'Packed', 'A pack\'s secret text.']) assert.equal(shownIn(html, secret), false, secret);
    for (const secret of ['I wrote this one in an older version.', 'Already open to the player.']) assert.equal(shownIn(html, secret), true, `${secret} is shown`);
    assert.match(html, /<span>Hidden note 1 · opens at Trust 50<\/span>/);
    assert.match(html, /<span>Hidden note 2 · opens with the story<\/span>/);
    assert.match(html, /<span>Hidden note 3 · opens at Trust 60<\/span>/);
    assert.equal((html.match(/Hidden note \d/g) || []).length, 6, 'three rows, each named twice (row and control)');
    // The older note is editable: its line is in the box; changing it saves the change, and the hidden ones are untouched.
    const values = new Map([['people_edit_secrets', secretsToLines([old, opened]).replace('older version', 'newer version')]]);
    const saved = h.adapter.readEditor(key => values.get(key), delta.records.npc_mira);
    const mine = saved.secrets.find(note => note.text.includes('newer version'));
    assert.ok(mine, 'the edited line is saved');
    assert.equal('from' in mine, false, 'still the reader\'s');
    assert.equal(saved.secrets.some(note => note.text.includes('older version')), false);
    for (const note of [...generated, ...packed]) assert.deepEqual(saved.secrets.find(item => item.id === note.id), note, 'hidden notes exactly as they were');
});

test('editor: saving keeps every hidden note exactly as it was (ids and raw words), adds the reader\'s own, and applies a Hidden/Opened choice', async () => {
    const delta = fakeDelta();
    const longWhen = 'after a night when the party and Tansy work through casualties together and the river rises again ok';
    const packed = handedOver([...ERSVEIL[0].secrets, { title: 'Long', text: 'T'.repeat(200), when: `${longWhen} ${'x'.repeat(70)}` }]);
    const opened = normalizeSecrets([{ title: 'Known', text: 'Already open to the player.', meter: 'trust', at: 5, from: 'pack' }])[0];
    delta.records.npc_mira.secrets = [packed[0], opened, ...packed.slice(1)];
    const h = await host({ delta });
    h.reply('Nice.', '~ npc Mira | tension: +1');
    const dossier = delta.records.npc_mira;
    const html = h.adapter.editorHtml(dossier);
    const box = escapeHtml('trust 5: [Known] Already open to the player.');
    assert.ok(html.includes(`>${box}</textarea>`), 'only the opened note is in the box');
    const values = new Map([['people_edit_secrets', 'trust 5: [Known] Already open to the player.\nwhen the barge is found => [Mine] A note I wrote.']]);
    const edits = h.adapter.readEditor(key => values.get(key), dossier);
    assert.deepEqual(edits.problems, []);
    const ids = edits.secrets.map(note => note.id);
    assert.deepEqual(ids.slice(0, 1), [packed[0].id], 'order kept');
    for (const note of packed) assert.deepEqual(edits.secrets.find(item => item.id === note.id), note, `${note.title}: exactly as it was, whatever its length`);
    assert.deepEqual(edits.secrets.find(item => item.id === opened.id), opened, 'an opened note left alone is the note it was (not the reader\'s)');
    const mine = edits.secrets.at(-1);
    assert.deepEqual([mine.when, mine.title, 'from' in mine], ['the barge is found', 'Mine', false], 'a line written here is the reader\'s: no marker');
    assert.equal(edits.secrets.length, packed.length + 2);
    // The reader deletes the opened line: it goes; the hidden ones stay.
    values.set('people_edit_secrets', '');
    const cleared = h.adapter.readEditor(key => values.get(key), dossier);
    assert.deepEqual(cleared.secrets.map(note => note.id), packed.map(note => note.id));
    // The hidden control: open the first hidden note by hand.
    values.set(`people_edit_secret_state_${packed[0].id}`, 'open');
    const moved = h.adapter.readEditor(key => values.get(key), dossier);
    assert.deepEqual(moved.noteStates, { open: [packed[0].id], close: [] });
    await h.adapter.applyEditor('Mira', moved);
    assert.ok(h.npc('Mira').unlocked.includes(packed[0].id));
    // Now it is open, so the next editor shows it (the player knows it) and it is the pack's note still.
    dossier.secrets = moved.secrets;
    assert.equal(shownIn(h.adapter.editorHtml(dossier), packed[0].title), true);
    // At most eight in all: the hidden ones are never pushed out by the reader's lines.
    values.set('people_edit_secrets', Array.from({ length: 6 }, (_, i) => `when event ${i} => note ${i}`).join('\n'));
    const crowded = h.adapter.readEditor(key => values.get(key), dossier);
    assert.equal(crowded.secrets.length, MAX_SECRETS, 'eight in all: five hidden, three of the six new lines');
    // (the opened one was in the box, and the reader's box no longer lists it, so it is gone; every hidden one stays)
    for (const note of packed.slice(1)) assert.ok(crowded.secrets.some(item => item.id === note.id));
    assert.equal(crowded.secrets.some(item => item.id === packed[0].id), false);
    assert.match(crowded.problems.join(' '), /not kept/);
});

test('secrets view: blank bars take their lengths from a fixed set in turn, never from a note\'s text or length', async () => {
    const widths = async text => {
        const delta = fakeDelta();
        delta.records.npc_mira.secrets = [10, 20, 30, 40, 50].map(at => ({ title: `T${at}`, meter: 'trust', at, text: text.repeat(at) }));
        delta.records.npc_mira.relationship.trust = -50;
        const h = await host({ delta });
        h.reply('Nice.', '~ npc Mira | tension: +1');
        return h.adapter.dossierMeters(Object.values(delta.records)).npc_mira.secrets.map(note => note.width);
    };
    const short = await widths('a');
    const long = await widths('Quite different words, much longer. ');
    assert.deepEqual(short, long, 'the same whatever the text');
    assert.deepEqual(short, [62, 48, 56, 70, 62]);
});
