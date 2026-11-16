import test from 'node:test';
import assert from 'node:assert/strict';
import { NOTE_FIELDS, KINDS, runKind, validateNotes, notesTail, NOTES_TAIL_PER_NPC, NOTES_TAIL_MAX, seedNotes, driveScale, foldTies, aliasCanon, tieRows, dossierNotes } from '../src/npc-notes-kinds.js';
import { addLie } from '../src/npc-notes-lies.js';
import { addKnow } from '../src/npc-notes-knows.js';
import { tastesText } from '../src/npc-notes-tastes.js';
import { tiesText } from '../src/npc-notes-ties.js';
import { stepPull } from '../npc-instincts.js';
import { setDrives } from '../src/npc-notes-drives.js';
import { normalizeEntry } from '../src/cast-dossier.js';
import { bondToneOf } from '../relationship-map-focus.js';
import { resolveMapBonds } from '../relationship-map-core.js';
import { tieTone } from '../dossier-ui-bond-tone.js';
import { said, notesSpy } from './npc-notes-kinds.helpers.js';

test('NOTE_FIELDS lists the six record fields the kinds own, and KINDS maps the four line kinds to their fields', () => {
    assert.deepEqual([...NOTE_FIELDS], ['lies', 'knows', 'tastes', 'ties', 'drives', 'lookLockedAt']);
    assert.deepEqual(Object.keys(KINDS), ['lie', 'know', 'taste', 'tie']);
    assert.deepEqual(Object.fromEntries(Object.entries(KINDS).map(([kind, entry]) => [kind, entry.field])), {
        lie: 'lies', know: 'knows', taste: 'tastes', tie: 'ties',
    });
});

test('runKind lie: a told lie is written with the reply key and no notes are sent', () => {
    const notes = notesSpy();
    const out = runKind('lie', null, { to: 'Astra', said }, { name: 'Rika', day: 3, r: 'r1', notes });
    assert.equal(out.field, 'lies');
    assert.equal(out.problem, '');
    assert.equal(JSON.parse(out.text)[0].to, 'Astra');
    assert.deepEqual(notes.calls, []);
});

test('runKind lie catch: stamps the uncaught lie, runs the trust drop at the meaningful tier and flags a receipt', () => {
    const notes = notesSpy();
    const prior = addLie(null, { to: 'Astra', said, day: 3, r: 'r1' }).text;
    const out = runKind('lie', prior, { catch: true, to: 'Astra', said: 'spell' }, { name: 'Rika', day: 4, r: 'r2', notes });
    assert.equal(out.problem, '');
    assert.equal(JSON.parse(out.text)[0].caught.r, 'r2');
    assert.deepEqual(notes.calls, [
        ['run', { changes: [{ meter: 'trust', mode: 'add', value: -6 }], impact: { tier: 'extreme' } }],
        ['flag', 'Rika: caught in a lie to Astra.', undefined],
    ]);
});

test('runKind lie catch with no matching lie is refused and sends nothing', () => {
    const notes = notesSpy();
    const out = runKind('lie', null, { catch: true, to: 'Astra' }, { name: 'Rika', day: 4, r: 'r2', notes });
    assert.match(out.problem, /matches that catch/);
    assert.deepEqual(notes.calls, []);
});

test('runKind know: a reply\'s lines are written; a bad line refuses the whole command', () => {
    const ok = runKind('know', null, { lines: [{ about: 'Mara', fact: 'debt to the guild', how: 'saw' }] }, { r: 'r1' });
    assert.equal(ok.field, 'knows');
    assert.equal(ok.problem, '');
    assert.equal(JSON.parse(ok.text)[0].fact, 'debt to the guild');
    const bad = runKind('know', null, { lines: [{ about: 'Mara', fact: 'debt', how: 'guessed' }] }, { r: 'r1' });
    assert.match(bad.problem, /how \(saw or heard\)/);
    assert.equal(bad.text, null);
});

