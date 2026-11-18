// S2PA (SOAK2PEOPLE B1, B2) on the shipped format 4 Ersveil pair, real Story Director, NPC State in lines mode. B1: SFF4 made a `~ npc` line about a pack
// person met or present here make their dossier from the pack; `~ memory`, `~ reveal` and a tie's `with:` still refused "has no record yet". B2: `+ npc Rika`
// for the pack's Rika (present) made a thin stub (no species, home, abilities, keepsakes) that the pack never filled. Replay == live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ersveilLines } from './helpers/ersveil-lines.js';

const refused = s => s.host.turn.problems().filter(item => /has no record yet/.test(item.message)).map(item => item.message);
const snap = s => JSON.stringify(s.people());
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const edit = async (s, at, lines) => { s.host.ctx.chat[at].mes = `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`; assert.equal((await s.host.sdk.reread(at)).ok, true); };
const quiet = t => t.mock.method(console, 'warn', () => {});

test('B1: `~ memory`, a tie\'s `with:` and `~ reveal` about a pack person present here make their dossier from the pack, then apply', async t => {
    quiet(t);
    const s = await ersveilLines();
    try {
        await s.say('Rain at Bluewatch Village.', ['~ place Bluewatch Village']);
        await s.say('Torka laughs at the careful stitches of Sister Temiwa.', ['+ present Torka', '+ present Sister Temiwa', '~ memory Torka | Torka laughed at the careful stitches.', '~ tie Sister Temiwa | with: Torka | tag: +friend']);
        assert.deepEqual(refused(s), []);
        assert.equal(s.person('Torka')?.castFrom?.key, 'ersveil:torka', 'Torka from the pack');
        assert.equal(s.person('Torka').species, 'orc');
        assert.deepEqual(s.person('Torka').memories, ['Torka laughed at the careful stitches.']);
        assert.equal(s.person('Sister Temiwa')?.castFrom?.key, 'ersveil:temiwa');
        assert.ok(s.bonds()[s.person('Torka').id], 'Torka\'s first meter entry');
        same(s, 'rebuild');
    } finally { s.close(); }
    const w = await ersveilLines({ features: { 'story-director.world-events': true } });
    try {
        await w.say('Rain at Bluewatch Village.', ['~ place Bluewatch Village']);
        await w.say('Sister Temiwa says, "I asked for Bluewatch myself."', ['+ present Sister Temiwa', '~ reveal Sister Temiwa | opened: sec_none | quote: "I asked for Bluewatch myself"']);
        // She is found (her dossier is made from the pack in the line's step); the line is then refused for its note, which rolls the line back whole.
        assert.deepEqual(refused(w), [], 'not "has no record yet"');
        assert.match(w.host.turn.problems().map(item => item.message).join('\n'), /~ reveal Sister Temiwa: sec_none is not one of their hidden notes/);
    } finally { w.close(); }
});

test('B2: `+ npc Rika | …` for the pack\'s Rika (present) makes her dossier from the pack, not a thin stub; the next line lands on it', async t => {
    quiet(t);
    const s = await ersveilLines();
    try {
        await s.say('Rain at Bluewatch Village.', ['~ place Bluewatch Village']);
        await s.say('Rika signs the Guild ledger with a flourish.', ['+ present Rika', '+ npc Rika | the young mage | small, quick, ink on her fingers', '~ npc Rika | trust: up | why: she liked the joke']);
        const rika = s.person('Rika');
        assert.equal(rika?.castFrom?.key, 'ersveil:rika', 'the pack\'s Rika');
        assert.equal(rika.role, 'unlicensed hedge-mage', 'the pack\'s role, not the line\'s');
        assert.equal(rika.species, 'human');
        assert.ok(rika.homeBase);
        assert.ok(rika.abilities.length > 0 && rika.keepsakes.length > 0);
        assert.equal(Object.values(s.people().npcs).filter(npc => npc.name === 'Rika').length, 1, 'one Rika');
        assert.ok(s.bonds()[rika.id].meters.trust > 0, 'the trust line landed on her');
        same(s, 'rebuild');
    } finally { s.close(); }
});

test('replay == live: swipe, swipe back, an edited Re-read grown and shrunk, a middle delete and a rebuild', async t => {
    quiet(t);
    const s = await ersveilLines();
    try {
        await s.say('Rain at Bluewatch Village.', ['~ place Bluewatch Village']);
        const lines = ['+ present Rika', '+ npc Rika | the young mage | small', '+ present Torka', '~ memory Torka | Torka laughed at Rika.'];
        const at = await s.say('Rika and Torka at the yard.', lines);
        const live = snap(s);
        same(s, 'rebuild');
        await s.swipe('Only rain.', []);
        assert.equal(s.person('Rika'), undefined, 'a swipe without the lines makes no one');
        await s.host.st.swipeTo(at, 0);
        assert.equal(snap(s), live, 'swipe back');
        await edit(s, at, [...lines, '~ tie Rika | with: Torka | tag: +friend']);
        assert.equal(s.person('Rika').castFrom?.key, 'ersveil:rika');
        await edit(s, at, ['+ present Torka', '~ memory Torka | Torka laughed at Rika.']);
        assert.equal(s.person('Rika'), undefined, 'shrunk: no Rika');
        assert.deepEqual(s.person('Torka').memories, ['Torka laughed at Rika.']);
        await edit(s, at, lines);
        assert.equal(snap(s), live, 'the Re-read back to the first lines');
        await s.say('The rain goes on.', ['~ npc Rika | trust: up | why: shared a cloak']);
        await s.say('Night.', []);
        same(s, 'rebuild after more replies');
        await s.host.st.deleteMessage(s.host.store.headIndex() - 2);
        same(s, 'a middle delete, then a rebuild');
        assert.equal(s.person('Rika').castFrom?.key, 'ersveil:rika');
    } finally { s.close(); }
});
