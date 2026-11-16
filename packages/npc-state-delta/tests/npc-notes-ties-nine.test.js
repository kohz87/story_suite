// The nine tie tags (parse-only, untaught): each parses and drops, canonical order, families, one-way tags, the unchanged relation-text
// mapping, tone and type reads, the unchanged `~ tie` grammar line, and live == replay through the host (swipe, Re-read, edited Re-read).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TIE_TAGS, TIE_FAMILIES, ONE_WAY_TAGS, applyTags, readTies, tiesText, tagsFromRelation } from '../src/npc-notes-ties.js';
import { foldTies } from '../src/npc-notes-kinds.js';
import { TIE_TYPE_LABELS, TIE_TYPE_RANK, tieType } from '../core-keyrel.js';
import { noteKinds } from '../src/npc-notes-kinds-parts/grammar.js';
import { tieTone } from '../dossier-ui-bond-tone.js';
import { suite } from './helpers/pacing-suite.js';
import { validateNpcSlice } from '../src/npc-meters.js';
import { ON, oren, shape } from './npc-notes-kinds.helpers.js';

const NINE = ['kin', 'partner', 'friend', 'ally', 'mentor', 'serves', 'rival', 'enemy', 'owes'];
const tie = (ties, tags) => applyTags(ties, { self: 'Mira', with: 'Astra', tags });

test('the nine tags, in fold order, keep ally < rival < owes as before', () => {
    assert.deepEqual(TIE_TAGS, NINE);
    assert.deepEqual(TIE_FAMILIES, { ally: ['kin', 'partner', 'friend', 'ally'], hostile: ['rival', 'enemy'], none: ['mentor', 'serves', 'owes'] });
    assert.deepEqual([...TIE_FAMILIES.ally, ...TIE_FAMILIES.hostile, ...TIE_FAMILIES.none].sort(), [...NINE].sort());
    assert.deepEqual(ONE_WAY_TAGS, ['mentor', 'serves', 'owes']);
});

test('each tag parses with + and drops with -; friend stays friend; unsorted input is stored in order', () => {
    for (const tag of NINE) {
        const added = tie(null, [`+${tag}`]);
        assert.deepEqual(added.ties, { astra: [tag] }, tag);
        assert.equal(added.changed, true);
        assert.deepEqual(added.ignored, []);
        const dropped = tie(added.ties, [`-${tag}`]);
        assert.deepEqual(dropped.ties, {}, tag);
    }
    assert.deepEqual(tie(null, ['+enemy', '+kin', '+owes', '+friend', '+mentor']).ties, { astra: ['kin', 'friend', 'mentor', 'enemy', 'owes'] });
    assert.deepEqual(tie(null, ['+buddy', '+kin']).ignored, ['+buddy']);
    assert.deepEqual(tie({ astra: ['ally', 'kin'] }, ['+kin']).changed, false, 're-applying is a no-op');
});

test('stored text: a tie with an old tag still reads, and every new tag reads back', () => {
    assert.deepEqual(readTies('{"astra":["ally","rival","owes"]}'), { astra: ['ally', 'rival', 'owes'] });
    assert.deepEqual(readTies('{"astra":["kin","partner","friend","ally","mentor","serves","rival","enemy","owes"]}').astra, NINE);
    assert.equal(readTies('{"astra":["owes","kin"]}'), null, 'out of order is still refused');
    assert.equal(tiesText({ astra: ['kin', 'serves'] }), '{"astra":["kin","serves"]}');
});

test('foldTies joins aliases in the nine-tag order and keeps the old three', () => {
    assert.deepEqual(foldTies({ astra: ['owes'], ast: ['kin', 'ally'] }, { ast: 'astra' }), { astra: ['kin', 'ally', 'owes'] });
    assert.deepEqual(foldTies({ astra: ['ally', 'rival', 'owes'] }), { astra: ['ally', 'rival', 'owes'] });
});

