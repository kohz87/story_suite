// S2PA (SOAK2PEOPLE B11, B12) on the shipped format 4 Ersveil pair. B12: someone the scene had who did not come along on a `~ place` move had no place
// afterwards (People › Elsewhere with no place, no Right now card): they now keep the place the scene moved away from (a broader stored place gives way to
// it; the same place or one inside it stays as written). B11: a pack person's `status` is what they were doing before the meeting ("Hunting in the
// Wildzone"); while it still is the pack's words it is not shown as Right now nor told to the narrator as their state. Replay == live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ersveilLines } from './helpers/ersveil-lines.js';
import { injectionEssentialBlock } from '../../modules/people/core/core-injection-parts-parts/essential-block.js';

const snap = s => JSON.stringify(s.people());
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const where = (s, name) => s.person(name)?.location ?? null;
const edit = async (s, at, lines) => { s.host.ctx.chat[at].mes = `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`; assert.equal((await s.host.sdk.reread(at)).ok, true); };
const T22 = ['~ place Bluewatch Village', '+ present Sister Temiwa', '+ present Ilka Sorn', '+ npc Ilka Sorn | the guild clerk | inky fingers', '~ npc Sister Temiwa | trust: up | why: a kind word'];

async function soak(t) {
    t.mock.method(console, 'warn', () => {});
    const s = await ersveilLines();
    await s.say('Rain at Bluewatch Village.', T22);
    return s;
}

test('B12: left behind by a move, a person keeps the place they were left at (Ilka at the village, Temiwa at the Guild office)', async t => {
    const s = await soak(t);
    try {
        await s.say('Temiwa walks with you to the Guild office.', ['~ place Bluewatch Village / Guild Office | with: Sister Temiwa']);
        assert.equal(where(s, 'Ilka Sorn'), 'Bluewatch Village', 'Ilka, left behind, where he was left');
        await s.say('You leave Temiwa arguing with the clerk.', ['~ place Bluewatch Village']);
        assert.equal(where(s, 'Sister Temiwa'), 'Bluewatch Village / Guild Office', 'Temiwa, left at the Guild office (her broader pack place gives way)');
        assert.equal(where(s, 'Ilka Sorn'), 'Bluewatch Village', 'kept');
        const rows = Object.fromEntries(s.host.sdk.query('people.list', {}).map(row => [row.name, row.location]));
        assert.equal(rows['Sister Temiwa'], 'Bluewatch Village / Guild Office');
        assert.equal(rows['Ilka Sorn'], 'Bluewatch Village');
        same(s, 'rebuild');
    } finally { s.close(); }
});

test('B12 replay == live: swipe, swipe back, an edited Re-read grown and shrunk, a middle delete', async t => {
    const s = await soak(t);
    try {
        const move = ['~ place Bluewatch Village / Guild Office | with: Sister Temiwa'];
        const at = await s.say('Temiwa walks with you to the Guild office.', move);
        const live = snap(s);
        await s.swipe('You stay by the well.', []);
        assert.equal(where(s, 'Ilka Sorn'), '', 'no move: Ilka is still here, no place written');
        await s.host.st.swipeTo(at, 0);
        assert.equal(snap(s), live, 'swipe back');
        await edit(s, at, [...move, '+ coin 2']);
        assert.equal(where(s, 'Ilka Sorn'), 'Bluewatch Village');
        await edit(s, at, ['+ coin 2']);
        assert.equal(where(s, 'Ilka Sorn'), '', 'shrunk: no move');
        await edit(s, at, move);
        assert.equal(snap(s), live, 'back to the first lines');
        await s.say('Quiet.', []);
        await s.say('Still quiet.', []);
        await s.host.st.deleteMessage(s.host.store.headIndex() - 2);
        same(s, 'a middle delete, then a rebuild');
        assert.equal(where(s, 'Ilka Sorn'), 'Bluewatch Village');
    } finally { s.close(); }
});

test('B11: a pack status is what they did before the meeting: not Right now while it is still the pack\'s words; a status the story writes shows', async t => {
    const s = await soak(t);
    try {
        await s.say('Torka drops a gutted elk in the yard.', ['+ present Torka', '~ npc Torka | trust: up | why: helped carry the kill']);
        const torka = s.person('Torka');
        assert.equal(torka.status, 'Hunting in the Wildzone north of Bluewatch.', 'stored as the pack wrote it');
        assert.equal(s.host.sdk.query('people.dossier', { name: 'Torka' }).status, undefined, 'not Right now');
        assert.equal(s.host.sdk.query('people.list', {}).find(row => row.name === 'Torka').status, null);
        assert.doesNotMatch(injectionEssentialBlock(torka), /status:/, 'not told to the narrator as her state');
        await s.say('Torka argues at the bier.', ['~ npc Torka | status: arguing at the bier']);
        assert.equal(s.host.sdk.query('people.dossier', { name: 'Torka' }).status, 'arguing at the bier');
        assert.match(injectionEssentialBlock(s.person('Torka')), /status: arguing at the bier/);
        same(s, 'rebuild');
    } finally { s.close(); }
});
