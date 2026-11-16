import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SECRETS, normalizeSecrets, secretId, secretsFromLines, secretsToLines } from '../src/npc-meters.js';
import { normalizeNpcRecord } from '../core.js';
import { validatePack } from '../../../packs/validate.js';
import { contentOf } from '../../../packs/content.js';
import { castSecrets } from '../src/cast-dossier.js';
import { ERSVEIL, fakeDelta, handedOver, host, plain } from './storysuite-v2-meters.helpers.js';

const allNotes = ERSVEIL.flatMap(entry => entry.secrets);

test('secrets from the cast: a when-only note survives a read, with its event words and its hand-over id', () => {
    assert.equal(allNotes.length, 51);
    assert.equal(allNotes.filter(note => note.when && !note.meter).length, 12, 'the fixture has twelve event-only notes');
    for (const entry of ERSVEIL) {
        const given = handedOver(entry.secrets);
        const read = normalizeSecrets(given);
        assert.equal(read.length, given.length, `${entry.id}: every note is kept, event-only ones included`);
        read.forEach((note, i) => {
            assert.equal(note.id, given[i].id, 'the cast dossier\'s id is kept');
            assert.equal(note.text, given[i].text);
            assert.equal(note.title, given[i].title);
            if (given[i].when) assert.equal(note.when, given[i].when, 'the event words are kept whole');
            if (given[i].meter) assert.deepEqual([note.meter, note.at], [given[i].meter, given[i].at]);
            else assert.deepEqual([note.meter, note.at], [undefined, undefined], 'an event-only note has no meter rule');
        });
        // The same notes as a pack gives them (no ids): kept too, with ids of their own that do not repeat.
        const raw = normalizeSecrets(entry.secrets);
        assert.equal(raw.length, entry.secrets.length);
        assert.equal(new Set(raw.map(note => note.id)).size, raw.length);
    }
    // The tail, the Secrets view and the scan's watch see the event-only notes as event notes.
    const only = normalizeSecrets(handedOver(allNotes.filter(note => note.when && !note.meter).slice(0, 1)))[0];
    assert.equal(only.meter, undefined);
    assert.match(only.when, /^after a night when/);
    // Delta's own record keeps the notes as handed over (the sidecar loses no `when`), so a reload reads the same notes.
    const kept = normalizeNpcRecord({ id: 'npc_x', name: 'Tansy', secrets: handedOver(ERSVEIL[0].secrets) });
    assert.deepEqual(normalizeSecrets(kept.secrets), normalizeSecrets(handedOver(ERSVEIL[0].secrets)));
    assert.ok(kept.secrets.some(note => note.when && !note.meter));
});

test('secrets from the cast: every real entry\'s notes round-trip through the dossier editor, event-only ones included', () => {
    for (const entry of ERSVEIL) {
        const notes = normalizeSecrets(handedOver(entry.secrets));
        const lines = secretsToLines(notes);
        assert.equal(lines.split('\n').length, notes.length, `${entry.id}: one line each`);
        const back = secretsFromLines(lines, notes);
        assert.deepEqual(back.problems, [], `${entry.id}: every line reads back`);
        assert.deepEqual(back.secrets, notes, `${entry.id}: same notes, same ids, same event words`);
        // Saved with no change from the editor (no `previous` to keep ids from), the notes keep their rules and words.
        const fresh = secretsFromLines(lines).secrets;
        // (typed again from the box, a note has no earlier note to say what it came from: it is the reader's)
        assert.deepEqual(fresh.map(({ id, ...rest }) => rest), notes.map(({ id, from, ...rest }) => rest));
        assert.equal(new Set(fresh.map(note => note.id)).size, fresh.length);
    }
    const eventLine = secretsToLines(normalizeSecrets(handedOver(allNotes.filter(note => note.when && !note.meter).slice(0, 1))));
    assert.match(eventLine, /^when after a night when the party and Tansy work through casualties together => \[The cellar guest\] /);
});