test('relation text maps as before: partner, kin and mentor words give ally or nothing, never a new tag', () => {
    assert.deepEqual(tagsFromRelation('partner'), ['ally']);
    assert.deepEqual(tagsFromRelation('friend'), ['ally']);
    assert.deepEqual(tagsFromRelation('ally'), ['ally']);
    assert.deepEqual(tagsFromRelation('enemy'), ['rival']);
    assert.deepEqual(tagsFromRelation('sister'), []);
    assert.deepEqual(tagsFromRelation('mentor'), []);
    assert.equal(tieType('partner'), 'ally');
    assert.equal(tieType('older sister'), 'ally');
    assert.equal(tieType('mentor'), 'ally');
    assert.equal(tieType('stranger', ['kin']), 'kin');
    assert.equal(tieType('stranger', ['mentor', 'enemy']), 'enemy');
    assert.equal(tieType('stranger', ['kin', 'enemy']), 'enemy');
    assert.equal(tieType('stranger', ['ally', 'rival']), 'ally', 'old-only lists pick as on main');
    assert.equal(tieType('stranger', ['rival', 'owes']), 'owes');
    assert.equal(tieType('stranger', ['ally', 'rival', 'owes']), 'owes');
    assert.equal(tieType('stranger', ['kin', 'rival']), 'rival');
    assert.equal(tieType('stranger', ['kin', 'owes']), 'owes');
    assert.equal(tieType('stranger', ['kin', 'mentor']), 'kin');
    assert.equal(tieType('friend', ['ally', 'owes']), 'owes');
});

test('tie types and tones: a label and top rank for each tag; hostile, duty and close tones', () => {
    for (const tag of NINE) { assert.ok(TIE_TYPE_LABELS[tag], tag); assert.equal(TIE_TYPE_RANK[tag], 0, tag); }
    assert.equal(TIE_TYPE_RANK.interest, 1);
    assert.equal(tieTone(['enemy']), 'hostile');
    assert.equal(tieTone(['kin', 'rival']), 'hostile');
    assert.equal(tieTone(['serves']), 'duty');
    assert.equal(tieTone(['kin']), 'close');
    assert.equal(tieTone(['mentor']), 'close');
    assert.equal(tieTone([]), null);
});

test('the model-visible `~ tie` grammar line is unchanged (the teaching line ships later)', () => {
    assert.equal(noteKinds(null).tie.grammar, '~ tie Name | with: Other | tag: +ally, +rival or +owes (-tag drops it; write it when two people ally, rival or owe; e.g. ~ tie Person A | with: Person B | tag: +owes)');
});

test('host: new tags apply once and replay equals live (swipe, Re-read, edited Re-read, middle delete, reload)', async () => {
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ tie Oren | with: Sister Temiwa | tag: +kin, +serves']);
    assert.deepEqual(Object.values(JSON.parse(oren(s).ties)), [['kin', 'serves']]);
    const middle = await s.say(['~ tie Oren | with: Sister Temiwa | tag: +enemy, -kin']);
    assert.deepEqual(Object.values(JSON.parse(oren(s).ties)), [['serves', 'enemy']]);
    await s.swipe(['~ tie Oren | with: Sister Temiwa | tag: +mentor']);
    assert.deepEqual(Object.values(JSON.parse(oren(s).ties)), [['kin', 'mentor', 'serves']]);
    const index = await s.say(['~ tie Oren | with: Sister Temiwa | tag: +partner, +friend']);
    const once = shape(s);
    assert.equal((await s.host.sdk.reread(index)).ok, true);
    assert.equal(shape(s), once, 'a Re-read applies once');
    s.host.ctx.chat[index].mes = s.host.ctx.chat[index].mes.replace('+partner, +friend', '+rival');
    assert.equal((await s.host.sdk.reread(index)).ok, true);
    let live = shape(s);
    assert.deepEqual(Object.values(JSON.parse(oren(s).ties)), [['kin', 'mentor', 'serves', 'rival']]);
    s.host.store.rebuild();
    assert.equal(shape(s), live, 'rebuild equals live');
    await s.host.st.loadChat(s.host.ctx.chat);
    await s.adapter.ticked();
    assert.equal(shape(s), live, 'a cold reload equals live');
    await s.host.st.deleteMessage(middle);
    live = shape(s);
    s.host.store.rebuild();
    assert.equal(shape(s), live, 'rebuild equals live after the delete');
    assert.deepEqual(s.host.store.problems(), []);
    assert.deepEqual(validateNpcSlice(s.host.head().domains.npc), []);
});
