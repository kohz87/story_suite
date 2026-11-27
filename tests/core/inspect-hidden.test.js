// The Inspector never shows a cast person's join words or a hidden note that is not opened (made-up words).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { inspectReply, matchPaths } from '../../packs/screens/inspect.js';
import { normalizeSecrets } from '../../modules/people/meters/npc-meters.js';

const JOIN = 'When the blue kite has flown twice.';
const LOCKED = 'Mira keeps the tide ledger under the stair.';
const OPEN = 'Mira once ran the ferry at night.';
const NOTES = [
    { title: 'The stair ledger', text: LOCKED, when: 'the ledger is found', from: 'pack' },
    { id: 'sec_aaaaaaaa', gate: 'fact:lantern-is-lit', packId: 'lantern-oath', text: 'Mira swore the lantern oath.', from: 'pack' },
    { text: OPEN, when: 'the ferry is named', from: 'pack' },
];
const openId = normalizeSecrets(NOTES)[2].id;

const person = { id: 'npc_mira', name: 'Mira', secrets: NOTES, castFrom: { key: 'p:mira', join: JOIN } };
const stateOf = (npcs, unlocked) => ({ meta: { rev: 2 }, domains: { people: { npcs, bonds: { npcs: { npc_mira: { name: 'Mira', unlocked } } } } } });

test('inspectReply: join words and unopened notes read "(hidden)" in the state, changes and ops; an opened note shows', async () => {
    const host = await createHost();
    await host.send('Look around.', 'You find rope.\n<Changes>\n+ item Rope\n</Changes>');
    const before = stateOf({}, []);
    const state = stateOf({ npc_mira: person }, [openId]);
    const ops = [
        { op: 'add', path: '/domains/people/npcs/npc_mira', value: person },
        { op: 'replace', path: '/domains/people/npcs/npc_mira/secrets/0/text', value: LOCKED, was: LOCKED },
        { op: 'replace', path: '/domains/people/npcs/npc_mira/secrets/0/title', value: 'The stair ledger', was: 'The stair ledger' },
        { op: 'remove', path: '/domains/people/npcs/npc_mira/castFrom/join', was: JOIN },
    ];
    const kept = JSON.stringify({ state, ops });
    const store = { at: () => state, before: () => before, opsAt: () => ops, headIndex: () => host.ctx.chat.length - 1 };
    const view = inspectReply({ store, chat: host.ctx.chat, index: host.ctx.chat.length - 1, problems: () => [{ code: 'X', message: `Refused: ${LOCKED}` }] });
    assert.equal(view.ok, true);
    const all = JSON.stringify(view);
    assert.ok(!all.includes(JOIN) && !all.includes(LOCKED), 'no hidden words anywhere in the view');
    const shown = view.state.domains.people.npcs.npc_mira;
    assert.equal(shown.castFrom.join, '(hidden)');
    assert.deepEqual(shown.secrets.map(note => note.text), ['(hidden)', '(hidden)', OPEN]);
    assert.deepEqual([shown.secrets[0].title, shown.secrets[0].when, shown.secrets[1].gate, shown.secrets[1].packId], Array(4).fill('(hidden)'), 'a locked note\'s title and what opens it too');
    assert.equal(shown.secrets[2].when, 'the ferry is named', 'an opened note keeps its own');
    for (const words of ['stair ledger', 'ledger is found', 'lantern']) assert.ok(!all.includes(words), words);
    assert.equal(view.problems[0].message, 'Refused: (hidden)');
    assert.equal(view.ops[3].was, '(hidden)');
    assert.equal(matchPaths(view.state, 'tide ledger').count, 0, 'a search does not find them');
    assert.equal(matchPaths(view.state, 'blue kite').count, 0);
    assert.equal(JSON.stringify({ state, ops }), kept, 'the stored state is not touched');
    // The reply before the note opened shows it hidden.
    const earlier = inspectReply({ store: { ...store, at: () => stateOf({ npc_mira: person }, []), before: () => before, opsAt: () => [] }, chat: host.ctx.chat, index: host.ctx.chat.length - 1 });
    assert.ok(!JSON.stringify(earlier).includes(OPEN));
});

