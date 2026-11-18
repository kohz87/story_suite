// LF4-1 re-check (LIVEF4, run on drop 3): a pack person the narrator brought in with `+ npc Name | role | look` got a plain NPC State record and the
// pack entry was never applied. The live shapes, on the shipped format 4 Ersveil pair: Edda Rorke (live T2, after T1's meeting was taken back), the isolation run's
// Sister Temiwa, and Guildmaster Laan and Emperor Adalmar by the short names the narrator wrote (each with the `+ present` the live replies had).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ersveilLines } from './helpers/ersveil-lines.js';

const quiet = t => t.mock.method(console, 'warn', () => {});
const fromPack = (s, name, key, like) => {
    const found = Object.values(s.people().npcs).filter(npc => npc?.castFrom?.key === key);
    assert.equal(found.length, 1, `${name}: one dossier from the pack`);
    assert.equal(Object.values(s.people().npcs).filter(npc => npc !== found[0] && like.test(npc.name)).length, 0, `${name}: no plain double`);
    return found[0];
};

test('LF4-1: + npc for a pack person (Edda Rorke, Sister Temiwa, Hendrikje Laan, Emperor Adalmar) applies the pack entry; the pack look wins; gated secrets are seeded hidden', async t => {
    quiet(t);
    const s = await ersveilLines({ features: { 'story-director.world-events': true } });   // (a pack's gated secrets are seeded with world events on)
    try {
        await s.say('Rain at the guild office.', ['~ place Bluewatch Village / Guild Office']);
        await s.say('A watch-captain strides in.', ['+ present Edda Rorke', '+ npc Edda Rorke | the watch-captain | tall spare woman of forty-eight, greying hair pinned back, breastplate, bad knee', '~ npc Edda Rorke | gender: female']);
        const edda = fromPack(s, 'Edda', 'ersveil:edda-rorke', /Edda|Rorke/);
        assert.match(edda.overallAppearance ?? '', /^Tired human woman of about forty-eight/, 'the pack look, not the narrator\'s');
        assert.doesNotMatch(JSON.stringify(edda), /tall spare woman/, 'the line\'s own look is not used');
        assert.equal(edda.role, 'Bluewatch\'s Watch-Captain');
        assert.ok(edda.secrets?.length > 0 && edda.secrets.every(secret => secret.gate && !secret.revealed), 'her pack secret is seeded, behind its gate');
        await s.say('The infirmary.', ['- present Edda Rorke', '+ present Sister Temiwa', '+ npc Sister Temiwa | the infirmary sister | sturdy woman of forty, braided dark hair under grey veil', '~ npc Sister Temiwa | trust: up | why: you hauled water']);
        const temiwa = fromPack(s, 'Temiwa', 'ersveil:temiwa', /Temiwa/);
        assert.equal(temiwa.species, 'dogfolk', 'the pack\'s dogfolk, not the narrator\'s human');
        assert.ok(temiwa.level > 0 && temiwa.abilities.length > 0 && temiwa.keepsakes.length > 0 && temiwa.homeBase, 'Level, abilities, keepsakes, home');
        assert.ok(s.bonds()[temiwa.id].meters.trust > 0, 'the trust line landed on her');
        await s.say('Days later, Auvoth.', ['- present Sister Temiwa', '~ place Auvoth / Guild Grand Hall', '+ present Hendrikje Laan', '+ npc Hendrikje Laan | the Guildmaster']);
        fromPack(s, 'Laan', 'ersveil:laan', /Laan|Hendrikje/);
        await s.say('The Crown Keep.', ['- present Hendrikje Laan', '~ place Highmark Capital / Crown Keep', '+ present Emperor Adalmar', '+ npc Emperor Adalmar | Highmark sovereign']);
        const adalmar = fromPack(s, 'Adalmar', 'ersveil:adalmar', /Adalmar/);
        assert.ok(adalmar.secrets?.some(secret => secret.packId === 'the-forgery' && secret.gate && !secret.revealed), 'the forgery is seeded, behind its gate');
        const live = JSON.stringify(s.people());
        s.host.store.rebuild();
        assert.equal(JSON.stringify(s.people()), live, 'rebuild == live');
    } finally { s.close(); }
});

