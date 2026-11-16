// The v1 settled note: the drafted text the owner reads (note.golden.txt; WRITE_GOLDEN=1 rewrites it, to be reviewed, never to make a failure pass), the fixed words
// kept byte-identical to the old note, numbers that match the record, and the same text for the same envelope however it was reached (reload, split fight, edited Re-read).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { settledNoteV1 } from '../../../../src/v2/lean-rpg/combat/note.js';
import { settledNote } from '../../../../src/v2/lean-rpg/board/note-parts/settled-note.js';
import { playBoard } from '../../../../src/v2/lean-rpg/combat/play.js';
import { envelopeOf } from '../../../../src/v2/lean-rpg/combat/envelope.js';
import { seeded } from './dice.helper.js';
import { hard, played, quiet, skirmish, skirmishChoices, turns } from './note.helper.js';

const GOLDEN = new URL('./note.golden.txt', import.meta.url);
const split = note => note.split(' | ');
const show = note => split(note).join('\n');
// (each `Exchange n: …` with all its rows, without the closing lines)
const exchanges = note => note.replace(/ \| (The fight is|The party fled)[\s\S]*$/u, '').split(/ \| (?=Exchange \d+:)/u).filter(part => /^Exchange \d+:/u.test(part));

const healing = [{}, {}, { Cy: { kind: 'heal', target: 'Kira' } }, {}, {}, {}];
const win = () => played(quiet(), 'a', healing);
const loss = () => played(hard(), 'a', 12);
const open = () => played(skirmish(), 'a', skirmishChoices);
const fled = () => played(quiet(), 'a', 6, { flee: { 3: ['Kira', 'Cy'] } });

test('the drafted note golden: a quiet win, a lost fight, a fled one and an open skirmish (every sentence shape)', () => {
    const text = [['A quiet fight, won, a foe taken to 0 (at most 250 words asked)', win()], ['A hard fight, lost (at most 250 words asked)', loss()], ['A fight the party flees (at most 250 words asked)', fled()], ['An open skirmish: plain, area and skill attacks, stances taken and dropped, a heal, soaked hits (about 100 words asked)', open()]]
        .map(([title, envelope]) => `## ${title}\n\n${show(settledNoteV1(envelope))}\n`).join('\n');
    if (process.env.WRITE_GOLDEN) writeFileSync(GOLDEN, text);
    assert.equal(text, readFileSync(GOLDEN, 'utf8'));
});

test('the length rule is unchanged: any actor going to 0, a foe included, asks for 250 words; a won fight where none went down asks for 100', () => {
    const rats = envelope => settledNoteV1(envelope);
    const won = played(quiet(), 'a', 6);
    assert.equal(won.stop, 'won');
    assert.ok(won.moves.some(move => move.bar === 'hp' && move.from > 0 && move.to === 0 && !won.party.some(hero => hero.id === move.id)), 'the won fight has a foe taken to 0');
    assert.equal(won.hurts.some(hurt => hurt.to === 0), false, 'and no hero went to 0 (hurts hold heroes only)');
    assert.match(rats(won), /at most 250 words/u);
    const quietWin = { ...won, moves: won.moves.filter(move => !(move.to === 0 && move.bar === 'hp')) };
    assert.match(rats(quietWin), /about 100 words/u);
});

test('the fixed instructions and the closing lines are the old note\'s words, byte for byte', () => {
    for (const stop of ['open', 'won', 'lost', 'fled']) {
        const old = settledNote({ stop, rounds: [] }), now = settledNoteV1({ stop, lines: [], moves: [] });
        assert.equal(now, old, `${stop}: a fight with no exchange reads exactly as the old note`);
    }
    const note = split(settledNoteV1(win()));
    assert.deepEqual(note.slice(0, 3), split(settledNote({ stop: 'won', rounds: [] })).slice(0, 3));
});

test('every HP number the note tells is a move in the record, in order; a miss and an evaded hit tell no bar line', () => {
    for (const envelope of [win(), loss(), fled()]) {
        const note = settledNoteV1(envelope), told = [...note.matchAll(/(\S[^|;:]*?) HP (?:(\d+) → )?(\d+)/gu)];
        const moves = envelope.moves.filter(move => move.bar === 'hp');
        assert.equal(told.length, moves.length, 'one HP number per HP move');
        told.forEach((match, at) => { assert.equal(Number(match[3]), moves[at].to); if (match[2] !== undefined) assert.equal(Number(match[2]), moves[at].from); });
        for (const part of split(note)) if (/: (miss|\w[\w ]* evades)/u.test(part)) assert.doesNotMatch(part, /HP/u, `no bar line for: ${part}`);
        assert.doesNotMatch(note, /at a cost|glances|\bcost\b/u, 'no old stage words');
    }
});

