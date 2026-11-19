// NPCPRESENT (owner 19 Nov, live play on drop 20): the reply that brings in Bina Kelm and Watch-Captain Edda Rorke with `+ present` and no `+ npc` line left
// no NPC State record for either. Now, in the reply's own step: (a) a pack person marked present the first time gets their dossier from the pack; (b) a new named
// person marked present gets a record with only their name, which the targeted fill-in completes from the story. Real Story Director, the Ersveil pair, lines mode.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ersveilLines } from './helpers/ersveil-lines.js';
import { newStubs } from '../../modules/people/adapter/stub-fills.js';

const quiet = t => t.mock.method(console, 'warn', () => {});
// The owner's reply's Changes block, line for line.
const OWNER = [
    '+ coin 3 silver | from: Marrit',
    '~ time 8:45 am',
    '~ you rank: Unregistered | outfit: Linen clothes, traveling robe, black linen headband | condition: Split palms, river-damp',
    '+ present Bina Kelm',
    '+ present Watch-Captain Edda Rorke',
    '+ faction Red Cords — Armed extortionists wearing red belt cords shaking down merchants and newcomers | area: Bluewatch Village | stance: indifferent',
    '+ faction Grey Ledger — Confederacy debt-collectors and bond-hunters watching the quay from the Stray Oar | area: Bluewatch Village | stance: indifferent',
    '+ hook Culling contracts — Stack of frontier beast-culling jobs and a fresh runner-beast bounty waiting on the Bluewatch Guild board | giver: Bina Kelm | goal: Register with the Guild and take a culling contract',
    '~ chatter Bina Kelm: Five honest silvers before noon is a miracle, assuming the Watch-Captain doesn\'t scare him back onto the barge before he signs.',
    '~ chatter Watch-Captain Edda Rorke: Wiry build, steady on his feet, and carrying two sticks with no limp. Either a street knife from Thousand Sails or a debtor dodging the Grey Ledger.',
    '? choice Give Bina your name and answer Rorke plainly',
    '? choice Ask Bina about the culling contracts before answering Rorke',
    '? choice Deflect Rorke\'s question and sign the Guild ledger first',
    '? choice Ask Rorke about the runners sighted near the north timber line',
];
const PROSE = 'Behind the counter sat a petite woman in her late twenties with a pale, tired face and dark hair twisted up with a bone pin, in a coarse brown wool dress. '
    + '"Bina Kelm, branch clerk." The door swung in: a woman of about forty-eight, iron-grey hair, a stiff right knee, a leather brigandine and a ring of keys. '
    + '"Watch-Captain Edda Rorke, you already owe half these people copper," Bina shot back.';
