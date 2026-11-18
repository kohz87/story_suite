import test from 'node:test';
import assert from 'node:assert/strict';
import { chatLineage, fingerprintMessage, firstLineageDivergence, lineageCheckpointKey } from '../../modules/people/lineage/index.js';

const user = (text, name = 'Kazuma') => ({ is_user: true, is_system: false, name, mes: text });
const assistant = (text, swipe = 0, name = 'Megumin') => ({ is_user: false, is_system: false, name, mes: text, swipe_id: swipe });

test('message fingerprint follows narrative content and ignores unstable swipe index numbering', () => {
    const a = assistant('Yunyun enters.', 0);
    const b = assistant('Yunyun leaves.', 0);
    const c = assistant('Yunyun enters.', 1);
    assert.notEqual(fingerprintMessage(a), fingerprintMessage(b));
    assert.equal(fingerprintMessage(a), fingerprintMessage(c), 'identical narrative content remains the same branch when swipe indices renumber');
    assert.equal(firstLineageDivergence(chatLineage([user('Hi'), a]), chatLineage([user('Hi'), c])), -1);
});

test('hiding a message (the system flag) and its speaker label leave its fingerprint as it was', () => {
    const shown = assistant('Yunyun enters.');
    assert.equal(fingerprintMessage({ ...shown, is_system: true }), fingerprintMessage(shown));
    assert.equal(fingerprintMessage({ ...shown, name: 'Someone else' }), fingerprintMessage(shown));
    assert.notEqual(fingerprintMessage(user('Yunyun enters.')), fingerprintMessage(shown), 'who spoke (the reader or the story) is part of it');
});

test('a message key chains every message before it: an earlier change moves every later key, a later one none before it', () => {
    const chat = [user('Hi'), assistant('One.'), user('Go on'), assistant('Two.')];
    const lineage = chatLineage(chat);
    const keys = lineage.map((_, index) => lineageCheckpointKey(lineage, index));
    assert.equal(new Set(keys).size, 4);
    const earlier = chatLineage([chat[0], assistant('Uno.'), chat[2], chat[3]]);
    assert.equal(lineageCheckpointKey(earlier, 0), keys[0]);
    for (const index of [1, 2, 3]) assert.notEqual(lineageCheckpointKey(earlier, index), keys[index]);
    const later = chatLineage([...chat.slice(0, 3), assistant('Dos.')]);
    for (const index of [0, 1, 2]) assert.equal(lineageCheckpointKey(later, index), keys[index]);
    assert.equal(lineageCheckpointKey(lineage, -1), '');
    assert.equal(lineageCheckpointKey(lineage, 9), '');
    assert.equal(firstLineageDivergence(lineage, earlier), 1);
    assert.equal(firstLineageDivergence(lineage, lineage.slice(0, 2)), 2, 'a shorter lineage parts where it ends');
});

// The values the moved code gave before it left modules/people/legacy (B4-10a): stored scan marks, memory-fact keys and capture-journal keys are
// these strings, so a change here would orphan them.
test('fingerprints and keys are the same strings as before the move', () => {
    const chat = [{ is_user: true, mes: 'Hi' }, { is_user: false, mes: 'Yunyun enters.' }, { is_user: false, is_system: true, mes: 'hidden' }];
    const lineage = chatLineage(chat);
    assert.deepEqual(lineage, ['gjd2z2.1e5s84q', 'lsxmd7.15wo1yf', '1md6qsk.1adulw8']);
    assert.equal(lineageCheckpointKey(lineage, 2), 'x18mec.93g7vs');
});