test('a hit names the stance that soaked it, once; a stance told once, and dropped when it ends', () => {
    const note = settledNoteV1(win());
    assert.equal((note.match(/takes the Defence stance/gu) ?? []).length, 2, 'once per hero, not once per exchange');
    assert.match(note, /Wolf attacks \w+: hit(, decisive)?; \w+'s Defence stance absorbs \d+%; \w+ HP \d+ → \d+/u);
    const dropped = settledNoteV1({ stop: 'open', moves: [], lines: [['exchange', 1], ['stance', 'Kira', ['defence']], ['exchange', 2], ['stance', 'Kira', []]] });
    assert.match(dropped, /Exchange 1: Kira takes the Defence stance\. \| Exchange 2: Kira drops the Defence stance\./u);
});

test('the length line follows the fight: a hero or a foe down, a loss or a flee ask for 250 words, an open fight where none went down for 100; none for an empty account', () => {
    assert.match(settledNoteV1(win()), /at most 250 words/u, 'a foe went to 0: the old rule');
    assert.match(settledNoteV1(open()), /about 100 words/u);
    assert.match(settledNoteV1(loss()), /at most 250 words/u);
    assert.match(settledNoteV1(fled()), /at most 250 words/u);
    assert.doesNotMatch(settledNoteV1(win(), { fightLen: false }), /words/u);
    assert.doesNotMatch(settledNoteV1({ stop: 'open', lines: [], moves: [] }), /words/u);
});

test('reload and swipe back: the same stored envelope reads the same, before and after JSON', () => {
    for (const envelope of [win(), loss(), fled()]) {
        const note = settledNoteV1(envelope);
        assert.equal(settledNoteV1(JSON.parse(JSON.stringify(envelope))), note);
        assert.equal(settledNoteV1(structuredClone(envelope)), note);
    }
});

test('a fight told in two replies: the second note continues the exchange numbers, tells no order line again, and each hit reads as in the whole fight', () => {
    const whole = played(quiet(), 'a', 6), first = played(quiet(), 'a', 2);
    const record = playBoard(quiet(), seeded({ seed: 'a' }), turns(2));
    const next = playBoard({ party: record.party, foes: record.foes }, seeded({ seed: 'a', start: { offset: 2, order: record.order, rotation: record.rotation } }), turns(4));
    const second = envelopeOf(JSON.parse(JSON.stringify(next)), { id: 'fight-1' });
    const all = exchanges(settledNoteV1(whole)), one = exchanges(settledNoteV1(first)), two = exchanges(settledNoteV1(second));
    assert.match(two[0], /^Exchange 3:/u);
    assert.doesNotMatch(settledNoteV1(second), /Order:/u);
    const plain = list => list.map(part => part.replace(/(\w+ takes the Defence stance)( \| )?/gu, '').replace(/^(Exchange \d+: )\s*/u, '$1'));
    assert.deepEqual(plain([...one, ...two]), plain(all), 'the same exchange texts, but for the stance told again at the start of a new reply');
});

test('an edited Re-read: a grown or shrunk fight is told as exactly the exchanges it has', () => {
    for (const count of [1, 2, 5]) assert.equal(exchanges(settledNoteV1(played(quiet(), 'a', count))).length, played(quiet(), 'a', count).rounds.length);
    const short = played(quiet(), 'a', 2), long = played(quiet(), 'a', 5);
    assert.ok(exchanges(settledNoteV1(long)).length > exchanges(settledNoteV1(short)).length);
    assert.deepEqual(exchanges(settledNoteV1(long)).slice(0, 2), exchanges(settledNoteV1(short)).slice(0, 2), 'the first exchanges read the same when the fight grows');
});

test('names are one flat line cut to 40 code points, in every row and in the order line', () => {
    const long = '🐺'.repeat(50), cut = '🐺'.repeat(40), odd = 'Kira\n  Rose';
    const rename = envelope => JSON.parse(JSON.stringify(envelope).replaceAll('"Kira"', JSON.stringify(odd)).replaceAll('"Wolf"', JSON.stringify(long)));
    for (const envelope of [rename(win()), rename(fled())]) {
        const note = settledNoteV1(envelope);
        assert.ok(note.includes(cut + ' attacks Kira Rose: '), 'foe row: flattened hero, cut foe');
        assert.ok(note.includes('Kira Rose attacks ' + cut + ': '), 'hero row');
        assert.match(note, /Order: the (foes|party) [^|]*Kira Rose/u);
        assert.doesNotMatch(note.replaceAll(' | ', ''), /\n|  |🐺{41}/u);
    }
    assert.match(settledNoteV1(rename(fled())), /Kira Rose flees from 🐺{40} and gets away/u);
});

test('the wording the narrator reads: the order said once, who fled and who did not, who evaded, no system tags', () => {
    const note = settledNoteV1(fled()) + settledNoteV1(open()) + settledNoteV1(loss());
    assert.match(note, /Order: the (foes|party) .+; then the (party|foes) /u);
    assert.doesNotMatch(note, /act first|\(skill\)|\(tempo\)/u);
    assert.match(settledNoteV1(fled()), /Cy tries to flee from Wolf and fails \| Kira flees from Wolf and gets away; the whole party escapes/u);
    assert.match(note, /: \w[\w ]* evades/u);
    assert.match(note, /acts again/u);
});
