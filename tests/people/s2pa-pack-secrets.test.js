// S2PA (SOAK2PEOPLE B3): a pack's gated note never opened. The lines builder's STORY EVENTS list named it by the scan's short key (`s1`), which a
// `~ reveal` line does not take ("s1 is not one of their hidden notes"); it now names the note's own id, and the line opens it. The dossier's Secrets
// count also left the pack's gated notes out ("1/1 all opened" with 7 hidden): they are counted, locked "Opens when the story earns it". Shipped Ersveil
// pair, world events on. Replay == live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ersveilLines } from './helpers/ersveil-lines.js';
import { buildLinesContext } from '../../modules/people/core/core-prompts-lines.js';

const snap = s => JSON.stringify(s.people());

async function trusted(t) {
    t.mock.method(console, 'warn', () => {});
    const s = await ersveilLines({ features: { 'story-director.world-events': true } });
    await s.say('Rain at Bluewatch Village.', ['~ place Bluewatch Village', '+ present Sister Temiwa', '+ present Torka', '~ npc Sister Temiwa | trust: up | why: x']);
    for (let i = 0; i < 4; i += 1) await s.say('Temiwa smiles.', ['~ npc Sister Temiwa | trust: up | impact: extreme | why: Astra saved the infirmary']);
    return s;
}
const castRow = s => (s.host.sdk.query('npc.cast', {}) ?? []).find(row => row.name === 'Sister Temiwa');

test('the key the narrator is taught for a pack note opens it: STORY EVENTS names the note id, and `~ reveal` with it opens the note', async t => {
    const s = await trusted(t);
    try {
        const temiwa = s.person('Sister Temiwa');
        assert.ok(s.bonds()[temiwa.id].meters.trust >= 20, 'her first gate (trust 20) is open');
        const watch = s.adapter.eventWatch(Object.values(s.people().npcs).map(npc => ({ ...npc, present: true })));
        assert.equal(watch.length, 1);
        const text = buildLinesContext({ eventWatch: watch });
        const key = (text.match(/: (\S+) = Sister Temiwa: the secret "She asked for Bluewatch herself/) ?? [])[1];
        assert.equal(key, watch[0].note, 'the note\'s own id, not the scan\'s short key');
        assert.notEqual(key, 's1');
        const at = await s.say('Temiwa looks away. "I asked for Bluewatch myself," she says.', [`~ reveal Sister Temiwa | opened: ${key} | quote: "I asked for Bluewatch myself"`]);
        assert.deepEqual(s.bonds()[temiwa.id].unlocked, [key], s.host.turn.problems().map(item => item.message).join('\n'));
        const live = snap(s);
        s.host.store.rebuild();
        assert.equal(snap(s), live, 'rebuild');
        await s.swipe('Temiwa says nothing.', []);
        assert.deepEqual(s.bonds()[temiwa.id].unlocked, [], 'a swipe without the line');
        await s.host.st.swipeTo(at, 0);
        assert.equal(snap(s), live, 'swipe back');
    } finally { s.close(); }
});

test('the dossier counts the pack\'s gated notes: 7 hidden "Opens when the story earns it", then 1/7 opened with the story', async t => {
    const s = await trusted(t);
    try {
        const before = castRow(s);
        assert.equal(before.locked.length, 7, 'every pack note counted');
        assert.ok(before.locked.every(note => note.opens === 'Opens when the story earns it' && !('text' in note && /Bluewatch/.test(note.text))), 'no pack text');
        const key = before.locked[0].id;
        await s.say('Temiwa looks away. "I asked for Bluewatch myself," she says.', [`~ reveal Sister Temiwa | opened: ${key} | quote: "I asked for Bluewatch myself"`]);
        const after = castRow(s);
        assert.equal(after.locked.length, 6);
        assert.deepEqual(after.opened.map(note => [note.id, note.text]), [[key, 'Opened · with the story']]);
    } finally { s.close(); }
});