test('secrets from the cast: a mixed list (meter, event-only, both) is read, edited and kept; a long list is held to eight', async () => {
    const mixed = handedOver([
        ...ERSVEIL[0].secrets,
        { title: 'Either way', text: 'Opens by trust or by the story, whichever comes first.', meter: 'trust', at: 70, when: 'she is told the truth about the ferry' },
    ]);
    const notes = normalizeSecrets(mixed);
    assert.deepEqual(notes.map(note => [note.meter ?? null, note.at ?? null, Boolean(note.when)]), [['trust', 15, false], ['trust', 35, false], [null, null, true], ['trust', 60, false], ['trust', 70, true]]);
    const lines = secretsToLines(notes);
    assert.match(lines, /^trust 15: \[The eleven names\]/m);
    assert.match(lines, /^trust 70 or when she is told the truth about the ferry => \[Either way\]/m);
    assert.deepEqual(secretsFromLines(lines, notes).secrets, notes);
    // The reader changes one line (a new id for it), adds an event note, and the rest keeps what it had.
    const edited = secretsFromLines(`${lines.replace('trust 15:', 'trust 10:')}\nwhen the barge is found => A new note.`, notes);
    assert.deepEqual(edited.problems, []);
    assert.equal(edited.secrets.length, 6);
    assert.equal(edited.secrets[1].id, notes[1].id, 'an unchanged note keeps its id');
    assert.equal(edited.secrets[2].id, notes[2].id, 'so does an unchanged event note');
    assert.notEqual(edited.secrets[0].id, notes[0].id, 'a changed rule is a new note');
    // More than eight: the pack and the reader keep eight.
    assert.equal(normalizeSecrets(handedOver(ERSVEIL.flatMap(entry => entry.secrets))).length, MAX_SECRETS);
    assert.equal(secretsFromLines(secretsToLines(normalizeSecrets(handedOver(ERSVEIL.flatMap(entry => entry.secrets))))).secrets.length, MAX_SECRETS);

    // On the real host: a cast person with a mixed list. Meter notes open by meter, event-only ones wait for the story.
    const delta = fakeDelta();
    delta.records.npc_mira.secrets = normalizeSecrets(handedOver(ERSVEIL[3].secrets));
    const given = delta.records.npc_mira.secrets;
    assert.ok(given.some(note => !note.meter) && given.some(note => note.meter), 'a mixed person');
    const h = await host({ delta });
    h.reply('Nice.', '~ npc Mira | trust: +15');
    const meterNotes = given.filter(note => note.meter);
    const eventNotes = given.filter(note => !note.meter);
    const cast = h.runQuery('npc.cast').find(entry => entry.key === 'npc_mira');
    assert.equal(cast.locked.length + cast.opened.length, given.length, 'every note is on the card, event-only ones too');
    assert.deepEqual(cast.locked.filter(note => note.event).map(note => note.opens), eventNotes.map(() => 'Opens with the story'));
    const tail = h.def.context.tail(h.view());
    const sentLines = [...plain(tail.lines), ...tail.optional];
    for (const note of given) assert.ok(sentLines.some(line => line.includes(note.text)), `sent while she is here: ${note.title}`);
    assert.equal(h.adapter.eventWatch(Object.values(delta.records)).length, Math.min(3, eventNotes.length), 'the scan watches the event-only notes (three at most)');
    assert.equal(meterNotes.length + eventNotes.length, given.length);
    // A story event opens an event-only note; a swipe takes it back.
    const target = eventNotes[0];
    const { index } = h.reply('It happens.', '');
    assert.equal((await h.adapter.openByEvent({ name: 'Mira', ids: [target.id] })).ok, true);
    assert.ok(h.npc('Mira').unlocked.includes(target.id));
    h.swipe(index, '');
    assert.equal(h.npc('Mira').unlocked.includes(target.id), false);
});

function eitherNotes() {
    const checked = validatePack(JSON.stringify({
        id: 'either-pack', name: 'Either', version: '1.0.0', requires: { storyBlock: '>=2.15.0' },
        content: { cast: [{
            id: 'mira', name: 'Mira', about: 'A smith.', look: 'Broad, soot-streaked.', start: { place: 'The forge', goal: 'Keep the fire lit.' },
            secrets: [{ title: 'Either way', text: 'She forged the duke\'s seal.', meter: 'trust', at: 90, when: 'the party asks her about the seal' }],
        }] },
    }));
    assert.equal(checked.ok, true, JSON.stringify(checked.errors));
    const [entry] = contentOf([checked.pack], 'cast');
    return normalizeSecrets(castSecrets(entry.secrets));
}

