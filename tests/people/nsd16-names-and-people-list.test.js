// N7: the NSD16 trigger (a reply with no <Changes> block is scanned only when it names someone) and the NSD14 people list (active people only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { replyNamesSomeone } from '../../modules/people/core/core-parts/reply-names.js';
import { buildLinesContext, listedPeople } from '../../modules/people/core/core-prompts-lines-parts/context.js';

const OPTS = { userName: 'Sam', charName: 'Kit', places: ['Harbor'], npcs: [{ id: 'mira', name: 'Mira Tolk', aliases: ['Mira'] }] };

test('a reply that names no one is not scanned', () => {
    assert.equal(replyNamesSomeone('The wind rose over the water. She laughed.', OPTS), false);
    assert.equal(replyNamesSomeone('Sam nodded. "Come," said Kit, walking to Harbor town.', OPTS), false, 'the player, the played character and a known place do not count');
    assert.equal(replyNamesSomeone('The wind rose.\n<Changes>\n~ npc Orsen | trust: up\n</Changes>', OPTS), false, 'a name inside the block is not the prose');
});

test('a reply that names a listed person, or a capitalised name not in the list, is scanned', () => {
    assert.equal(replyNamesSomeone('Mira smiled and turned away.', OPTS), true);
    assert.equal(replyNamesSomeone('He met Orsen at the gate.', OPTS), true);
    assert.equal(replyNamesSomeone('The rain fell. Orsen waited.', OPTS), false, 'a sentence-initial word is not taken for a name');
});

test('the people list: 40 dossiers with 30 archived list only the active ones; one the player names comes back', () => {
    const npcs = Array.from({ length: 40 }, (_, index) => ({ id: `p${index}`, name: `Person ${index}`, aliases: [], present: index < 3, lastSeenTurn: 100, archived: index >= 10 }));
    const listed = listedPeople({ existingNpcs: npcs, turn: 100, dormantAfter: 30 });
    assert.equal(listed.length, 10);
    assert.equal(listedPeople({ existingNpcs: npcs, turn: 100, dormantAfter: 30, namedNpcIds: ['p25'] }).length, 11);
    const text = buildLinesContext({ existingNpcs: npcs, turn: 100, dormantAfter: 30 });
    assert.ok(text.startsWith('People you know about (match by these names):\n[{"id":"p0","name":"Person 0","aliases":[]}'));
    assert.ok(!text.includes('registryState') && !text.includes('active people only'), 'no registryState and no extra line in the list');
    assert.ok(!text.includes('Person 25'));
});