// The one combined case (LACA2): a new chat at Bluewatch, the cast's meeting brings in Edda Rorke and its cue gives her name (LF4-2), the narrator
// writes her by it (`+ present`, `+ npc` with its own look) → the meeting stands, one dossier, the pack profile applied, no double. Replay == live.
test('LF4-1 + LF4-2: at Bluewatch the cue names Edda Rorke, the narrator uses the name, the meeting stands; one record from the pack, no double', async t => {
    quiet(t);
    const s = await ersveilLines();
    try {
        await s.host.st.loadChat([{ name: 'Narrator', is_user: false, is_system: false, mes: 'You arrive at the guild office.' }], 'lf4');
        await s.say('A tired watch-captain looks up. "Edda Rorke," she says.', ['+ present Edda Rorke', '+ npc Edda Rorke | the watch-captain | tall spare woman of forty-eight, breastplate']);
        const told = s.host.st.promptLog.map(entry => String(entry.value ?? '')).join('\n').split('\n').filter(line => line.startsWith('[Cast]'));
        assert.ok(told.some(line => /their name is Watch-Captain Edda Rorke\./.test(line)), `the cue gives her name: ${told.join(' / ')}`);
        const met = () => s.host.head().domains.cast.people['ersveil:edda-rorke']?.met;
        assert.ok(met(), 'the meeting stands (not taken back)');
        assert.doesNotMatch(s.host.sdk.receipts().map(entry => entry.receipt.summary ?? '').join('\n'), /meeting is taken back/);
        const edda = fromPack(s, 'Edda', 'ersveil:edda-rorke', /Edda|Rorke|watch-captain/i);
        assert.match(edda.overallAppearance ?? '', /^Tired human woman of about forty-eight/, 'the pack look wins');
        await s.swipe('A tired watch-captain looks up. "Edda Rorke," she says, again.', ['+ present Edda Rorke', '+ npc Edda Rorke | the watch-captain | tall spare woman']);
        assert.ok(met(), 'a swipe meets her again');
        fromPack(s, 'Edda', 'ersveil:edda-rorke', /Edda|Rorke|watch-captain/i);
        await s.say('She limps off.', ['- present Edda Rorke']);
        const live = JSON.stringify([s.people(), s.host.head().domains.cast]);
        s.host.store.rebuild();
        assert.equal(JSON.stringify([s.people(), s.host.head().domains.cast]), live, 'rebuild == live');
    } finally { s.close(); }
});

// The two paths the cue's new wording leads to: the narrator keeps the name out of the prose (only the lines carry it), and a `+ npc` for someone the
// [People here] line named who is not in the scene (no `+ present`): both make the one dossier from the pack.
test('LF4-1: the name only in the lines still meets her; a + npc off-scene (no + present) by full name or alias is made from the pack, a role is not', async t => {
    quiet(t);
    const s = await ersveilLines({ features: { 'story-director.world-events': true } });
    try {
        await s.host.st.loadChat([{ name: 'Narrator', is_user: false, is_system: false, mes: 'You arrive at the guild office.' }], 'lf4b');
        await s.say('A tired woman in a blue coat looks up from the ledger.', ['+ present Edda Rorke', '+ npc Edda Rorke | the watch-captain | tall']);
        assert.ok(s.host.head().domains.cast.people['ersveil:edda-rorke']?.met, 'the meeting stands with the name only in the lines');
        fromPack(s, 'Edda', 'ersveil:edda-rorke', /Edda|Rorke/);
        await s.say('The clerk mentions the healer.', ['- present Edda Rorke', '+ npc Sister Temiwa | the infirmary sister | sturdy, human']);
        const temiwa = fromPack(s, 'Temiwa', 'ersveil:temiwa', /Temiwa/);
        assert.equal(temiwa.species, 'dogfolk', 'the pack entry, though she is not in the scene');
        assert.equal(s.host.head().domains.cast.people['ersveil:temiwa'].met, null, 'not met by being mentioned');
        await s.say('She walks in.', ['+ present Sister Temiwa', '~ npc Sister Temiwa | trust: up | why: kind']);
        await s.say('Later.', ['- present Sister Temiwa']);
        fromPack(s, 'Temiwa', 'ersveil:temiwa', /Temiwa/);
        assert.ok(s.bonds()[temiwa.id].meters.trust > 0, 'the later line lands on the same dossier');
        await s.say('Talk of the Keep.', ['+ npc Adalmar | the old emperor']);
        assert.ok(fromPack(s, 'Adalmar', 'ersveil:adalmar', /Adalmar/).secrets?.some(secret => secret.packId === 'the-forgery' && !secret.revealed), 'by an alias, off-scene: from the pack');
        await s.say('A berserker is talked of.', ['+ npc the frontier berserker | a berserker | big']);
        assert.equal(Object.values(s.people().npcs).filter(npc => npc?.castFrom?.key === 'ersveil:torka').length, 0, 'a role is not a name: no pack dossier from it');
        const live = JSON.stringify([s.people(), s.host.head().domains.cast]);
        s.host.store.rebuild();
        assert.equal(JSON.stringify([s.people(), s.host.head().domains.cast]), live, 'rebuild == live');
    } finally { s.close(); }
});