test('a note id one person opened stays locked for another who has the same id', async () => {
    const host = await createHost();
    await host.send('Look around.', 'You find rope.\n<Changes>\n+ item Rope\n</Changes>');
    const note = (title, when) => ({ id: 'sec_bbbbbbbb', meter: 'trust', at: 40, text: 'Keeps a second key.', title, when, from: 'pack' });
    const npcs = {
        npc_ana: { id: 'npc_ana', name: 'Ana', secrets: [note('The boathouse key', 'the boathouse floods')] },
        npc_bo: { id: 'npc_bo', name: 'Bo', secrets: [note('The cellar key', 'the cellar is dug')] },
    };
    // A record under another key is not Bo's, even with Bo's name on it.
    const state = { meta: { rev: 2 }, domains: { people: { npcs, bonds: { npcs: { npc_ana: { name: 'Ana', unlocked: ['sec_bbbbbbbb'] }, npc_old: { name: 'Bo', unlocked: [] } } } } } };
    const ops = Object.entries(npcs).flatMap(([id, person]) => [
        { op: 'add', path: `/domains/people/npcs/${id}`, value: person },
        { op: 'replace', path: `/domains/people/npcs/${id}/secrets/0/title`, value: person.secrets[0].title, was: person.secrets[0].title },
    ]);
    const store = { at: () => state, before: () => state, opsAt: () => ops, headIndex: () => host.ctx.chat.length - 1 };
    const view = inspectReply({ store, chat: host.ctx.chat, index: host.ctx.chat.length - 1 });
    const all = JSON.stringify(view);
    assert.ok(!all.includes('cellar'), 'the locked title and trigger are nowhere');
    const shown = view.state.domains.people.npcs;
    assert.deepEqual(shown.npc_ana.secrets, npcs.npc_ana.secrets, 'the opened note shows in its own dossier');
    assert.deepEqual([shown.npc_bo.secrets[0].title, shown.npc_bo.secrets[0].when, shown.npc_bo.secrets[0].text], Array(3).fill('(hidden)'));
    assert.equal(view.ops[1].value, 'The boathouse key');
    assert.equal(view.ops[3].was, '(hidden)');
});

test('a dossier with no bond record of its own has nothing opened, even with another person\'s name as an alias', async () => {
    const host = await createHost();
    await host.send('Look around.', 'You find rope.\n<Changes>\n+ item Rope\n</Changes>');
    const note = (title, when, text) => ({ id: 'sec_cccccccc', meter: 'trust', at: 40, text, title, when, from: 'pack' });
    const npcs = {
        npc_ana: { id: 'npc_ana', name: 'Ana', secrets: [note('The boathouse key', 'the boathouse floods', 'Keeps a spare oar.')] },
        npc_bo: { id: 'npc_bo', name: 'Bo', aliases: ['Ana'], secrets: [note('The cellar hatch', 'the cellar is dug', 'Hoards candle wax.')] },
    };
    const state = { meta: { rev: 2 }, domains: { people: { npcs, bonds: { npcs: { npc_ana: { name: 'Ana', unlocked: ['sec_cccccccc'] } } } } } };
    const bo = '/domains/people/npcs/npc_bo';
    const ops = [
        { op: 'add', path: bo, value: npcs.npc_bo },
        { op: 'replace', path: `${bo}/secrets/0/title`, value: 'The cellar hatch', was: 'The cellar hatch' },
        { op: 'replace', path: `${bo}/secrets/0/text`, value: 'Hoards candle wax.', was: 'Hoards candle wax.' },
    ];
    const store = { at: () => state, before: () => state, opsAt: () => ops, headIndex: () => host.ctx.chat.length - 1 };
    const view = inspectReply({ store, chat: host.ctx.chat, index: host.ctx.chat.length - 1 });
    const all = JSON.stringify(view);
    for (const words of ['cellar', 'candle wax']) assert.ok(!all.includes(words), words);
    assert.deepEqual(view.state.domains.people.npcs.npc_ana.secrets, npcs.npc_ana.secrets, 'Ana\'s own note still shows');
});