const GREETING = [{ name: 'Narrator', is_user: false, is_system: false, mes: 'The Kettle Wife comes out of the mist at Bluewatch.' }];
const all = s => Object.values(s.people().npcs ?? {});
const snap = s => JSON.stringify(s.people());
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const arrived = s => s.host.sdk.receipts().filter(entry => entry.receipt.type === 'npc.arrive').map(entry => entry.receipt);
const stepProblems = s => s.host.turn.problems().filter(item => /npc\.arrive|after the reply's lines/.test(item.message));

test('the owner\'s reply: Edda Rorke gets her dossier from the pack, Bina Kelm a record with her name that the fill-in completes; one each', async t => {
    quiet(t);
    const s = await ersveilLines();
    try {
        await s.host.st.loadChat(GREETING, 'npcpresent');
        const at = await s.say(PROSE, OWNER);
        const edda = all(s).filter(npc => npc?.castFrom?.key === 'ersveil:edda-rorke');
        assert.equal(edda.length, 1, 'one dossier for Edda, from the pack');
        assert.match(edda[0].overallAppearance ?? '', /^Tired human woman of about forty-eight/, 'the pack look');
        assert.equal(edda[0].role, 'Bluewatch\'s Watch-Captain');
        assert.ok(s.bonds()[edda[0].id], 'her first meter entry');
        assert.equal(edda[0].createdAt, at + 1, 'stamped with the reply that made it');
        const bina = all(s).filter(npc => npc?.name === 'Bina Kelm');
        assert.equal(bina.length, 1, 'one record for Bina');
        assert.equal(bina[0].castFrom ?? null, null, 'Bina is nobody from the pack');
        assert.equal(bina[0].role, '', 'nothing invented: no role');
        assert.equal(bina[0].appearance, '', 'nothing invented: no look');
        assert.equal(bina[0].createdAt, at + 1, 'stamped with the reply, as a + npc stub is');
        assert.deepEqual(newStubs(all(s), at).map(stub => stub.name), ['Bina Kelm'], 'the targeted fill-in finds her (and not the pack dossier)');
        assert.equal(all(s).length, 2, 'nobody else (no faction, no hook, no chatter name)');
        assert.equal(arrived(s).length, 1, 'one step after the reply\'s lines');
        assert.deepEqual(stepProblems(s), [], 'no Problem from the step');
        same(s, 'rebuild == live');
    } finally { s.close(); }
});

test('a pack person not met by the cast, brought in by + present alone, gets the pack dossier; a hook giver from the pack too', async t => {
    quiet(t);
    const s = await ersveilLines();
    try {
        await s.say('Rain at Bluewatch Village.', ['~ place Bluewatch Village']);
        await s.say('A dogfolk sister ducks in out of the rain. "Temiwa," she says.', ['+ present Sister Temiwa']);
        const temiwa = all(s).filter(npc => npc?.castFrom?.key === 'ersveil:temiwa');
        assert.equal(temiwa.length, 1);
        assert.equal(temiwa[0].species, 'dogfolk');
        assert.ok(temiwa[0].level > 0 && temiwa[0].abilities.length > 0, 'Level and abilities from the pack');
        await s.say('A notice from the Watch.', ['+ hook Torka\'s hunt — the berserker wants a second blade | giver: Torka | goal: hunt with Torka']);
        assert.equal(all(s).filter(npc => npc?.castFrom?.key === 'ersveil:torka').length, 1, 'the giver by her pack name');
        same(s, 'rebuild == live');
    } finally { s.close(); }
});

test('nobody twice and no role made a person: a same-reply + npc keeps its role and look; titles, groups and short names make nobody', async t => {
    quiet(t);
    const s = await ersveilLines();
    try {
        await s.say('Rain at Bluewatch Village.', ['~ place Bluewatch Village']);
        await s.say('Ilse Varn wipes the bar.', ['+ present Ilse Varn', '+ npc Ilse Varn | the barmaid | freckled, red apron']);
        const ilse = all(s).filter(npc => npc?.name === 'Ilse Varn');
        assert.equal(ilse.length, 1);
        assert.equal(ilse[0].role, 'the barmaid', 'the + npc line\'s role stands');
        await s.say('Clerks and guards.', ['+ faction Red Cords — extortionists | area: Bluewatch Village', '+ present clerk', '+ present the guard', '+ present Red Cord thugs', '+ present Red Cord Enforcers', '+ present Guard', '+ present Tired Clerk', '+ present Two Watchmen', '+ present Ilse', '+ present {{user}}']);
        assert.equal(all(s).length, 1, 'no record for a title, a group, a faction\'s people, a role, a short name of Ilse or the player');
        await s.say('Five arrive.', ['+ present Anna Holt', '+ present Bram Holt', '+ present Cal Holt', '+ present Dena Holt', '+ present Emil Holt']);
        assert.equal(all(s).length, 5, 'four new people a reply');
        assert.deepEqual(stepProblems(s), []);
    } finally { s.close(); }
    const m = await ersveilLines({ settings: { admissionMode: 'manual_only' } });
    try {
        await m.say('Rain.', ['~ place Bluewatch Village', '+ present Bina Kelm']);
        assert.equal(all(m).length, 0, 'Manual only: nobody from a story line');
    } finally { m.close(); }
});

test('replay == live: swipe, swipe back, an edited Re-read grown and shrunk, a middle delete, a reload', async t => {
    quiet(t);
    const s = await ersveilLines();
    try {
        await s.host.st.loadChat(GREETING, 'npcpresent-replay');
        const at = await s.say(PROSE, OWNER);
        const live = snap(s);
        await s.swipe('Only rain.', []);
        assert.equal(all(s).some(npc => npc?.name === 'Bina Kelm'), false, 'a swipe without the line makes no Bina');
        await s.host.st.swipeTo(at, 0);
        assert.equal(snap(s), live, 'swipe back');
        const edit = async lines => { s.host.ctx.chat[at].mes = `${PROSE}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`; assert.equal((await s.host.sdk.reread(at)).ok, true); };
        await edit(OWNER.filter(line => !line.includes('Bina Kelm')));
        assert.equal(all(s).some(npc => npc?.name === 'Bina Kelm'), false, 'shrunk: no Bina');
        await edit([...OWNER, '+ present Hollis Marr']);
        assert.ok(all(s).some(npc => npc?.name === 'Hollis Marr'), 'grown: the new name too');
        await edit(OWNER);
        assert.equal(snap(s), live, 'the Re-read back to the owner\'s lines');
        await s.say('The ledger fills.', ['~ npc Bina Kelm | trust: up | why: five honest silvers']);
        await s.say('Night.', []);
        same(s, 'rebuild after more replies');
        assert.ok(s.bonds()[all(s).find(npc => npc?.name === 'Bina Kelm').id].meters.trust > 0, 'a later line lands on her record');
        await s.host.st.deleteMessage(s.host.store.headIndex() - 2);
        same(s, 'a middle delete, then a rebuild');
        const kept = snap(s);
        await s.host.st.loadChat(s.host.ctx.chat, s.host.ctx.chatId);
        await s.adapter.settled();
        assert.equal(snap(s), kept, 'a reload');
    } finally { s.close(); }
});
