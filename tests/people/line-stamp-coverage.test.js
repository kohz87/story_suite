// DOSSFIX2 N2: every field a line writes moves the dossier's last change, not only the tracked ones: gender, level, learns (abilities), keepsake (keepsakes),
// aka (aliases) and a `~ know` line (knows) are stamped under the record key they write, and the runtime's normalizer keeps those stamps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suite, dossiers } from './helpers/pacing-suite.js';
import { normalizeNpcRecord } from '../../modules/people/core/core.js';
import { selectDossier } from '../../ui/select/dossier.js';

const people = s => s.host.head().domains.people;
const oren = s => people(s).npcs.npc_oren ?? {};
const snap = s => JSON.stringify(s.host.head().domains);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };
const lastReply = s => selectDossier({ dossier: s.host.sdk.query('people.dossier', { id: 'npc_oren' }), meters: s.npc('Oren') }).lastReply;
const scanned = () => { const records = dossiers(); records.npc_oren.fieldChangeMessages = { mood: 0 }; return records; };

const LINES = [
    ['~ npc Oren | gender: male', 'gender'],
    ['~ npc Oren | level: 4', 'level'],
    ['~ npc Oren | learns: Lockpicking — opens doors', 'abilities'],
    ['~ npc Oren | keepsake: + Brass key — his mother\'s', 'keepsakes'],
    ['~ npc Oren | aka: the Gatekeeper', 'aliases'],
    ['~ know Oren | about: Sister Temiwa | fact: is ill | how: saw', 'knows'],
];

test('gender, level, learns, keepsake, aka and ~ know lines each move the dossier\'s last change, stamped under the key they write', async () => {
    const s = await suite({ lines: true, records: scanned(), levelOn: true });
    for (const [line, key] of LINES) {
        const at = await quiet(() => s.say([line]));
        assert.equal(oren(s).fieldChangeMessages[key], at, `${line} stamps ${key}`);
        assert.equal(lastReply(s), at, `${line} moves the last change`);
    }
    same(s, 'replay equals live');
    // A line that changes nothing (the same alias again, a lower level) stamps nothing.
    const stamps = structuredClone(oren(s).fieldChangeMessages);
    await quiet(() => s.say(['~ npc Oren | aka: the Gatekeeper', '~ npc Oren | level: 2']));
    assert.deepEqual(oren(s).fieldChangeMessages, stamps);
});

test('a middle delete of a stamping reply, a swipe and a reload equal live', async () => {
    const s = await suite({ lines: true, records: scanned() });
    const know = await quiet(() => s.say(['~ know Oren | about: Sister Temiwa | fact: is ill | how: saw']));
    const aka = await s.say(['~ npc Oren | aka: the Gatekeeper | gender: male']);
    assert.equal(lastReply(s), aka);
    await s.swipe(['~ npc Oren | aka: the Warden']);
    assert.ok(oren(s).aliases.includes('the Warden'));
    same(s, 'swipe replay equals live');
    await quiet(async () => { await s.host.st.deleteMessage(know); await s.host.st.deleteMessage(know - 1); });
    assert.deepEqual(s.host.store.problems?.() ?? [], []);
    assert.equal(oren(s).fieldChangeMessages.knows, undefined, 'the deleted reply\'s stamp is gone');
    assert.equal(oren(s).fieldChangeMessages.aliases, aka, 'the later stamp stays (stamps keep the index they were written at)');
    same(s, 'middle delete replay equals live');
    const head = snap(s);
    await s.host.turn.onChatChanged();
    assert.equal(snap(s), head, 'reload equals live');
});

test('the normalizer keeps the line-only stamps (no turn count for them), and people.stamp is a module\'s only', async () => {
    const record = normalizeNpcRecord({ id: 'npc_x', name: 'X', fieldChangeMessages: { goal: 3, knows: 5, aliases: 7, nonsense: 9 }, fieldChanges: { goal: 1 } });
    assert.deepEqual(record.fieldChangeMessages, { goal: 3, aliases: 7, knows: 5 });
    assert.equal(record.fieldChanges.knows, undefined);
    const s = await suite({ lines: true, records: scanned() });
    await s.say([]);
    const out = await s.host.sdk.command('people.stamp', { id: 'npc_oren', fields: ['knows'] });
    assert.equal(out.ok, false);
    assert.equal(out.code, 'REFUSED');
});