test('secrets from a pack: a note with both rules arrives with both, keeps them, and is shaped like any other pack note', () => {
    const [note] = eitherNotes();
    assert.deepEqual([note.meter, note.at, note.when, note.title, note.from], ['trust', 90, 'the party asks her about the seal', 'Either way', 'pack']);
    assert.match(note.id, /^sec_/);
    assert.equal(note.id, secretId('trust', 90, "She forged the duke's seal."), 'a meter note keeps the id it always had; the event does not change it');
    // The editor line round-trips with the id and the pack mark.
    const line = secretsToLines([note]);
    assert.equal(line, "trust 90 or when the party asks her about the seal => [Either way] She forged the duke's seal.");
    assert.deepEqual(secretsFromLines(line, [note]).secrets, [note]);
    assert.deepEqual(secretsFromLines(line).problems, []);
    // Left out of one rule it is still a note (the other rule alone); with neither it is dropped.
    assert.deepEqual(castSecrets([{ text: 'x', meter: 'trust', at: 5, when: '' }]).map(item => [item.meter, item.when ?? null]), [['trust', null]]);
    assert.deepEqual(castSecrets([{ text: 'x', meter: '', at: 5, when: 'an event' }]).map(item => [item.meter ?? null, item.when]), [[null, 'an event']]);
    assert.deepEqual(castSecrets([{ text: 'x', meter: 'trust' }]), []);
});

test('secrets from a pack: a both-rules note shows one wording while hidden, opens on the meter OR the story event, and is sent locked like any note', async () => {
    const WORDING = 'Opens at Trust 90 or with the story';
    const make = async () => {
        const delta = fakeDelta();
        delta.records.npc_mira.secrets = eitherNotes();
        const h = await host({ delta });
        h.reply('Nice.', '~ npc Mira | trust: +5');
        return { h, note: delta.records.npc_mira.secrets[0] };
    };

    // Hidden: one wording on the card, the event's words not shown; the story is told it as a locked note; the scan watches the event.
    const { h, note } = await make();
    const hidden = h.runQuery('npc.cast').find(entry => entry.key === 'npc_mira');
    assert.deepEqual(hidden.locked.map(item => [item.id, item.meter, item.at, item.event, item.opens]), [[note.id, 'trust', 90, true, WORDING]]);
    assert.equal(hidden.locked[0].text, 'Hidden note · opens at Trust 90 or with the story');
    assert.equal(JSON.stringify(hidden).includes('the party asks her about the seal'), false, 'the event wording never reaches the card');
    const tail = h.def.context.tail(h.view());
    const sent = [...plain(tail.lines), ...tail.optional].filter(line => line.includes(note.text));
    assert.equal(sent.length, 1, 'sent once while she is here');
    assert.match(sent[0], /Mira \(hidden\): /, 'as a locked note, not as something she may say');
    assert.equal(h.adapter.eventWatch(Object.values(h.delta.records)).length, 1, 'the scan watches for the event');
    assert.deepEqual(h.npc('Mira').unlocked, []);

    // The meter crossing opens it (trust 15 to 90 in capped steps); the card says what opened it.
    for (let i = 0; i < 4; i += 1) h.reply('Nice.', '~ npc Mira | trust: +15');
    assert.deepEqual(h.npc('Mira').unlocked, [], 'still hidden below 90');
    h.reply('Nice.', '~ npc Mira | trust: +15');
    assert.ok(h.npc('Mira').meters.trust >= 90);
    assert.deepEqual(h.npc('Mira').unlocked, [note.id], 'the meter opens it');
    const byMeter = h.runQuery('npc.cast').find(entry => entry.key === 'npc_mira');
    assert.deepEqual([byMeter.locked.length, byMeter.opened.map(item => item.text)], [0, ['Opened · Trust 90']]);
    assert.equal(h.adapter.eventWatch(Object.values(h.delta.records)).length, 0, 'once open the scan stops watching');

    // The story event opens it with the meter far below 90; a swipe takes it back.
    const other = await make();
    const { index } = other.h.reply('It happens.', '');
    assert.ok(other.h.npc('Mira').meters.trust < 90);
    assert.equal((await other.h.adapter.openByEvent({ name: 'Mira', ids: [other.note.id] })).ok, true);
    assert.deepEqual(other.h.npc('Mira').unlocked, [other.note.id], 'the event opens it');
    assert.deepEqual(other.h.runQuery('npc.cast').find(entry => entry.key === 'npc_mira').opened.map(item => item.text), ['Opened · with the story']);
    other.h.swipe(index, '');
    assert.deepEqual(other.h.npc('Mira').unlocked, []);
});