test('runKind taste: a refused opposite sign keeps the list; a mirrored taste is kept and flagged, not refused', () => {
    const base = tastesText([{ sign: '+', item: 'burnt sugar', day: 1, r: 'r1' }]);
    const notes = notesSpy();
    const refused = runKind('taste', base, { sign: '-', item: 'burnt sugar' }, { name: 'Rika', day: 2, r: 'r2', notes });
    assert.equal(refused.text, base);
    assert.match(refused.problem, /needs a why: reason/);
    assert.deepEqual(notes.calls, []);

    const mirror = runKind('taste', null, { sign: '+', item: 'river fish' }, { name: 'Rika', day: 2, r: 'r2', userText: 'I love river fish', notes });
    assert.equal(mirror.problem, '');
    assert.equal(JSON.parse(mirror.text)[0].mirrored, true);
    assert.equal(notes.calls.length, 1);
    assert.equal(notes.calls[0][0], 'flag');
    assert.match(notes.calls[0][1], /echoes \{\{user\}\}'s words; kept and marked\.$/);
});

test('runKind tie: +ally applies, self-ties and unknown tags are refused, an emptied record returns null text', () => {
    const added = runKind('tie', null, { self: 'Rika', with: 'Mara', tags: ['+ally'] }, { name: 'Rika' });
    assert.equal(added.field, 'ties');
    assert.equal(added.problem, '');
    assert.deepEqual(Object.values(JSON.parse(added.text)), [['ally']]);

    const self = runKind('tie', null, { with: 'Rika', tags: ['+ally'] }, { name: 'Rika' });
    assert.match(self.problem, /self/);
    const unknown = runKind('tie', null, { with: 'Mara', tags: ['+buddy'] }, { name: 'Rika' });
    assert.match(unknown.problem, /Unknown tie tag: \+buddy/);

    const cleared = runKind('tie', added.text, { with: 'Mara', tags: ['-ally'] }, { name: 'Rika' });
    assert.equal(cleared.text, null);
    assert.equal(cleared.problem, '');
});

test('runKind: an unknown kind is refused with a problem and writes nothing', () => {
    const out = runKind('gossip', null, {}, {});
    assert.equal(out.field, null);
    assert.equal(out.text, null);
    assert.match(out.problem, /Unknown note kind: gossip/);
});

test('validateNotes: absent and well-formed leaves pass; a bad leaf names its field', () => {
    assert.equal(validateNotes(undefined), '');
    assert.equal(validateNotes({}), '');
    const good = {
        lies: addLie(null, { to: 'Astra', said, day: 3, r: 'r1' }).text,
        knows: addKnow(null, 'r1', [{ about: 'Mara', fact: 'debt', how: 'heard' }]).text,
        tastes: tastesText([{ sign: '+', item: 'burnt sugar', day: 1, r: 'r1' }]),
        ties: tiesText({ mara: ['ally'] }),
        drives: JSON.stringify({ belo: 3 }),
        lookLockedAt: { day: 2, r: 'r1' },
    };
    assert.equal(validateNotes(good), '');
    assert.equal(validateNotes({ lies: 'not json' }), 'lies is not valid.');
    assert.equal(validateNotes({ knows: '[{"about":"Mara"}]' }), 'knows is not valid.');
    assert.equal(validateNotes({ tastes: '[{"sign":"?"}]' }), 'tastes is not valid.');
    assert.equal(validateNotes({ drives: '{"belo":9}' }), 'drives is not valid.');
    assert.equal(validateNotes({ lookLockedAt: { day: -1, r: '' } }), 'lookLockedAt is not valid.');
});

test('notesTail: two lines per present person (lie, then secret or fact, then taste) and four in all, nearest first', () => {
    const rika = {
        name: 'Rika',
        lies: addLie(null, { to: 'Astra', said, day: 3, r: 'r1' }).text,
        knows: addKnow(null, 'r1', [{ about: 'Mara', fact: 'debt to the guild', how: 'heard' }]).text,
        tastes: tastesText([{ sign: '+', item: 'burnt sugar', day: 1, r: 'r1' }]),
    };
    const mara = { name: 'Mara', tastes: tastesText([{ sign: '-', item: 'rain', day: 1, r: 'r1' }]) };
    const aldo = { name: 'Aldo', tastes: tastesText([{ sign: '+', item: 'bread', day: 1, r: 'r1' }]) };
    const lines = notesTail({ rika: rika, mara, aldo }, { present: ['rika', 'mara', 'aldo'] });
    assert.equal(lines.length, NOTES_TAIL_MAX);
    assert.equal(NOTES_TAIL_PER_NPC, 2);
    assert.match(lines[0], /^Rika \(hidden\): told Astra/);
    assert.equal(lines[1], "Rika knows: Mara's debt to the guild");
    assert.equal(lines[2], 'Mara dislikes rain.');
    assert.equal(lines[3], 'Aldo likes bread.');
});

test('notesTail: nobody present, or a person with no notes, adds no lines', () => {
    assert.deepEqual(notesTail({ rika: { name: 'Rika' } }, { present: ['rika'] }), []);
    assert.deepEqual(notesTail({ rika: { name: 'Rika', tastes: tastesText([{ sign: '+', item: 'bread', day: 1, r: 'r1' }]) } }, { present: [] }), []);
    assert.deepEqual(notesTail(undefined, { present: ['rika'] }), []);
});

test('notes pure: drives scale the pull, a muted instinct gives none; tie rows derive from the relation word without storing; aliases fold', () => {
    const facts = { day: 5, party: false, threads: [], here: '', present: true, awayDay: null };
    const benched = stepPull({ party: 1 }, facts);
    assert.equal(benched.pull?.kind, 'belonging');
    const muted = stepPull({ party: 1 }, { ...facts, scale: driveScale(setDrives('', { belo: 0 }, {})) });
    assert.equal(muted.pull, null, 'belonging muted: no pull');
    assert.deepEqual(stepPull({ party: 1 }, { ...facts, scale: driveScale(setDrives('', { belo: 2 }, {})) }).pull, benched.pull, 'normal strength leaves the pull as it is');
    const rows = tieRows({}, ['Mira — rival of the house | cold', 'Tomas — friend | warm'], []);
    assert.deepEqual(rows.map(row => [row.name, row.tags, row.derived]), [['Mira', ['rival'], true], ['Tomas', ['ally'], true]]);
    assert.deepEqual(foldTies({ 'old-name': ['ally'], 'new-name': ['owes'] }, aliasCanon([{ name: 'New Name', aliases: ['Old Name'] }])), { 'new-name': ['ally', 'owes'] });
    assert.equal(dossierNotes({ lies: addLie('', { to: 'A', said: 'x', day: 1, r: 'sw_a' }).text }).lies[0].said, null);
});

test('notes pure: a pack entry\'s tastes and drives are the person\'s first; the map line takes its tone from a tie tag', () => {
    const entry = normalizeEntry({ name: 'Rika', about: 'a calm clerk', personality: 'Wants closure above all.', tastes: [{ sign: '+', item: 'toffee', from: 'barge crews' }, { sign: 'x', item: 'bad' }], drives: { closure: 3 } });
    assert.deepEqual(entry.tastes, [{ sign: '+', item: 'toffee', from: 'barge crews' }]);
    const seeded = seedNotes(entry);
    assert.equal(JSON.parse(seeded.tastes)[0].item, 'toffee');
    assert.ok(seeded.drives, 'a pack drive is a stored leaf');
    assert.deepEqual(seedNotes(normalizeEntry({ name: 'Plain' })), {}, 'nothing for a default');
    assert.equal(tieTone(['ally', 'rival']), 'hostile');
    assert.equal(tieTone(['owes']), 'duty');
    assert.equal(bondToneOf('friend', 'friend', { tags: ['rival'] }), 'bad');
    assert.equal(bondToneOf('friend', 'friend', { tags: ['owes'] }), 'gold');
    const npcs = [{ id: 'a', name: 'Rika', keyRelationships: ['Joren — friend'], v2Meters: { ties: { b: ['owes'] } } }, { id: 'b', name: 'Joren', keyRelationships: [] }];
    assert.deepEqual(resolveMapBonds(npcs, new Set(['a', 'b']))[0].tags, ['owes']);
});

test('a stored taste leaf with "[m2]" citations (valid on main) still validates, displays clean, and a taste write keeps its old rows as stored', () => {
    const leaves = [
        [{ sign: '+', item: 'tea [m2]', day: 1, r: 'r1' }, { sign: '+', item: 'tea [m5]', day: 2, r: 'r2' }],
        [{ sign: '+', item: 'tea', day: 1, r: 'r1' }, { sign: '-', item: 'tea [m5]', day: 2, r: 'r2' }],
        [{ sign: '+', item: '[m2]', day: 1, r: 'r1' }],
    ].map(rows => JSON.stringify(rows));
    for (const leaf of leaves) {
        assert.equal(validateNotes({ tastes: leaf }), '', 'what main accepted stays valid');
        assert.doesNotMatch(JSON.stringify(dossierNotes({ tastes: leaf }).tastes), /\[m\d/, 'shown clean');
    }
    assert.deepEqual(dossierNotes({ tastes: leaves[0] }).tastes.map(row => row.item), ['tea']);
    const out = runKind('taste', leaves[0], { sign: '+', item: 'coffee [m7]' }, { name: 'Oren', day: 3, r: 'r3', notes: { flag() {} } });
    const written = JSON.parse(out.text);
    assert.deepEqual(written.slice(0, 2), JSON.parse(leaves[0]), 'old rows stay byte-identical');
    assert.equal(written[2].item, 'coffee', 'the new row is written clean');
    assert.equal(validateNotes({ tastes: out.text }), '');
});
